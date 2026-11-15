// @ts-nocheck
// React port of reference/modis-viirs-explorer.html — "Earth Pulse" MODIS · VIIRS Explorer (mock-up data).
// The original ran on React 18 UMD + CDN scripts; here the same component code runs as an ES module with
// npm packages. Logic is kept verbatim (hence ts-nocheck); map GeoJSON is loaded from /public/geo at runtime.
import * as React from "react";
import maplibregl from "maplibre-gl";
import * as TD from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import { Link } from "react-router-dom";
import "./explorer.css";

const {useState,useEffect,useRef,useMemo}=React, h=React.createElement;
const END=Date.UTC(2026,10,2),DAY=864e5,N=365;
const dateOf=i=>new Date(END-(N-1-i)*DAY), fmt=d=>d.toISOString().slice(0,10);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const hs=a=>{const x=Math.sin(a*127.1+311.7)*43758.5453;return x-Math.floor(x)};
const SENS={M:{n:'MODIS',c:'var(--M)'},V:{n:'VIIRS',c:'var(--V)'},H:{n:'Harmonized',c:'var(--H)'}};
const VARS={
 ndvi:{n:'NDVI vegetation',u:'',min:.1,max:.9,d:2,M:['MOD13Q1','250 m · 16-day composite'],V:['VNP13','Vegetation index']},
 lst:{n:'Surface temperature (LST)',u:'°C',min:22,max:42,d:1,M:['MOD11A1','1 km daily'],V:['VNP21','750 m']},
 fire:{n:'Fire (FRP)',u:'MW',min:0,max:60,d:1,M:['MOD14','Location · confidence · FRP'],V:['VNP14IMG','375 m · day and night detection']},
 ntl:{n:'Night-time lights',u:'nW/cm²/sr',min:0,max:40,d:1,M:null,V:['VNP46A1/A2','500 m daily · DNB']}
};
// ---- mock data generator (deterministic) ----
// smooth noise (value noise + fBm): nearby values correlate, forming patches
const vn=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),t=fy*fy*(3-2*fy),g=(a,b)=>hs(a*127.1+b*311.7+.5);return(g(ix,iy)*(1-u)+g(ix+1,iy)*u)*(1-t)+(g(ix,iy+1)*(1-u)+g(ix+1,iy+1)*u)*t};
const fb=(x,y)=>clamp(((vn(x,y)*.55+vn(x*2.1+5,y*2.1+9)*.3+vn(x*4.3+11,y*4.3+3)*.15)-.5)*1.8+.5,0,1);
const ss=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
function raw(v,s,i,lat,lon){
 if(v==='ntl'&&s==='M')return null;
 const d=dateOf(i),doy=(d-Date.UTC(d.getUTCFullYear(),0,0))/DAY+(lat<0?182:0),sp=fb(lon/12,lat/12),sp2=fb(lon/3+40,lat/3+40);
 const ti=(s==='M'&&v==='ndvi')?Math.floor(i/16)*16:i, n=hs(ti*1.7+(s==='M'?0:9)), wx=fb(lon/6+ti*.31+(s==='M'?0:7),lat/6+ti*.17), w=Math.sin(2*Math.PI*(doy-150)/365);
 if(v==='ndvi')return clamp(.5+.2*w*(.4+sp)+(sp-.5)*.55+(sp2-.5)*.25-Math.abs(lat-8)*.003+(n-.5)*.03+(wx-.5)*.08+(s==='M'?.02:-.015),0,1);
 if(v==='lst')return 33+6*Math.sin(2*Math.PI*(doy-80)/365)+(sp-.5)*16+(sp2-.5)*5-Math.abs(lat)*.28-(wx-.5)*7+(n-.5)*2+(s==='M'?.8:-.4);
 if(v==='fire'){const f=Math.pow(Math.max(0,Math.sin(2*Math.PI*(doy-20)/365)),3);const hot=ss(.45,.75,fb(lon/2.2+ti*.04,lat/2.2-ti*.03));return f*hot*(.3+sp2)*(.4+sp)*70*(s==='M'?1:1.8)}
 return 1.5+48*Math.pow(ss(.55,.85,fb(lon/1.6,lat/1.6)),1.4)*(.5+sp)*(.93+n*.14);
}
function val(v,s,i,lat,lon){
 if(s!=='H')return raw(v,s,i,lat,lon);
 const a=raw(v,'M',i,lat,lon),b=raw(v,'V',i,lat,lon); if(a==null)return b;
 if(v==='ndvi')return(a-.02+b+.015)/2; if(v==='lst')return(a-.8+b+.4)/2; return(a+b/1.8)/2; // bias-adjust before averaging
}
const STOPS=[[26,35,126],[33,145,140],[253,231,37],[240,120,30],[200,30,30]];
function color(t){t=clamp(t,0,.999)*(STOPS.length-1);const k=Math.floor(t),f=t-k,a=STOPS[k],b=STOPS[k+1];return`rgb(${a.map((x,j)=>Math.round(x+(b[j]-x)*f)).join()})`}
const inPoly=(x,y,r)=>{let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const[xi,yi]=r[i],[xj,yj]=r[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c}return c};
const WORLD=[[-180,-60],[180,-60],[180,80],[-180,80],[-180,-60]];

const bbox=r=>{const x=r.map(p=>p[0]),y=r.map(p=>p[1]);return[Math.min(...x),Math.min(...y),Math.max(...x),Math.max(...y)]};
const cent=r=>{const b=bbox(r);return[(b[0]+b[2])/2,(b[1]+b[3])/2]};
let LAND_GJ=null,BORDERS=null,LAND=null;
async function loadGeo(){if(LAND)return;const [l,b]=await Promise.all([fetch('/geo/land.json').then(r=>r.json()),fetch('/geo/borders.json').then(r=>r.json())]);LAND_GJ=l;BORDERS=b;LAND=LAND_GJ.geometry.coordinates.map(p=>p[0]).map(r=>{const bb=bbox(r);r.bb=bb;return r})}

const my=l=>Math.log(Math.tan(Math.PI/4+l*Math.PI/360))*180/Math.PI,ml=y=>(2*Math.atan(Math.exp(y*Math.PI/180))-Math.PI/2)*180/Math.PI;
const cA=t=>{t=clamp(t,0,.999)*(STOPS.length-1);const k=Math.floor(t),f=t-k,a=STOPS[k],b=STOPS[k+1];return a.map((x,j)=>Math.round(x+(b[j]-x)*f))};
let WG=null; // cache the global grid, computed once
function maskFrom(rings,x0,y0,dx,nx,ny){ // build the mask with a canvas fill instead of point-in-polygon per point
 const cv=document.createElement('canvas');cv.width=nx;cv.height=ny;const c=cv.getContext('2d',{willReadFrequently:true});c.fillStyle='#000';
 rings.forEach(r=>{c.beginPath();r.forEach((p,i)=>{const X=(p[0]-x0)/dx,Y=ny-(my(clamp(p[1],-85,85))-y0)/dx;i?c.lineTo(X,Y):c.moveTo(X,Y)});c.closePath();c.fill()});
 const d=c.getImageData(0,0,nx,ny).data,m=new Uint8Array(nx*ny);
 for(let r=0;r<ny;r++)for(let a=0;a<nx;a++)m[(ny-1-r)*nx+a]=d[(r*nx+a)*4+3]>127?1:0;
 return m}
