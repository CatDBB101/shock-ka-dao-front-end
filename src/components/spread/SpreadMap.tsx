// Map for the spread simulator: click to place the ignition; shows the result raster.
import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type ImageSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { gridCorners, type GridGeo } from "../../lib/spread/inputs";

const STYLE = "https://tiles.openfreemap.org/styles/fiord";

export interface SpreadMapProps {
  ignition: [number, number] | null;
  /** extra ignition points (satellite hotspots) */
  hotspots: [number, number][];
  onPick: (lonLat: [number, number]) => void;
  /** data URL of the result raster + its grid */
  overlay: { url: string; geo: GridGeo } | null;
  /** grid outline before a run */
  domain: GridGeo | null;
}

export default function SpreadMap({ ignition, hotspots, onPick, overlay, domain }: SpreadMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const startRef = useRef(ignition); // opened from a watchpoint link → start zoomed in there

  useEffect(() => {
    if (!el.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({ container: el.current, style: STYLE, center: startRef.current ?? [-62, -32], zoom: startRef.current ? 9 : 4, attributionControl: { compact: true }, dragRotate: false });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.touchZoomRotate.disableRotation();
    map.getCanvas().style.cursor = "crosshair";
    map.on("load", () => {
      const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
      map.addSource("dom", { type: "geojson", data: empty });
      map.addSource("ign", { type: "geojson", data: empty });
      map.addLayer({ id: "dom", type: "line", source: "dom", paint: { "line-color": "#f9b26b", "line-width": 1.2, "line-dasharray": [3, 2] } });
      map.addLayer({
        id: "ign",
        type: "circle",
        source: "ign",
        paint: { "circle-radius": ["case", ["get", "main"], 7, 3.5], "circle-color": "#ff2a00", "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 },
      });
      setReady(true);
    });
    map.on("click", (e) => pickRef.current([e.lngLat.lng, e.lngLat.lat]));
    return () => map.remove();
  }, []);

  // ignition + hotspots
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    const feats: GeoJSON.Feature[] = hotspots.map((c) => ({ type: "Feature", properties: { main: false }, geometry: { type: "Point", coordinates: c } }));
    if (ignition) feats.push({ type: "Feature", properties: { main: true }, geometry: { type: "Point", coordinates: ignition } });
    (m.getSource("ign") as GeoJSONSource).setData({ type: "FeatureCollection", features: feats });
  }, [ignition, hotspots, ready]);

  // domain outline
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    const g = overlay?.geo ?? domain;
    const ring = g ? [...gridCorners(g), gridCorners(g)[0]] : null;
    (m.getSource("dom") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: ring ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: ring } }] : [],
    });
  }, [domain, overlay, ready]);

  // result raster
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    if (!overlay) {
      if (m.getLayer("res")) m.removeLayer("res");
      if (m.getSource("res")) m.removeSource("res");
      return;
    }
    const coordinates = gridCorners(overlay.geo);
    const src = m.getSource("res") as ImageSource | undefined;
    if (src) src.updateImage({ url: overlay.url, coordinates });
    else {
      m.addSource("res", { type: "image", url: overlay.url, coordinates });
      m.addLayer({ id: "res", type: "raster", source: "res", paint: { "raster-opacity": 0.78, "raster-resampling": "nearest" } }, "dom");
    }
    const [nw, , se] = coordinates;
    m.fitBounds([nw, se], { padding: 40, duration: 600 });
  }, [overlay, ready]);

  if (err) return <p className="alert small">Can't show the map ({err})</p>;
  return (
    <div className="aoi-map-wrap">
      <div ref={el} className="aoi-map" role="region" aria-label="Fire spread map. Click to place the ignition" />
      {!ready && (
        <p className="aoi-map-hint" role="status">
          Loading map…
        </p>
      )}
      {ready && !ignition && <p className="aoi-map-hint">Click the map to place the ignition</p>}
    </div>
  );
}
