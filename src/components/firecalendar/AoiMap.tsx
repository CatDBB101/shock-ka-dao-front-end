// Real basemap (OpenStreetMap vector tiles via OpenFreeMap + optional Esri satellite imagery),
// place search, and press-and-drag to draw a hexagon AOI. Lazy-loaded (maplibre is large).
import { useEffect, useRef, useState, type FormEvent } from "react";
import maplibregl, { type GeoJSONSource, type MapMouseEvent, type MapTouchEvent } from "maplibre-gl";
import { cellToBoundary } from "h3-js";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Box } from "../../lib/firecalendar";
import { HEX_MAX_KM, HEX_MIN_KM, haversineKm, hexagonRing, type Hexagon, type LonLat } from "../../lib/firecalendar";
import { searchPlaces, type Place } from "../../lib/geocode";

const STYLE = "https://tiles.openfreemap.org/styles/fiord";
const SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export interface AoiMapProps {
  hexagon: Hexagon | null;
  /** bbox AOI (form / example areas) — drawn as a rectangle when there is no hexagon */
  box: Box | null;
  /** H3 cells of the current result, drawn as outlines */
  cells?: string[];
  onHexagon: (h: Hexagon) => void;
}

const OWN_LAYERS = new Set(["sat", "cells-line", "aoi-fill", "aoi-line", "draft-fill", "draft-line"]);
const PLACE_MIN_KM = 50;

/** id of the first symbol layer that comes after all non-symbol base layers (or undefined = top) */
function firstSymbolAbove(map: maplibregl.Map): string | undefined {
  const layers = map.getStyle().layers.filter((l) => !OWN_LAYERS.has(l.id));
  const lastBase = layers.map((l) => l.type !== "symbol").lastIndexOf(true);
  const sym = layers.slice(lastBase + 1).find((l) => l.type === "symbol");
  // keep imagery under our overlays
  return sym?.id ?? "cells-line";
}

const clampR = (km: number) => Math.min(HEX_MAX_KM, Math.max(HEX_MIN_KM, km));
const polygonFC = (ring: LonLat[]): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }],
});
const boxRing = (b: Box): LonLat[] => [
  [b.minLon, b.minLat],
  [b.maxLon, b.minLat],
  [b.maxLon, b.maxLat],
  [b.minLon, b.maxLat],
  [b.minLon, b.minLat],
];

