// 3D terrain map for the simulator: satellite imagery draped on the Terrarium DEM, the burned area as an
// animated canvas layer, the burning front as extruded flame columns (height ∝ flame length).
import { useEffect, useRef, useState } from "react";
import maplibregl, { type CanvasSource, type GeoJSONSource, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { cellLonLat, gridCorners, type GridGeo } from "../../lib/spread/inputs";
import { arrivalBand, flameAtCell, frontCells, localRos } from "../../lib/spread/playback";
import { cellRing, type LonLat } from "../../lib/spread/run";
import { BURN_BANDS, CROWN_FLAME, FLAME_STOPS, flameVertical, TREE_COLOUR, treeVertical, type SimFrameRun } from "./legend";
import { hasCanopy } from "../../lib/spread/crown";

const SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const TERRARIUM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
export interface Sim3DMapProps {
  tool: "ignite" | "break";
  ignition: LonLat | null;
  firebreaks: LonLat[][];
  draft: LonLat[];
  onPick: (p: LonLat) => void;
  domain: GridGeo | null;
  run: SimFrameRun | null;
  tMin: number;
  exaggeration: number;
  showTrees: boolean;
}

const style: StyleSpecification = {
  version: 8,
  sources: {
    sat: { type: "raster", tiles: [SATELLITE], tileSize: 256, maxzoom: 18, attribution: "Imagery © Esri, Maxar, Earthstar Geographics" },
    dem: { type: "raster-dem", tiles: [TERRARIUM], encoding: "terrarium", tileSize: 256, maxzoom: 14, attribution: "Terrain: Mapzen / AWS Terrain Tiles" },
    hill: { type: "raster-dem", tiles: [TERRARIUM], encoding: "terrarium", tileSize: 256, maxzoom: 14 },
  },
  layers: [
    { id: "sat", type: "raster", source: "sat" },
    { id: "hill", type: "hillshade", source: "hill", paint: { "hillshade-exaggeration": 0.3, "hillshade-shadow-color": "#0b1620" } },
  ],
  terrain: { source: "dem", exaggeration: 1.5 },
};

const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** Square ring of side `cells` grid cells centred on fractional cell (cx, cy). */
function blockRing(geo: GridGeo, cx: number, cy: number, cells: number): LonLat[] {
  const h = cells / 2;
  const a = cellLonLat(geo, cx - h, cy - h);
  const b = cellLonLat(geo, cx + h, cy + h);
  return [a, [b[0], a[1]], b, [a[0], b[1]], a];
}

export default function Sim3DMap(p: Sim3DMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pickRef = useRef(p.onPick);
  pickRef.current = p.onPick;
  const startRef = useRef(p.ignition);

  useEffect(() => {
    if (!el.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: el.current,
        style,
        center: startRef.current ?? [17.5, -12.4],
        zoom: startRef.current ? 11 : 9,
        pitch: 62,
        bearing: -25,
        maxPitch: 80,
        attributionControl: { compact: true },
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.getCanvas().style.cursor = "crosshair";
    map.on("load", () => {
      const c = document.createElement("canvas");
      c.width = 2;
      c.height = 2;
      canvasRef.current = c;
      for (const id of ["dom", "breaks", "draft", "ign", "flames", "trees"]) map.addSource(id, { type: "geojson", data: empty });
      map.addLayer({ id: "dom", type: "line", source: "dom", paint: { "line-color": "#f9b26b", "line-width": 1.2, "line-dasharray": [3, 2] } });
      map.addLayer({
        id: "trees",
        type: "fill-extrusion",
        source: "trees",
        paint: { "fill-extrusion-height": ["get", "h"], "fill-extrusion-color": TREE_COLOUR.live, "fill-extrusion-opacity": 0.85 },
      });
      map.addLayer({
        id: "flames",
        type: "fill-extrusion",
        source: "flames",
        paint: {
          "fill-extrusion-height": ["*", ["get", "flame"], ["get", "vert"]],
          "fill-extrusion-base": 0,
          "fill-extrusion-color": ["interpolate", ["linear"], ["get", "flame"], ...FLAME_STOPS.flat()] as unknown as maplibregl.ExpressionSpecification,
          "fill-extrusion-opacity": 0.92,
        },
      });
      map.addLayer({ id: "breaks", type: "line", source: "breaks", paint: { "line-color": "#4cc9f0", "line-width": 4 } });
      map.addLayer({ id: "draft", type: "line", source: "draft", paint: { "line-color": "#4cc9f0", "line-width": 3, "line-dasharray": [2, 1] } });
      map.addLayer({ id: "ign", type: "circle", source: "ign", paint: { "circle-radius": 7, "circle-color": "#ff2a00", "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
      setReady(true);
    });
    map.on("click", (e) => pickRef.current([e.lngLat.lng, e.lngLat.lat]));
    return () => map.remove();
  }, []);

  useEffect(() => {
    const m = mapRef.current;
    if (m && ready) m.setTerrain({ source: "dem", exaggeration: p.exaggeration });
  }, [p.exaggeration, ready]);

  // ignition, firebreaks, draft line, domain outline
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    (m.getSource("ign") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: p.ignition ? [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: p.ignition } }] : [],
    });
    (m.getSource("breaks") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: p.firebreaks.filter((l) => l.length > 1).map((l) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: l } })),
    });
    (m.getSource("draft") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: p.draft.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: p.draft } }] : [],
    });
    const g = p.run?.geo ?? p.domain;
    const ring = g ? [...gridCorners(g), gridCorners(g)[0]] : null;
    (m.getSource("dom") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: ring ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: ring } }] : [],
    });
    m.getCanvas().style.cursor = p.tool === "break" ? "copy" : "crosshair";
  }, [p.ignition, p.firebreaks, p.draft, p.domain, p.run, p.tool, ready]);

  // a new run: size the canvas, (re)create the draped canvas source, fly to an oblique view
  useEffect(() => {
    const m = mapRef.current;
    const c = canvasRef.current;
    if (!m || !ready || !c) return;
    if (m.getLayer("burn")) m.removeLayer("burn");
    if (m.getSource("burn")) m.removeSource("burn");
    if (!p.run) return;
    c.width = p.run.geo.n;
    c.height = p.run.geo.n;
    m.addSource("burn", { type: "canvas", canvas: c, coordinates: gridCorners(p.run.geo), animate: true });
    m.addLayer({ id: "burn", type: "raster", source: "burn", paint: { "raster-opacity": 0.82, "raster-resampling": "nearest" } }, "flames");
    const [nw, , se] = gridCorners(p.run.geo);
    m.fitBounds([nw, se], { padding: 30, pitch: 62, bearing: m.getBearing(), duration: 900 });
    (m.getSource("burn") as CanvasSource).play();

    // 3D trees from the canopy height model: one column per s×s block of cells (keeps it to ~8k columns)
    const cp = p.run.canopy;
    const feats: GeoJSON.Feature[] = [];
    if (cp) {
      const { n } = p.run.geo;
      let forest = 0;
      for (let i = 0; i < n * n; i++) if (hasCanopy(cp.height[i]!, cp.cover[i]!)) forest++;
      const s = Math.max(1, Math.ceil(Math.sqrt(forest / 8000)));
      const tv = treeVertical(p.run.geo.cell);
      for (let y = 0; y < n; y += s)
        for (let x = 0; x < n; x += s) {
          const i = y * n + x;
          if (!hasCanopy(cp.height[i]!, cp.cover[i]!)) continue;
          const a = p.run.arrival[i]!;
          const half = (s - 1) / 2;
          const ring = blockRing(p.run.geo, x + half, y + half, s * Math.sqrt(Math.min(1, cp.cover[i]!)));
          feats.push({
            type: "Feature",
            properties: { h: Math.round(cp.height[i]! * tv), arr: Number.isFinite(a) ? Math.round(a) : 1e9, crown: p.run.crown?.[i] ?? 0 },
            geometry: { type: "Polygon", coordinates: [ring] },
          });
        }
    }
    (m.getSource("trees") as GeoJSONSource).setData({ type: "FeatureCollection", features: feats });
  }, [p.run, ready]);

  useEffect(() => {
    const m = mapRef.current;
    if (m && ready) m.setLayoutProperty("trees", "visibility", p.showTrees ? "visible" : "none");
  }, [p.showTrees, ready]);

  // one frame: burned area up to t + flame columns on the current front
  useEffect(() => {
    const m = mapRef.current;
    const c = canvasRef.current;
    const r = p.run;
    if (!m || !ready || !c || !r) return;
    const { n, cell } = r.geo;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(n, n);
    for (let i = 0; i < n * n; i++) {
      const a = r.arrival[i]!;
      if (a > p.tMin) continue;
      const rgb = BURN_BANDS[arrivalBand(a, r.durationMin, BURN_BANDS.length)]!;
      img.data[i * 4] = rgb[0];
      img.data[i * 4 + 1] = rgb[1];
      img.data[i * 4 + 2] = rgb[2];
      img.data[i * 4 + 3] = 215;
    }
    ctx.putImageData(img, 0, 0);

    // trees: burned once the fire has reached them; active crown fire leaves snags at half height
    const T = p.tMin;
    m.setPaintProperty("trees", "fill-extrusion-color", ["case", ["<=", ["get", "arr"], T], TREE_COLOUR.burned, TREE_COLOUR.live]);
    m.setPaintProperty("trees", "fill-extrusion-height", [
      "case",
      ["all", ["<=", ["get", "arr"], T], [">=", ["get", "crown"], 2]],
      ["*", ["get", "h"], 0.5],
      ["get", "h"],
    ]);

    const h = r.hourly[Math.min(r.hourly.length - 1, Math.floor(p.tMin / 60))];
    const windowMin = Math.min(90, Math.max(20, r.durationMin / 48));
    const front = p.tMin > 0 && h ? frontCells(r.arrival, p.tMin, windowMin) : [];
    // cap the number of columns so huge fronts stay smooth (keep every k-th cell)
    const step = Math.max(1, Math.ceil(front.length / 6000));
    const vert = flameVertical(cell);
    const feats: GeoJSON.Feature[] = [];
    for (let k = 0; k < front.length; k += step) {
      const i = front[k]!;
      const surface = flameAtCell(localRos(r.arrival, n, cell, i), h!.rMax, h!.flameM);
      const cs = r.crown?.[i] ?? 0;
      const flame = cs === 0 ? surface : Math.min(CROWN_FLAME.capM, surface * (cs === 2 ? CROWN_FLAME.active : CROWN_FLAME.passive));
      feats.push({ type: "Feature", properties: { flame: Math.round(flame * 10) / 10, vert }, geometry: { type: "Polygon", coordinates: [cellRing(r.geo, i)] } });
    }
    (m.getSource("flames") as GeoJSONSource).setData({ type: "FeatureCollection", features: feats });
  }, [p.run, p.tMin, ready]);

  if (err) return <p className="alert small">Can't show the 3D map ({err}). The browser needs WebGL</p>;
  return (
    <div className="aoi-map-wrap">
      <div ref={el} className="aoi-map sim-map" role="region" aria-label="3D terrain map. Click to place the ignition or firebreak points" />
      {!ready && (
        <p className="aoi-map-hint" role="status">
          Loading 3D terrain…
        </p>
      )}
      {ready && !p.ignition && <p className="aoi-map-hint">Click the map to place the ignition · right-drag or Ctrl+drag to rotate and tilt</p>}
    </div>
  );
}