const hmCv=document.createElement('canvas');hmCv.width=hmCv.height=2;
function MapView({aoi,setAoi,heat,drawReq,hot,fireMode,fly,watchFC,onZone,selZone}){
 const el=useRef(),map=useRef(),draw=useRef(),fb=useRef({on:false,pts:[]}),ready=useRef(false),zoneCb=useRef(null);zoneCb.current=onZone;
 useEffect(()=>{
  try{
   const m=map.current=new maplibregl.Map({container:el.current,center:[15,25],zoom:1,renderWorldCopies:false,maxPitch:0,attributionControl:false,
    style:{version:8,sources:{},layers:[{id:'bg',type:'background',paint:{'background-color':'#0f1b2d'}}]}});
   m.on('load',()=>{
    m.addSource('th',{type:'geojson',data:LAND_GJ});
    m.addLayer({id:'th-f',type:'fill',source:'th',paint:{'fill-color':'#1c2f45'}});
    m.addLayer({id:'th-l',type:'line',source:'th',paint:{'line-color':'#6f8fb0','line-width':.8}});
    m.addSource('bd',{type:'geojson',data:BORDERS});m.addLayer({id:'bd',type:'line',source:'bd',paint:{'line-color':'#3b5573','line-width':.5}});
    m.addSource('hm',{type:'canvas',canvas:hmCv,animate:true,coordinates:[[-180,80],[180,80],[180,-60],[-180,-60]]});
    m.addLayer({id:'hm',type:'raster',source:'hm',paint:{'raster-resampling':'linear','raster-opacity':.9,'raster-fade-duration':0}},'bd');
    m.addSource('fb',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    m.addLayer({id:'fb-f',type:'fill',source:'fb',filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':'#fff','fill-opacity':.12}});
    m.addLayer({id:'fb-l',type:'line',source:'fb',paint:{'line-color':'#fff','line-width':2}});
    m.addSource('wa',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    const wc=['case',['==',['get','f'],1],['match',['get','lvl'],0,'#3fa96b',1,'#ffd60a',2,'#ff9f0a','#ff3b30'],'#8fa1ad'];
    m.addLayer({id:'wa-f',type:'fill',source:'wa',paint:{'fill-color':wc,'fill-opacity':['case',['==',['get','f'],1],.22,.08]}});
    m.addLayer({id:'wa-l',type:'line',source:'wa',filter:['==',['get','f'],0],paint:{'line-color':'#8fa1ad','line-width':1.5,'line-dasharray':[2,1.5]}});
    m.addLayer({id:'wa-lf',type:'line',source:'wa',filter:['==',['get','f'],1],paint:{'line-color':wc,'line-width':3}});
    m.addLayer({id:'wa-sel',type:'line',source:'wa',filter:['==',['get','id'],''],paint:{'line-color':'#fff','line-width':4.5,'line-opacity':.95}});
    m.on('click','wa-f',e=>{const f=e.features&&e.features[0];if(f&&zoneCb.current)zoneCb.current(f.properties.id)});
    m.on('mouseenter','wa-f',()=>{m.getCanvas().style.cursor='pointer'});m.on('mouseleave','wa-f',()=>{m.getCanvas().style.cursor=''});
    m.addSource('hs',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    m.addLayer({id:'hs',type:'circle',source:'hs',layout:{visibility:'none'},paint:{'circle-radius':['interpolate',['linear'],['zoom'],0,['interpolate',['linear'],['get','frp'],0,2.5,70,5.5],8,['interpolate',['linear'],['get','frp'],0,5,70,14]],'circle-color':['match',['get','conf'],'high','#ff3b30','nominal','#ff9f0a','#ffd60a'],'circle-stroke-color':'#fff','circle-stroke-width':.8,'circle-opacity':.92}});
    ready.current=true; m.fire('hm-ready');
    if(true){
     const T=TD,d=draw.current=new T.TerraDraw({adapter:new TerraDrawMapLibreGLAdapter({map:m,lib:maplibregl}),
      modes:[new T.TerraDrawPolygonMode(),new T.TerraDrawSelectMode({flags:{polygon:{feature:{draggable:true,coordinates:{midpoints:true,draggable:true,deletable:true}}}}})]});
     d.start();
     const poly=()=>d.getSnapshot().filter(f=>f.geometry.type==='Polygon'&&!f.properties.selectionPoint&&!f.properties.midPoint);
     d.on('finish',id=>{d.removeFeatures(poly().filter(f=>f.id!==id).map(f=>f.id));const f=poly().find(f=>f.id===id);if(f){const r=f.geometry.coordinates[0],bb=bbox(r);setAoi(r);d.setMode('select');m.fitBounds([[bb[0],bb[1]],[bb[2],bb[3]]],{padding:50,maxZoom:10,duration:500})}});
     d.on('change',(ids,type)=>{if(type==='update'&&d.getMode()==='select'){const f=poly()[0];if(f)setAoi(f.geometry.coordinates[0])}});
    }else{
     m.on('click',e=>{const s=fb.current;if(!s.on)return;s.pts.push([e.lngLat.lng,e.lngLat.lat]);m.getSource('fb').setData({type:'Feature',geometry:{type:'LineString',coordinates:s.pts}})});
     m.on('dblclick',e=>{const s=fb.current;if(!s.on||s.pts.length<3)return;s.on=false;const r=[...s.pts,s.pts[0]];m.getSource('fb').setData({type:'Feature',geometry:{type:'Polygon',coordinates:[r]}});m.doubleClickZoom.enable();setAoi(r);const bb=bbox(r);m.fitBounds([[bb[0],bb[1]],[bb[2],bb[3]]],{padding:50,maxZoom:10,duration:500})});
    }
   });
  }catch(e){console.error(e)}
  return()=>{try{map.current&&map.current.remove()}catch(e){}};
 },[]);
 useEffect(()=>{const m=map.current;if(!m)return;const set=()=>{const sr=m.getSource('hm');if(!sr)return;hmCv.width=heat.cv.width;hmCv.height=heat.cv.height;hmCv.getContext('2d').drawImage(heat.cv,0,0);sr.setCoordinates(heat.coords);m.triggerRepaint()};ready.current?set():m.once('hm-ready',set)},[heat]);
 useEffect(()=>{const ro=new ResizeObserver(()=>map.current&&map.current.resize());ro.observe(el.current);return()=>ro.disconnect()},[]);
 useEffect(()=>{const m=map.current;if(!m)return;const set=()=>{const sr=m.getSource('hs');if(sr)sr.setData(hot);const wr=m.getSource('wa');if(wr)wr.setData(watchFC);m.setLayoutProperty('hm','visibility',fireMode?'none':'visible');m.setLayoutProperty('hs','visibility',fireMode?'visible':'none')};ready.current?set():m.once('hm-ready',set)},[hot,fireMode,watchFC]);
 useEffect(()=>{const m=map.current;if(!m)return;const set=()=>m.getLayer('wa-sel')&&m.setFilter('wa-sel',['==',['get','id'],selZone||'']);ready.current?set():m.once('hm-ready',set)},[selZone]);
 useEffect(()=>{const m=map.current;if(m&&fly.n){fly.bb?m.fitBounds([[fly.bb[0],fly.bb[1]],[fly.bb[2],fly.bb[3]]],{padding:60,maxZoom:10,duration:800}):m.flyTo({center:[fly.lng,fly.lat],zoom:Math.max(m.getZoom(),9),duration:800})}},[fly]);
 useEffect(()=>{ // commands from the buttons
  if(!drawReq.n)return;const m=map.current,d=draw.current;
  if(drawReq.k==='clear'||drawReq.k==='discard'){setAoi(null);(m&&drawReq.k==='clear'&&m.easeTo({center:[15,25],zoom:1,duration:500}),d?(d.setMode('select'),d.clear()):(fb.current={on:false,pts:[]},m&&m.getSource('fb')&&m.getSource('fb').setData({type:'FeatureCollection',features:[]})))}
  else if(drawReq.k==='cancel'){if(d)d.setMode('select');else if(m){fb.current={on:false,pts:[]};m.doubleClickZoom.enable();m.getSource('fb')&&m.getSource('fb').setData(aoi?{type:'Feature',geometry:{type:'Polygon',coordinates:[aoi]}}:{type:'FeatureCollection',features:[]})}}
  else if(d){d.setMode('polygon')}
  else if(m){fb.current={on:true,pts:[]};m.doubleClickZoom.disable()}
 },[drawReq]);
 return h('div',{id:'map',ref:el,role:'application','aria-label':'Map. Draw a polygon for the area of interest'});
}

function Chart({series,lo,hi,sel,setSel,v,focus}){
 const W=640,H=170,P=28,V=VARS[v],span=Math.max(1,hi-lo),y=x=>H-P-(clamp((x-V.min)/(V.max-V.min),0,1))*(H-2*P),xx=i=>P+(i-lo)*(W-2*P)/span;
 const path=k=>{let d='',pen=false;for(let i=lo;i<=hi;i++){const x=series[k][i];if(x==null){pen=false;continue}d+=(pen?'L':'M')+xx(i).toFixed(1)+' '+y(x).toFixed(1);pen=true}return d};
 return h('div',{className:'scroll'},h('svg',{viewBox:`0 0 ${W} ${H}`,style:{width:Math.max(100,(hi-lo+1)/N*200)+'%',display:'block'},role:'img','aria-label':'History chart',onClick:e=>{const r=e.currentTarget.getBoundingClientRect();setSel(clamp(lo+Math.round(((e.clientX-r.left)/r.width*W-P)/(W-2*P)*span),lo,hi))}},
  [0,.5,1].map(t=>h('g',{key:t},h('line',{x1:P,x2:W-P,y1:H-P-t*(H-2*P),y2:H-P-t*(H-2*P),stroke:'var(--ln)'}),h('text',{x:2,y:H-P-t*(H-2*P)+4,fontSize:10,fill:'var(--mu)'},(V.min+t*(V.max-V.min)).toFixed(V.d>1?1:0)))),
  ['M','V','H'].map(k=>h('path',{key:k,d:path(k),fill:'none',stroke:SENS[k].c,strokeWidth:k===focus?2.4:1,opacity:k===focus?1:.45})),
  h('line',{x1:xx(sel),x2:xx(sel),y1:P/2,y2:H-P,stroke:'var(--tx)',strokeDasharray:'3 3'}),
  h('text',{x:P,y:H-8,fontSize:10,fill:'var(--mu)'},fmt(dateOf(lo))),h('text',{x:W-P,y:H-8,fontSize:10,textAnchor:'end',fill:'var(--mu)'},fmt(dateOf(hi)))));
}

function Calendar({vals,lo,hi,v,sel,setSel}){
 const V=VARS[v],c=13,g=2,n=hi-lo+1,off=dateOf(lo).getUTCDay(),cols=Math.ceil((n+off)/7),mon=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],cells=[],labels=[],big=false;
 for(let i=lo;i<=hi;i++){const x=vals[i],k=i-lo+off,cx=Math.floor(k/7)*(c+g),cy=(k%7)*(c+g)+19,d=dateOf(i);
  if(d.getUTCDate()===1||i===lo)labels.push(h('text',{key:'l'+i,x:cx,y:13,fontSize:13,fill:'var(--mu)'},mon[d.getUTCMonth()]));
  cells.push(h('rect',{key:i,x:cx,y:cy,width:c,height:c,rx:2,fill:x==null?'none':color((x-V.min)/(V.max-V.min)),stroke:i===sel?'var(--tx)':x==null?'var(--ln)':'none',strokeWidth:i===sel?1.6:1,tabIndex:i===sel?0:-1,onClick:()=>setSel(i),
   onKeyDown:e=>{if(e.key==='ArrowRight')setSel(Math.min(hi,i+7));if(e.key==='ArrowLeft')setSel(Math.max(lo,i-7));if(e.key==='ArrowDown')setSel(Math.min(hi,i+1));if(e.key==='ArrowUp')setSel(Math.max(lo,i-1))}},
   h('title',{},fmt(d)+' : '+(x==null?'No data':x.toFixed(V.d)+' '+V.u))));
  if(big&&x!=null)cells.push(h('text',{key:'t'+i,x:cx+c/2,y:cy+c/2+2.6,fontSize:7,textAnchor:'middle',fill:'#fff',stroke:'rgba(0,0,0,.5)',strokeWidth:.5,paintOrder:'stroke',pointerEvents:'none'},d.getUTCDate()))}
 return h('div',{className:'scroll'},h('svg',{viewBox:`0 0 ${cols*(c+g)} ${7*(c+g)+20}`,style:{width:(cols/54*300)+'%',display:'block'},role:'grid','aria-label':'History calendar'},labels,cells));
}

const IC={draw:['M12 3l8 6-3 11H7L4 9z'],clear:['M5 5l14 14M19 5L5 19'],sM:[{cx:12,cy:12,r:9},{t:'M'}],sV:[{cx:12,cy:12,r:9},{t:'V'}],sH:[{cx:12,cy:12,r:9},{t:'H'}],
 ndvi:['M5 19c0-8 5-13 14-14 0 9-5 14-13 14M5 19l7-7'],lst:['M10 14V5a2 2 0 014 0v9a4 4 0 11-4 0z'],fire:['M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z'],ntl:['M20 14a8 8 0 11-10-10 6 6 0 0010 10z'],
 clock:[{cx:12,cy:12,r:9},'M12 7v5l3 2'],layers:['M4 8l8-4 8 4-8 4zM4 12l8 4 8-4M4 16l8 4 8-4'],info:[{cx:12,cy:12,r:9},'M12 8h.01M11 12h1v5'],
 play:['M7 5l12 7-12 7z'],pause:['M8 5v14M16 5v14'],min:['M6 12h12'],bell:['M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8','M10 21a2 2 0 004 0'],pin:['M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11z',{cx:12,cy:10,r:2.5}],flask:['M9 3h6M10 3v6L4 19a1.5 1.5 0 001.3 2h13.4A1.5 1.5 0 0020 19l-6-10V3'],chart:['M4 20V10M10 20V4M16 20v-7M22 20H2'],chev:['M9 6l6 6-6 6'],labels:['M4 7V5h16v2M12 5v14M9 19h6'],shrink:['M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7']};
const Ic=({n,s=16})=>h('svg',{width:s,height:s,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true,style:{flex:'none'}},IC[n].map((d,i)=>typeof d==='string'?h('path',{key:i,d}):d.t?h('text',{key:i,x:12,y:16,fontSize:11,fontWeight:700,textAnchor:'middle',fill:'currentColor',stroke:'none'},d.t):h('circle',{key:i,...d})));
function Panel({id,icon,title,open,toggle,style,children}){
 if(!open[id])return h('button',{className:'tb ibx',title:'Show '+title,'aria-label':'Show '+title,onClick:()=>toggle(id)},h(Ic,{n:icon,s:18}));
 return h('div',{className:'tb',style},children,h('button',{className:'ib2 q',title:'Collapse '+title,'aria-label':'Collapse '+title,onClick:()=>toggle(id)},h(Ic,{n:'min'})));
}
const EMPTY={type:'FeatureCollection',features:[]};
const rkf=r=>r<35?0:r<55?1:r<75?2:3;
const zonePts=r=>{const b=bbox(r),p=[];for(let a=0;a<14;a++)for(let c=0;c<14;c++){const x=b[0]+(a+.5)*(b[2]-b[0])/14,y=b[1]+(c+.5)*(b[3]-b[1])/14;if(inPoly(x,y,r))p.push([x,y])}return p};
const zoneCalc=(pts,ring,sn,day,minFrp)=>{let cnt=0,mx=0;pts.forEach(([x,y])=>{const q=val('fire',sn,day,y,x);if(q!=null&&q>=minFrp){cnt++;mx=Math.max(mx,q)}});
 const[cx,cy]=cent(ring),lst=val('lst','V',day,cy,cx),nd=val('ndvi','V',day,cy,cx),t=clamp((lst-30)/10,0,1),d=clamp((.75-nd)/.5,0,1),a=clamp(cnt/5,0,1),risk=Math.round(100*(.45*t+.35*d+.2*a));
 return{cnt,mx,lst,nd,t,d,a,risk,lvl:cnt>0?Math.max(2,rkf(risk)):rkf(risk)}};
function Spark({hist}){const W=300,H=64,n=hist.length,mx=Math.max(5,...hist.map(p=>p.cnt)),x=i=>8+i*(W-16)/Math.max(1,n-1);
 return h('svg',{viewBox:`0 0 ${W} ${H}`,width:'100%',role:'img','aria-label':'Risk index (line) and hotspot count (bars), last 14 days'},
  [55,75].map(t=>h('line',{key:t,x1:0,x2:W,y1:H-4-t/100*(H-12),y2:H-4-t/100*(H-12),stroke:'var(--ln)',strokeDasharray:'3 3'})),
  hist.map((p,i)=>h('rect',{key:i,x:x(i)-4,width:8,y:H-4-p.cnt/mx*(H-12),height:p.cnt/mx*(H-12),fill:'#ff3b30',opacity:.45})),
  h('path',{d:hist.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+(H-4-p.risk/100*(H-12)).toFixed(1)).join(''),fill:'none',stroke:'var(--tx)',strokeWidth:2}))}
const Q=(x,y,w,h)=>[[x,y],[x+w,y+.1*h],[x+w*.95,y+h],[x+.05*w,y+h*.9],[x,y]];
const ZONES=[ // example server-defined watch areas
{id:'z1',name:'Northwestern forests',country:'Thailand',cont:'Asia',ring:Q(98.0,17.8,1.4,1.8)},{id:'z2',name:'Nan–Uttaradit forests',country:'Thailand',cont:'Asia',ring:Q(100.4,17.6,1.1,1.5)},
{id:'z3',name:'Shan Plateau',country:'Myanmar',cont:'Asia',ring:Q(96.8,20.2,1.6,1.6)},{id:'z4',name:'Northern ranges',country:'Laos',cont:'Asia',ring:Q(102.2,19.2,1.5,1.4)},
{id:'z5',name:'Eastern dry forest',country:'Cambodia',cont:'Asia',ring:Q(106.5,12.2,1.4,1.4)},{id:'z6',name:'Riau peatlands',country:'Indonesia',cont:'Asia',ring:Q(101.0,0.2,1.8,1.4)},
{id:'z7',name:'Central Kalimantan peatlands',country:'Indonesia',cont:'Asia',ring:Q(113.0,-3.2,1.8,1.4)},{id:'z8',name:'Amazon forest edge',country:'Brazil',cont:'South America',ring:Q(-55.5,-9.5,2.4,2.0)},
{id:'z9',name:'Northern California forests',country:'United States',cont:'North America',ring:Q(-122.6,39.0,1.5,1.4)},{id:'z10',name:'New South Wales coastal forests',country:'Australia',cont:'Oceania',ring:Q(150.0,-34.2,1.3,1.6)},
{id:'z11',name:'Central savanna',country:'Congo (DRC)',cont:'Africa',ring:Q(24.0,-9.0,2.0,2.0)},{id:'z12',name:'Central forests',country:'Portugal',cont:'Europe',ring:Q(-8.2,39.8,1.2,1.2)},
{id:'z13',name:'Eastern taiga',country:'Russia',cont:'Asia',ring:Q(110.0,56.0,3.0,2.0)}];
function App(){
 const [s,setS]=useState('H'),[v,setV]=useState('ndvi'),[aoi,setAoi]=useState(null),[sel,setSel]=useState(N-2),[req,setReq]=useState({n:0,k:''}),[rg,setRg]=useState({lo:N-33,hi:N-2,pre:'lm'}),[playing,setPlaying]=useState(false),[drawing,setDrawing]=useState(false),[open,setOpen]=useState({tools:true,sensor:true,vr:true,time:true}),[side,setSide]=useState(()=>!window.matchMedia('(max-width:860px)').matches),[sideW,setSideW]=useState(460),[rzOn,setRzOn]=useState(false),[mode,setMode]=useState('sci'),[minFrp,setMinFrp]=useState(5),[hiOnly,setHiOnly]=useState(false),[qaOn,setQaOn]=useState(false),[alertOn,setAlertOn]=useState(false),[csvMsg,setCsvMsg]=useState(''),[fly,setFly]=useState({n:0}),[follow,setFollow]=useState(()=>{try{return JSON.parse(localStorage.getItem('ep-follow')||'[]')}catch(e){return[]}}),[showZones,setShowZones]=useState(true),[zones,setZones]=useState([]),[notifyOn,setNotifyOn]=useState(false),[perm,setPerm]=useState(()=>'Notification' in window?Notification.permission:'unsupported'),[toast,setToast]=useState(null),[selZone,setSelZone]=useState(null),[fCont,setFCont]=useState(''),[fCountry,setFCountry]=useState(''),[fQuery,setFQuery]=useState(''),[fFol,setFFol]=useState(false),sideRef=useRef(null),[tab,setTab]=useState('ov');
 const toggle=id=>setOpen(o=>({...o,[id]:!o[id]})),anyOpen=Object.values(open).some(Boolean);
 const P=(pp,...ch)=>h(Panel,{...pp,open,toggle},...ch);
 const B=(ic,tx,fn,cls,on)=>h('button',{className:cls,onClick:fn,title:tx,'aria-label':tx,'aria-pressed':on},h(Ic,{n:ic}));
 const {lo,hi}=rg;
 useEffect(()=>{setDrawing(false)},[aoi]);
 useEffect(()=>{if(!playing)return;const t=setInterval(()=>setSel(x=>x>=hi?lo:x+1),500);return()=>clearInterval(t)},[playing,lo,hi]);
 const ring=aoi||WORLD,[lon,lat]=cent(ring);
 const series=useMemo(()=>{const o={};['M','V','H'].forEach(k=>o[k]=Array.from({length:N},(_,i)=>val(v,k,i,lat,lon)));return o},[v,lat,lon]);
 const grid=useMemo(()=>{if(!aoi&&WG)return WG;const b=bbox(ring),y0=my(b[1]),y1=my(b[3]),S=aoi?120:300,dx=Math.max(b[2]-b[0],y1-y0)/S,nx=Math.ceil((b[2]-b[0])/dx-1e-9),ny=Math.ceil((y1-y0)/dx-1e-9),lon=[],lat=[],mask=new Uint8Array(nx*ny);
  for(let a=0;a<nx;a++)lon[a]=b[0]+(a+.5)*dx;for(let c=0;c<ny;c++)lat[c]=ml(y0+(c+.5)*dx);
  mask.set(maskFrom(aoi?[ring]:LAND,b[0],y0,dx,nx,ny));
  const out={nx,ny,x0:b[0],y0,dx,lon,lat,mask};if(!aoi)WG=out;return out},[ring]);
 const heat=useMemo(()=>{if(mode==='fire'){const t=document.createElement('canvas');t.width=t.height=1;return{cv:t,pass:1,coords:[[-180,80],[180,80],[180,-60],[-180,-60]]}}const V=VARS[v],{nx,ny,x0,y0,dx,lon,lat,mask}=grid,cv=document.createElement('canvas');cv.width=nx;cv.height=ny;
  const cx=cv.getContext('2d'),im=cx.createImageData(nx,ny),sp=v==='fire'||v==='ntl';let tot=0,bad=0;
  for(let c=0;c<ny;c++)for(let a=0;a<nx;a++){if(!mask[c*nx+a])continue;const q=val(v,s,sel,lat[c],lon[a]);if(q==null)continue;tot++;if(v!=='fire'&&fb(lon[a]/4+sel*.5+(s==='M'?0:3),lat[c]/4-sel*.2)>.68){bad++;if(qaOn)continue}
   const w=clamp((q-V.min)/(V.max-V.min),0,1),al=sp?clamp((w-.03)/.12,0,1):1;if(!al)continue;
   const rgb=cA(w),o=((ny-1-c)*nx+a)*4;im.data[o]=rgb[0];im.data[o+1]=rgb[1];im.data[o+2]=rgb[2];im.data[o+3]=Math.round(al*255)}
  cx.putImageData(im,0,0);const yt=ml(y0+ny*dx),yb=ml(y0),xr=x0+nx*dx;
  return{cv,pass:tot?1-bad/tot:1,coords:[[x0,yt],[xr,yt],[xr,yb],[x0,yb]]}},[grid,v,s,sel,qaOn,mode]);
 const hot=useMemo(()=>{if(mode!=='fire')return EMPTY;const{nx,ny,y0,dx,lon,lat,mask}=WG||grid,f=[];
  for(let c=0;c<ny;c++)for(let a=0;a<nx;a++){if(!mask[c*nx+a])continue;const q=val('fire',s,sel,lat[c],lon[a]);if(q==null||q<minFrp)continue;
   const r=hs(a*7.1+c*3.3+sel),conf=(q>25&&r>.15)||r>.8?'high':r>.4?'nominal':'low';if(hiOnly&&conf!=='high')continue;
   const lg=lon[a]+(hs(a+c*13.7+sel)-.5)*dx,la=ml(y0+(c+.5+(hs(c+a*11.3+sel)-.5))*dx);
   f.push({type:'Feature',properties:{frp:+q.toFixed(1),conf},geometry:{type:'Point',coordinates:[+lg.toFixed(3),+la.toFixed(3)]}})}
  f.sort((p,q)=>q.properties.frp-p.properties.frp);return{type:'FeatureCollection',features:f.slice(0,2500)}},[mode,grid,s,sel,minFrp,hiOnly]);
 const V=VARS[v],cur=series[s],now=cur[sel],ok=cur.slice(lo,hi+1).filter(x=>x!=null),avg=ok.length?ok.reduce((a,b)=>a+b,0)/ok.length:null;
 const km2=aoi?Math.round(Math.abs(bbox(aoi)[2]-bbox(aoi)[0])*111*Math.abs(bbox(aoi)[3]-bbox(aoi)[1])*111*Math.cos(lat*Math.PI/180)):null;
 const cmd=k=>setReq(r=>({n:r.n+1,k}));
 const ix=t=>Math.round((t-dateOf(0).getTime())/DAY);
 const setRange=(a,b,pre)=>{a=clamp(a,0,N-2);b=clamp(b,a+1,N-1);setRg({lo:a,hi:b,pre});setSel(x=>clamp(x,a,b))};
 const PRES={lm:['Last month',()=>{const e=dateOf(N-1);return[ix(Date.UTC(e.getUTCFullYear(),e.getUTCMonth()-1,1)),ix(Date.UTC(e.getUTCFullYear(),e.getUTCMonth(),1))]}],d30:['30 days',()=>[N-30,N-1]],d90:['90 days',()=>[N-90,N-1]],y1:['1 year',()=>[0,N-1]],d3:['3 days',()=>[N-3,N-1]],d7:['7 days',()=>[N-7,N-1]]};
 const PRE=mode==='fire'?{d3:PRES.d3,d7:PRES.d7,d30:PRES.d30}:{lm:PRES.lm,d30:PRES.d30,d90:PRES.d90,y1:PRES.y1};
 const switchMode=m=>{setMode(m);setPlaying(false);if(m==='fire'){setAoi(null);setDrawing(false);cmd('clear');setV('fire');setS(x=>x==='H'?'V':x);setRg({lo:N-7,hi:N-1,pre:'d7'});setSel(N-1)}else{setV('ndvi');setS('H');const e=dateOf(N-1),a=ix(Date.UTC(e.getUTCFullYear(),e.getUTCMonth()-1,1)),b=ix(Date.UTC(e.getUTCFullYear(),e.getUTCMonth(),1));setRg({lo:a,hi:b,pre:'lm'});setSel(b)}};
 const dmin=fmt(dateOf(0)),dmax=fmt(dateOf(N-1));
 const aoiTxt=(aoi?`${aoi.length-1} vertices · about ${km2.toLocaleString()} km² · drag vertices to edit`:'Global (example) · draw a polygon to limit the area')+' · click to add points, double-click to close';
 const note=s==='H'?'MODIS + VIIRS combined after a bias adjustment (example)':s==='M'?'Terra ~10:30 · Aqua ~13:30 · retiring late 2026–2027':'Suomi NPP · NOAA-20 · NOAA-21 · night-time DNB band';
 const [xa,ya]=(()=>{const X=[],Y=[];for(let i=lo;i<=hi;i++){const p=series.M[i],q=series.V[i];if(p!=null&&q!=null){X.push(p);Y.push(q)}}return[X,Y]})();
 const mxm=xa.reduce((p,q)=>p+q,0)/(xa.length||1),mym=ya.reduce((p,q)=>p+q,0)/(ya.length||1),bias=xa.length?mxm-mym:null;
 const sxy=xa.reduce((p,q,i)=>p+(q-mxm)*(ya[i]-mym),0),sxx=xa.reduce((p,q)=>p+(q-mxm)**2,0),syy=ya.reduce((p,q)=>p+(q-mym)**2,0),rr=xa.length>2&&sxx>0&&syy>0?sxy/Math.sqrt(sxx*syy):null;
 const anom=now!=null&&avg!=null?now-avg:null;
 const copyCsv=async()=>{const rows=['date,MODIS,VIIRS,Harmonized'];for(let i=lo;i<=hi;i++)rows.push([fmt(dateOf(i)),...['M','V','H'].map(k=>series[k][i]==null?'':series[k][i].toFixed(4))].join(','));try{await navigator.clipboard.writeText(rows.join('\n'));setCsvMsg('Copied')}catch(e){setCsvMsg('Copy failed')}setTimeout(()=>setCsvMsg(''),2000)};
 const sciCards=h(React.Fragment,null,
  h('div',{className:'card'},h('div',{className:'kv'},h('span',{className:'mu'},'Anomaly from the period mean'),h('b',{},anom==null?'—':(anom>=0?'+':'')+anom.toFixed(V.d)+' '+V.u))),
  h('div',{className:'card'},h('label',{className:'kv'},h('span',{},'QA: hide cloudy pixels'),h('input',{type:'checkbox',checked:qaOn,onChange:e=>setQaOn(e.target.checked)})),h('div',{className:'kv mu'},h('span',{},'Usable pixels on the selected day'),h('span',{},v==='fire'?'—':Math.round(heat.pass*100)+'%'))),
  h('div',{className:'card'},h('div',{className:'kv'},h('span',{className:'mu'},'Bias (MODIS − VIIRS)'),h('b',{},bias==null?'—':(bias>=0?'+':'')+bias.toFixed(V.d+1)+' '+V.u)),h('div',{className:'kv'},h('span',{className:'mu'},'Correlation (r)'),h('b',{},rr==null?'—':rr.toFixed(2)))),
  h('button',{className:'btn g',onClick:copyCsv},'Copy CSV'+(csvMsg?' · '+csvMsg:'')));
const LVN=['Low','Moderate','High','Very high'],LVC=['#3fa96b','#ffd60a','#ff9f0a','#ff3b30'],rk=r=>r<35?0:r<55?1:r<75?2:3;
 useEffect(()=>{const t=setTimeout(()=>setZones(ZONES),500);return()=>clearTimeout(t)},[]);
 const wst=useMemo(()=>zones.map(w=>{const b=bbox(w.ring),pts=[];for(let a=0;a<14;a++)for(let c=0;c<14;c++){const x=b[0]+(a+.5)*(b[2]-b[0])/14,y=b[1]+(c+.5)*(b[3]-b[1])/14;if(inPoly(x,y,w.ring))pts.push([x,y])}
  let cnt=0,mx=0;const sn=s==='H'?'V':s;pts.forEach(([x,y])=>{const q=val('fire',sn,sel,y,x);if(q!=null&&q>=minFrp){cnt++;mx=Math.max(mx,q)}});
  const[cx,cy]=cent(w.ring),lst=val('lst','V',sel,cy,cx),nd=val('ndvi','V',sel,cy,cx),risk=Math.round(100*(.45*clamp((lst-30)/10,0,1)+.35*clamp((.75-nd)/.5,0,1)+.2*clamp(cnt/5,0,1)));
  return{...w,fol:follow.includes(w.id),cnt,mx,lst,nd,risk,lvl:cnt>0?Math.max(2,rk(risk)):rk(risk),cx,cy,bb:b}}),[zones,follow,sel,s,minFrp]);
 const folN=wst.filter(w=>w.fol).length;
 const watchFC=useMemo(()=>mode==='fire'?{type:'FeatureCollection',features:wst.filter(w=>w.fol||showZones).map(w=>({type:'Feature',properties:{id:w.id,lvl:w.lvl,f:w.fol?1:0},geometry:{type:'Polygon',coordinates:[w.ring]}}))}:EMPTY,[wst,mode,showZones]);
 const alerts=useMemo(()=>wst.filter(w=>w.fol).flatMap(w=>{const d=fmt(dateOf(sel));
  if(w.cnt>0)return[{id:w.id+'f'+d,w,lvl:3,title:'Hotspots in '+w.name,body:w.cnt+' · max FRP '+w.mx.toFixed(1)+' MW',act:'Check the highest-FRP detections first and confirm with field reports'}];
  if(w.lvl>=2)return[{id:w.id+'r'+w.lvl+d,w,lvl:w.lvl,title:'Wildfire risk'+LVN[w.lvl]+' · '+w.name,body:'Risk index '+w.risk+'/100 · LST '+w.lst.toFixed(1)+'°C · NDVI '+w.nd.toFixed(2),act:w.lvl>=3?'Consider full monitoring; check crews and water sources':'Ready the crews and follow up on the next satellite pass'}];
  return[]}),[wst,sel]);
 const notify=a=>{setToast(a);try{navigator.vibrate&&navigator.vibrate([200,100,200])}catch(e){}if(notifyOn&&'Notification' in window&&Notification.permission==='granted'){try{new Notification(a.title,{body:a.body+' · '+a.act})}catch(e){}}};
 const seen=useRef(new Set());
 useEffect(()=>{if(mode!=='fire'||sel!==N-1)return;alerts.forEach(a=>{if(seen.current.has(a.id))return;seen.current.add(a.id);notify(a)})},[alerts,mode,sel,notifyOn]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(null),9000);return()=>clearTimeout(t)},[toast]);
 useEffect(()=>{try{localStorage.setItem('ep-follow',JSON.stringify(follow))}catch(e){}},[follow]);
 const toggleNotify=()=>{if(notifyOn){setNotifyOn(false);return}setNotifyOn(true);if('Notification' in window&&Notification.permission==='default'){try{Notification.requestPermission().then(q=>setPerm(q))}catch(e){}}};
 const toggleFollow=id=>setFollow(a=>a.includes(id)?a.filter(x=>x!==id):[...a,id]);
 const zoomTo=w=>setFly({n:Date.now(),bb:w.bb}),openZone=w=>{setSelZone(w.id);zoomTo(w);setSide(true)};
 useEffect(()=>{if(selZone)setTab('dt')},[selZone]);
 useEffect(()=>{if(sideRef.current)sideRef.current.scrollTo({top:0})},[tab,selZone]);
 const alertsEl=h(React.Fragment,null,folN?null:h('div',{className:'mu'},'You aren\x27t following any area. Choose "Follow" on a watch area to get alerts'),
  folN&&!alerts.length?h('div',{className:'mu'},'No alerts on the selected day'):null,
  alerts.map(a=>h('div',{key:a.id,className:'card',style:{borderColor:LVC[a.lvl],background:'color-mix(in srgb,'+LVC[a.lvl]+' 12%,transparent)'}},h('b',{},a.title),h('div',{className:'mu'},a.body),h('div',null,'Suggested: '+a.act),h('div',{style:{display:'flex',gap:8}},h('button',{className:'btn g',onClick:()=>openZone(a.w)},'Details')))));
 const zd=useMemo(()=>{const w=wst.find(x=>x.id===selZone);if(!w)return null;const pts=zonePts(w.ring),sn=s==='H'?'V':s,hist=[];
  for(let i=Math.max(0,sel-13);i<=sel;i++)hist.push(zoneCalc(pts,w.ring,sn,i,minFrp));let fd=0;for(let i=Math.max(0,sel-89);i<=sel;i++)if(zoneCalc(pts,w.ring,sn,i,minFrp).cnt>0)fd++;
  const b=w.bb;return{w,hist,fd,cur:hist[hist.length-1],area:Math.round(Math.abs(b[2]-b[0])*111*Math.abs(b[3]-b[1])*111*Math.cos(w.cy*Math.PI/180))}},[selZone,wst,sel,s,minFrp]);
 const ADV=['Routine monitoring','Watch and re-check on the next satellite pass','Ready crews and water sources','Consider full monitoring'];
 const detailEl=zd?h('div',{className:'card',style:{borderColor:LVC[zd.cur.lvl],borderWidth:2}},
  h('div',{className:'kv'},h('b',{style:{fontSize:15}},zd.w.name),h('button',{className:'ib2',onClick:()=>{setSelZone(null);setTab('zn')},'aria-label':'Close details',title:'Close details'},h(Ic,{n:'clear'}))),
  h('div',{className:'mu'},zd.w.country+' · '+zd.w.cont+' · about '+zd.area.toLocaleString()+' km² · '+zd.w.cy.toFixed(2)+', '+zd.w.cx.toFixed(2)),
  h('div',{className:'kv'},h('b',{style:{color:LVC[zd.cur.lvl]}},'Risk level'+LVN[zd.cur.lvl]),h('b',{},zd.cur.risk+'/100')),
  h('div',{style:{height:8,borderRadius:4,background:'var(--ln)',overflow:'hidden'}},h('div',{style:{width:zd.cur.risk+'%',height:'100%',background:LVC[zd.cur.lvl]}})),
  [['Surface temperature',zd.cur.lst.toFixed(1)+'°C',zd.cur.t,.45],['Vegetation dryness (NDVI '+zd.cur.nd.toFixed(2)+')','',zd.cur.d,.35],['Fire activity',zd.cur.cnt+' detections',zd.cur.a,.2]].map(([t,v2,x,wt])=>h('div',{key:t},h('div',{className:'kv mu'},h('span',{},t+' '+v2),h('span',{},'+'+Math.round(x*wt*100)+' pts')),h('div',{style:{height:4,borderRadius:2,background:'var(--ln)',overflow:'hidden'}},h('div',{style:{width:Math.round(x*100)+'%',height:'100%',background:'var(--ac)'}})))),
  h('div',{className:'stat'},h('div',{},h('b',{},zd.cur.cnt),h('span',{className:'mu'},'Hotspots today')),h('div',{},h('b',{},zd.cur.cnt?zd.cur.mx.toFixed(1)+' MW':'—'),h('span',{className:'mu'},'Max FRP')),h('div',{},h('b',{},zd.fd+'/90'),h('span',{className:'mu'},'Fire days'))),
  h('div',{className:'mu'},'Last 14 days: line = risk index · bars = hotspots'),h(Spark,{hist:zd.hist}),
  h('div',null,'Suggested: '+(zd.cur.cnt?'Check the highest-FRP detections first and confirm with field reports':ADV[zd.cur.lvl])),
  h('button',{className:zd.w.fol?'btn g':'btn',onClick:()=>toggleFollow(zd.w.id),'aria-pressed':zd.w.fol},zd.w.fol?'Unfollow':'Follow this area'),
  h('div',{className:'mu'},'Area defined by the server · values from example data; supports decisions, does not replace field reports')):null;
 const conts=[...new Set(zones.map(z=>z.cont))],ctrs=[...new Set(zones.filter(z=>!fCont||z.cont===fCont).map(z=>z.country))],qs=fQuery.trim().toLowerCase();
 const fz=wst.filter(w=>(!fCont||w.cont===fCont)&&(!fCountry||w.country===fCountry)&&(!fFol||w.fol)&&(!qs||(w.name+' '+w.country+' '+w.cont).toLowerCase().includes(qs)));
 const zoomAll=()=>{if(!fz.length)return;setFly({n:Date.now(),bb:[Math.min(...fz.map(w=>w.bb[0])),Math.min(...fz.map(w=>w.bb[1])),Math.max(...fz.map(w=>w.bb[2])),Math.max(...fz.map(w=>w.bb[3]))]})};
 const notifyEl=h('div',{className:'card'},
   h('label',{className:'kv'},h('span',{},'Notifications on this device'),h('input',{type:'checkbox',checked:notifyOn,onChange:toggleNotify})),
   h('div',{className:'mu'},notifyOn?(perm==='granted'?'Can notify this device':perm==='denied'?'Notifications are blocked in the browser':perm==='unsupported'?'Not supported on this device':'Waiting for your permission')+' · always shown on this page':'Turn on to be notified about fire or high risk in followed areas'),
   h('div',{className:'mu'},'Example only: works while this page is open. A real system sends push, LINE or SMS from a server'),
   h('button',{className:'btn g',onClick:()=>notify({title:'Test notification',body:'If you can see this, device notifications work',act:'Sample message'})},'Send test'));
 const watchEl=h(React.Fragment,null,
  h('h2',{},'Watch areas ('+fz.length+'/'+wst.length+') · following '+folN),
  h('div',{className:'mu'},'Followed areas always show on the map · the pin button toggles the others · click an area on the map for details'),
  h('input',{type:'text',value:fQuery,placeholder:'Search by area, country or continent','aria-label':'Search watch areas',onChange:e=>setFQuery(e.target.value),style:{margin:'6px 0'}}),
  h('div',{style:{display:'flex',gap:8,margin:'0 0 6px'}},
   h('select',{value:fCont,'aria-label':'Continent',onChange:e=>{setFCont(e.target.value);setFCountry('')}},h('option',{value:''},'All continents'),conts.map(c=>h('option',{key:c,value:c},c))),
   h('select',{value:fCountry,'aria-label':'Country',onChange:e=>setFCountry(e.target.value)},h('option',{value:''},'All countries'),ctrs.map(c=>h('option',{key:c,value:c},c)))),
  h('div',{className:'kv'},h('label',{className:'kv',style:{gap:6}},h('input',{type:'checkbox',checked:fFol,onChange:e=>setFFol(e.target.checked)}),h('span',{},'Following only')),h('button',{className:'btn g',disabled:!fz.length,onClick:zoomAll},'Zoom to results')),
  zones.length?null:h('div',{className:'mu'},'Loading areas from the server…'),
  zones.length&&!fz.length?h('div',{className:'mu'},'No areas match'):null,
  [...fz].sort((a,b)=>(+b.fol-+a.fol)||(b.risk-a.risk)).map(w=>h('div',{key:w.id,className:'card',style:{borderLeft:'4px solid '+(w.fol?LVC[w.lvl]:'var(--ln)'),outline:w.id===selZone?'2px solid var(--ac)':'none'}},
   h('div',{className:'kv'},h('b',{},w.name),h('span',{style:{color:LVC[w.lvl],fontWeight:600}},LVN[w.lvl])),
   h('div',{className:'mu'},w.country+' · '+w.cont),
   h('div',{style:{height:6,borderRadius:3,background:'var(--ln)',overflow:'hidden'}},h('div',{style:{width:w.risk+'%',height:'100%',background:LVC[w.lvl]}})),
   h('div',{className:'mu'},'Risk index '+w.risk+'/100 · '+(w.cnt?w.cnt+' hotspots (max FRP '+w.mx.toFixed(1)+' MW)':'No hotspots')),
   h('div',{style:{display:'flex',gap:8}},h('button',{className:'btn g',onClick:()=>openZone(w)},'Details'),h('button',{className:w.fol?'btn g':'btn',onClick:()=>toggleFollow(w.id),'aria-pressed':w.fol},w.fol?'Unfollow':'Follow')))),
);
 const frpSum=hot.features.reduce((p,f)=>p+f.properties.frp,0),hiCnt=hot.features.filter(f=>f.properties.conf==='high').length,CF={high:'#ff3b30',nominal:'#ff9f0a',low:'#ffd60a'},CN={high:'High',nominal:'Moderate',low:'Low'};
 const productsEl=h(React.Fragment,null,h('h2',{},'Product used'),h('table',{},h('tbody',{},['M','V'].map(k=>h('tr',{key:k},h('td',{},h('span',{className:'dot',style:{background:SENS[k].c}}),SENS[k].n),h('td',{},V[k]?V[k][0]:'None'),h('td',{className:'mu'},V[k]?V[k][1]:'MODIS has no night-time band'))))));
 const ovEl=h(React.Fragment,null,
  h('div',{className:'card',style:{borderColor:'#d63b3b'}},h('div',{className:'kv'},h('b',{},'Latest data '+fmt(dateOf(N-1))),h('span',{className:'badge'},SENS[s].n)),h('div',{className:'mu'},s==='V'?'VIIRS fire data every ≤12 h (passes around 01:30 and 13:30) · 375 m detections':'Terra ~10:30 · Aqua ~13:30'),h('div',{className:'mu'},'Supports decisions, does not replace field reports. Small fires or fires under cloud or smoke may be missed')),
  h('div',{className:'stat'},h('div',{},h('b',{},hot.features.length.toLocaleString()),h('span',{className:'mu'},'Hotspots '+fmt(dateOf(sel)))),h('div',{},h('b',{},Math.round(frpSum).toLocaleString()+' MW'),h('span',{className:'mu'},'Total FRP')),h('div',{},h('b',{},hiCnt.toLocaleString()),h('span',{className:'mu'},'High confidence'))),
  h('div',{className:'card'},h('label',{className:'kv'},h('span',{},'High confidence only'),h('input',{type:'checkbox',checked:hiOnly,onChange:e=>setHiOnly(e.target.checked)})),h('label',{className:'kv'},h('span',{style:{whiteSpace:'nowrap'}},'Min FRP '+minFrp+' MW'),h('input',{type:'range',min:0,max:40,step:1,value:minFrp,onChange:e=>setMinFrp(+e.target.value),style:{accentColor:'#d63b3b',flex:1}})),h('div',{style:{display:'flex',gap:12,flexWrap:'wrap'}},Object.keys(CF).map(k=>h('span',{key:k,className:'mu'},h('span',{className:'cf',style:{background:CF[k]}}),' '+CN[k])))),
  h('h2',{},'Highest-FRP detections'),
  h('div',null,hot.features.slice(0,8).map((f,i)=>{const[g,a]=f.geometry.coordinates;return h('button',{key:i,className:'hsr',onClick:()=>setFly({n:Date.now(),lng:g,lat:a})},h('span',{className:'cf',style:{background:CF[f.properties.conf]}}),h('span',{},a.toFixed(2)+', '+g.toFixed(2)),h('b',{},f.properties.frp+' MW'),h('span',{className:'mu'},sel===N-1?'Seen '+(1+Math.floor(hs(g*3+a)*11))+' h ago':fmt(dateOf(sel))))})),
  hot.features.length?null:h('div',{className:'mu'},'No hotspots match'),
  productsEl);
 const chartCalEl=h(React.Fragment,null,h(Chart,{series,lo,hi,sel,setSel,v,focus:s}),h('h2',{},'History calendar · '+SENS[s].n),h(Calendar,{vals:cur,lo,hi,v,sel,setSel}),h('div',{className:'mu'},'Click a date or use the arrow keys to change the map day. Empty cells have no data, e.g. MODIS has no night-time lights'));
 const TABS=[['ov','fire','Fire overview'],['zn','pin','Watch areas'],['al','bell','Alerts'],['dt','info','Area details'],['tr','chart','Trend and calendar']];
 const tabEl={ov:ovEl,zn:watchEl,al:h(React.Fragment,null,h('h2',{style:{marginTop:0}},'Alerts'),alertsEl,notifyEl),dt:detailEl||h('div',{className:'mu'},'Select an area on the map, or choose "Details" in the watch-area list'),tr:h(React.Fragment,null,h('h2',{style:{marginTop:0}},'Trend (at the centre of the viewed area)'),chartCalEl)}[tab];
 const SH={ndvi:'NDVI',lst:'LST',fire:'Fire (FRP)',ntl:'Night-time lights'};
 return h('div',{className:'app',style:{'--sw':sideW+'px'}},
  side?h('aside',{className:'pn side'+(mode==='fire'?' fire':'')},
   mode==='fire'?h('nav',{className:'rail',role:'tablist','aria-orientation':'vertical','aria-label':'Detail sections'},TABS.map(([k,ic,t])=>h('button',{key:k,className:'rt',role:'tab','aria-selected':tab===k,title:t,'aria-label':t,onClick:()=>setTab(k)},h(Ic,{n:ic,s:18}),k==='al'&&alerts.length?h('span',{className:'bd'},alerts.length):null))):null,
   h('div',{className:'sbody',ref:sideRef},
   h('div',{className:'sh'},h('h1',{},'Earth Pulse'),h('button',{className:'ib2',onClick:()=>setSide(false),title:'Collapse the chart and calendar panel','aria-label':'Collapse the chart and calendar panel','aria-expanded':true},h('span',{className:'chev o'},h(Ic,{n:'chev'})))),h('div',{className:'mu'},'Explore MODIS and VIIRS history for the area you draw'),h('span',{className:'badge'},'Simulated data'),
   mode==='fire'?tabEl:null,
   mode==='sci'?h(React.Fragment,null,
   h('h2',{},'History · '+V.n+' · '+(aoi?'Drawn area':'Global')),
   h('div',{className:'mu'},fmt(dateOf(lo))+' to '+fmt(dateOf(hi))+' ('+(hi-lo+1)+' days)'),h('div',{className:'stat'},
    h('div',{},h('b',{},now==null?'—':now.toFixed(V.d)+' '+V.u),h('span',{className:'mu'},SENS[s].n+' on '+fmt(dateOf(sel)))),
    h('div',{},h('b',{},avg==null?'—':avg.toFixed(V.d)+' '+V.u),h('span',{className:'mu'},'Period mean')),
    h('div',{},h('b',{},ok.length?Math.min(...ok).toFixed(V.d)+' – '+Math.max(...ok).toFixed(V.d):'—'),h('span',{className:'mu'},'Min – max'))),
   h('div',{style:{display:'flex',gap:14,flexWrap:'wrap'}},['M','V','H'].map(k=>h('span',{key:k,className:'mu'},h('span',{className:'dot',style:{background:SENS[k].c}}),SENS[k].n))),
   h('div',{title:V.n+' · '+SENS[s].n+' · '+note,style:{margin:'10px 0 2px'}},
    h('div',{className:'ramp',style:{margin:0,background:`linear-gradient(90deg,${[0,.25,.5,.75,1].map(t=>color(t)).join()})`}}),
    h('div',{className:'mu',style:{display:'flex',justifyContent:'space-between'}},h('span',{},V.min),h('span',{},+((V.min+V.max)/2).toFixed(2)),h('span',{},V.max+' '+V.u))),
   sciCards):null,
   mode==='sci'?chartCalEl:null,
   mode==='sci'?productsEl:null))
  :h('aside',{className:'pn side shut'},h('button',{className:'shutbtn',onClick:()=>setSide(true),title:'Show chart and calendar','aria-label':'Show chart and calendar','aria-expanded':false},h(Ic,{n:'chart',s:18}),h('span',{className:'lbl'},'Chart and calendar'),h('span',{className:'chev s'},h(Ic,{n:'chev'})))),
  side?h('div',{className:'rz'+(rzOn?' on':''),role:'separator','aria-orientation':'vertical','aria-label':'Resize the chart and calendar panel','aria-valuenow':sideW,tabIndex:0,title:'Drag to resize (double-click to reset)',
   onPointerDown:e=>{e.currentTarget.setPointerCapture(e.pointerId);setRzOn(true)},
   onPointerMove:e=>{if(e.buttons&1)setSideW(clamp(Math.round(e.clientX-12),300,Math.max(320,Math.min(900,window.innerWidth-220))))},
   onPointerUp:()=>setRzOn(false),onDoubleClick:()=>setSideW(460),
   onKeyDown:e=>{if(e.key==='ArrowLeft')setSideW(w=>clamp(w-24,300,900));if(e.key==='ArrowRight')setSideW(w=>clamp(w+24,300,Math.max(320,Math.min(900,window.innerWidth-220))))}}):null,
  h('main',{className:'mapwrap'},
   h(MapView,{aoi,setAoi,heat,drawReq:req,hot,fireMode:mode==='fire',fly,watchFC,onZone:id=>{setSelZone(id);setSide(true)},selZone}),
   h('div',{className:'ov',style:{top:10,left:10,right:10}},
    h('div',{className:'tb'},h('div',{className:'seg','aria-label':'View'},[['sci','flask','Scientist view'],['fire','fire','Firefighter view']].map(([k,ic,t])=>h('button',{key:k,className:mode===k?'on':'',style:mode===k&&k==='fire'?{'--c':'#d63b3b'}:null,onClick:()=>switchMode(k),'aria-pressed':mode===k,title:t,'aria-label':t},h(Ic,{n:ic}))))),
    mode==='fire'?null:P({id:'tools',icon:'draw',title:'Area of interest'},drawing?B('clear','Cancel drawing',()=>{setDrawing(false);cmd('cancel')},'btn dng'):B('draw','Draw polygon',()=>{setDrawing(true);cmd('draw')},'btn'),B('clear','Clear',()=>{setDrawing(false);cmd('clear')},'btn g')),
    P({id:'sensor',icon:'sM',title:'Sensor'},h('div',{className:'seg','aria-label':'Sensor'},Object.keys(SENS).filter(k=>mode==='sci'||k!=='H').map(k=>h('button',{key:k,className:s===k?'on':'',style:{'--c':SENS[k].c},onClick:()=>setS(k),'aria-pressed':s===k,title:SENS[k].n,'aria-label':SENS[k].n},h(Ic,{n:'s'+k}))))),
    mode==='fire'?null:P({id:'vr',icon:'ndvi',title:'Variable'},h('div',{className:'seg','aria-label':'Variable'},Object.keys(VARS).map(k=>h('button',{key:k,className:v===k?'on':'',onClick:()=>setV(k),'aria-pressed':v===k,title:VARS[k].n,'aria-label':VARS[k].n},h(Ic,{n:k}))))),
    mode==='fire'?h('div',{className:'tb'},h('button',{className:'ib2','aria-pressed':showZones,title:showZones?'Hide watch areas':'Show watch areas','aria-label':'Show or hide watch areas',onClick:()=>setShowZones(x=>!x)},h(Ic,{n:'pin'}))):null,
    h('div',{className:'tb',style:{marginLeft:'auto'}},
     h('button',{className:'ib2',title:anyOpen?'Collapse all panels':'Show all panels','aria-label':anyOpen?'Collapse all panels':'Show all panels',onClick:()=>setOpen(Object.fromEntries(Object.keys(open).map(k=>[k,!anyOpen])))},h(Ic,{n:'shrink'})))),
   toast?h('div',{className:'toast',role:'alert'},h('div',{},h('b',{},toast.title),h('div',{style:{fontSize:12}},toast.body)),h('button',{className:'ib2',style:{color:'#fff',borderColor:'rgba(255,255,255,.5)'},onClick:()=>setToast(null),'aria-label':'Close'},h(Ic,{n:'clear'}))):null,
   h('div',{className:'ov',style:{bottom:10,left:10,right:10,flexWrap:'nowrap',alignItems:'stretch'}},
    P({id:'time',icon:'clock',title:'Period',style:{flex:'1 1 0',minWidth:0,flexWrap:'wrap',gap:8}},
     h('div',{className:'tbr'}),
     h('div',{className:'seg tps','aria-label':'Period'},Object.keys(PRE).map(k=>h('button',{key:k,className:rg.pre===k?'on':'',title:PRE[k][0],'aria-label':PRE[k][0],onClick:()=>setRange(...PRE[k][1](),k)},{lm:'-1M',d30:'30d',d90:'90d',y1:'1Y',d3:'3d',d7:'7d'}[k]))),
     h('input',{type:'date',className:'tdi',value:fmt(dateOf(lo)),min:dmin,max:dmax,onChange:e=>{const t=Date.parse(e.target.value);if(!isNaN(t))setRange(ix(t),hi,'')},'aria-label':'Start date'}),
     h('span',{className:'mu tdi'},'–'),h('input',{type:'date',className:'tdi',value:fmt(dateOf(hi)),min:dmin,max:dmax,onChange:e=>{const t=Date.parse(e.target.value);if(!isNaN(t))setRange(lo,ix(t),'')},'aria-label':'End date'}),
     B(playing?'pause':'play',playing?'Pause':'Play',()=>setPlaying(p=>!p),'btn g tpl'),
     h('input',{type:'range',className:'tsl',min:lo,max:hi,step:1,value:sel,onChange:e=>setSel(+e.target.value),style:{accentColor:'var(--ac)'},'aria-label':'Step through dates in the period'}),
     h('b',{className:'tdt'},fmt(dateOf(sel)))))));
}


export default function Explorer(){
 const [ready,setReady]=React.useState(!!LAND),[err,setErr]=React.useState(null);
 React.useEffect(()=>{if(!ready)loadGeo().then(()=>setReady(true)).catch(e=>setErr(String(e)))},[]);
 return h('div',{className:'ep-root'},
  ready?h(App):h('div',{style:{padding:24}},err?'Could not load the map: '+err:'Loading map…'),
  h(Link,{to:'/',className:'ep-back',title:'Back to FireCalendar+'},'← FireCalendar+'));
}