export default function AoiMap({ hexagon, box, cells, onHexagon }: AoiMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [mapErr, setMapErr] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [satellite, setSatellite] = useState(false);
  const [liveKm, setLiveKm] = useState<number | null>(null);
  const drawingRef = useRef(false);
  const onHexRef = useRef(onHexagon);
  onHexRef.current = onHexagon;
  drawingRef.current = drawing;

  // ---- create map once
  useEffect(() => {
    if (!el.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: el.current,
        style: STYLE,
        center: hexagon ? [hexagon.lon, hexagon.lat] : box ? [(box.minLon + box.maxLon) / 2, (box.minLat + box.maxLat) / 2] : [-40, -10],
        zoom: hexagon || box ? 5 : 1.6,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
      });
    } catch (e) {
      setMapErr(e instanceof Error ? e.message : String(e)); // e.g. WebGL unavailable
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    map.touchZoomRotate.disableRotation();
    map.on("error", (e) => console.warn("map:", e.error?.message));

    map.on("load", () => {
      map.addSource("sat", { type: "raster", tiles: [SATELLITE], tileSize: 256, maxzoom: 18, attribution: "Imagery © Esri, Maxar, Earthstar Geographics" });
      for (const id of ["aoi", "cells", "draft"]) map.addSource(id, { type: "geojson", data: EMPTY });
      map.addLayer({ id: "cells-line", type: "line", source: "cells", paint: { "line-color": "#ff7a2f", "line-width": 1.2, "line-opacity": 0.9 } });
      map.addLayer({ id: "aoi-fill", type: "fill", source: "aoi", paint: { "fill-color": "#d4471f", "fill-opacity": 0.12 } });
      map.addLayer({ id: "aoi-line", type: "line", source: "aoi", paint: { "line-color": "#d4471f", "line-width": 2.5 } });
      map.addLayer({ id: "draft-fill", type: "fill", source: "draft", paint: { "fill-color": "#1b7fb5", "fill-opacity": 0.15 } });
      map.addLayer({ id: "draft-line", type: "line", source: "draft", paint: { "line-color": "#1b7fb5", "line-width": 2, "line-dasharray": [2, 1] } });
      // satellite sits above every base layer but below labels and our overlays
      map.addLayer({ id: "sat", type: "raster", source: "sat", layout: { visibility: "none" } }, firstSymbolAbove(map));
      setReady(true);
    });

    // ---- press-and-drag hexagon: press = centre, drag = radius
    let centre: LonLat | null = null;
    const draft = () => map.getSource("draft") as GeoJSONSource | undefined;
    const start = (e: MapMouseEvent | MapTouchEvent) => {
      if (!drawingRef.current) return;
      if ("points" in e && e.points.length !== 1) return;
      e.preventDefault();
      centre = [e.lngLat.lng, e.lngLat.lat];
      map.dragPan.disable();
    };
    const move = (e: MapMouseEvent | MapTouchEvent) => {
      if (!centre) return;
      const km = clampR(haversineKm(centre, [e.lngLat.lng, e.lngLat.lat]));
      setLiveKm(km);
      draft()?.setData(polygonFC(hexagonRing({ lon: centre[0], lat: centre[1], radiusKm: km })));
    };
    const end = (e: MapMouseEvent | MapTouchEvent) => {
      if (!centre) return;
      const km = haversineKm(centre, [e.lngLat.lng, e.lngLat.lat]);
      const c = centre;
      centre = null;
      map.dragPan.enable();
      draft()?.setData(EMPTY);
      setLiveKm(null);
      if (km < 1) return; // a click, not a drag
      setDrawing(false);
      onHexRef.current({ lat: c[1], lon: c[0], radiusKm: clampR(km) });
    };
    map.on("mousedown", start);
    map.on("touchstart", start);
    map.on("mousemove", move);
    map.on("touchmove", move);
    map.on("mouseup", end);
    map.on("touchend", end);
    return () => map.remove();
    // create once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- cursor + satellite toggle
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    m.getCanvas().style.cursor = drawing ? "crosshair" : "";
  }, [drawing]);
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    m.setLayoutProperty("sat", "visibility", satellite ? "visible" : "none");
    // base fills/lines would show through gaps; hide them under the imagery (labels stay)
    for (const l of m.getStyle().layers) {
      if (OWN_LAYERS.has(l.id) || l.type === "symbol" || l.type === "background") continue;
      m.setLayoutProperty(l.id, "visibility", satellite ? "none" : "visible");
    }
  }, [satellite, ready]);

  // ---- AOI outline + fit
  const aoiKey = hexagon ? `h${hexagon.lat},${hexagon.lon},${hexagon.radiusKm}` : box ? `b${box.minLat},${box.minLon},${box.maxLat},${box.maxLon}` : "";
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    const ring = hexagon ? hexagonRing(hexagon) : box ? boxRing(box) : null;
    (m.getSource("aoi") as GeoJSONSource).setData(ring ? polygonFC(ring) : EMPTY);
    if (ring) {
      const lons = ring.map((p) => p[0]);
      const lats = ring.map((p) => p[1]);
      m.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 40, duration: 600, maxZoom: 10 });
    }
    // keyed on aoiKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aoiKey, ready]);

  // ---- H3 cell outlines of the result
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    const fc: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: (cells ?? []).slice(0, 5000).map((h) => ({
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [cellToBoundary(h, true)] },
      })),
    };
    (m.getSource("cells") as GeoJSONSource).setData(fc);
  }, [cells, ready]);

  // ---- place search
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const search = async (e: FormEvent) => {
    e.preventDefault();
    setSearching(true);
    setSearchErr(null);
    try {
      setResults(await searchPlaces(q));
    } catch (x) {
      setSearchErr(x instanceof Error ? x.message : String(x));
    } finally {
      setSearching(false);
    }
  };
  const flyTo = (p: Place) => {
    const [s, n, w, ea] = p.bbox;
    mapRef.current?.fitBounds([[w, s], [ea, n]], { padding: 40, duration: 800, maxZoom: 11 });
  };
  const useAsHexagon = (p: Place) => {
    const [s, n, w, ea] = p.bbox;
    // a city outline is ~10 km → only 1–2 H3 cells (~250 km² each); use at least PLACE_MIN_KM
    const km = clampR(Math.max(PLACE_MIN_KM, Math.max(haversineKm([w, p.lat], [ea, p.lat]), haversineKm([p.lon, s], [p.lon, n])) / 2));
    setResults(null);
    onHexagon({ lat: p.lat, lon: p.lon, radiusKm: km });
  };

  return (
    <div className="stack">
      <div className="row">
        <form onSubmit={search} className="row" style={{ flex: "1 1 320px" }} role="search">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a place, e.g. Rosario, Mato Grosso, Alberta"
            aria-label="Search for a place on the map"
            style={{ flex: 1, minWidth: 0 }}
          />
          <button className="btn ghost" type="submit" disabled={searching || !q.trim()}>
            {searching ? "Searching…" : "Search"}
          </button>
        </form>
        <button className={`btn${drawing ? " primary" : ""}`} type="button" aria-pressed={drawing} onClick={() => setDrawing((d) => !d)} disabled={!ready}>
          {drawing ? "Cancel drawing" : "Draw hexagon"}
        </button>
        <div className="tabs" role="group" aria-label="Basemap">
          <button type="button" aria-pressed={!satellite} onClick={() => setSatellite(false)}>
            Map
          </button>
          <button type="button" aria-pressed={satellite} onClick={() => setSatellite(true)}>
            Satellite
          </button>
        </div>
      </div>

      {searchErr && <p className="error" role="alert">{searchErr}</p>}
      {results && (
        <div className="panel" style={{ padding: 8 }}>
          {results.length === 0 ? (
            <p className="small muted" style={{ margin: 4 }}>No places found</p>
          ) : (
            <ul className="place-list">
              {results.map((p) => (
                <li key={`${p.lat},${p.lon},${p.name}`}>
                  <span className="small">{p.name}</span>
                  <span className="row">
                    <button type="button" className="btn ghost" onClick={() => flyTo(p)}>Go here</button>
                    <button type="button" className="btn ghost" onClick={() => useAsHexagon(p)}>Use as area</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="small muted" style={{ margin: "4px 4px 0" }}>Search by OpenStreetMap Nominatim</p>
        </div>
      )}

      <div className="aoi-map-wrap">
        <div ref={el} className="aoi-map" role="application" aria-label="Map. Press Draw hexagon, then press and hold at the centre and drag outward to set the size" />
        {mapErr && <div className="aoi-map-msg alert">The map can't run in this browser ({mapErr}). Use the coordinate form below instead</div>}
        {drawing && (
          <div className="aoi-map-hint" role="status">
            {liveKm ? `Radius ${Math.round(liveKm).toLocaleString("en-US")} km` : "Press and hold at the centre, then drag outward to size the hexagon"}
          </div>
        )}
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Selects the H3 data cells whose centres fall inside the hexagon (orange outline) · radius {HEX_MIN_KM}–{HEX_MAX_KM} km · data available only for{" "}
        Angola, Argentina, Brazil, Canada, the United States and Australia
      </p>
    </div>
  );
}
