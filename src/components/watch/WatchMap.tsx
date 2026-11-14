// Watchpoint circles (coloured by level) + latest hotspots. Lazy-loaded (maplibre is large).
import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { destination, type LonLat } from "../../lib/firecalendar";
import type { Hotspot, WatchLevel } from "../../lib/watch/risk";
import type { Watchpoint } from "../../lib/watch/types";

const STYLE = "https://tiles.openfreemap.org/styles/fiord";
// same hues as the CSS level badges; the map needs literal colours
const LEVEL_COLOUR: Record<WatchLevel, string> = { active: "#d4471f", high: "#ec6f33", elevated: "#f9b26b", normal: "#7d8a96" };

export interface WatchMapProps {
  points: (Watchpoint & { level: WatchLevel; subscribed: boolean })[];
  hotspots: Hotspot[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function circle(wp: Watchpoint, n = 64): LonLat[] {
  const ring = Array.from({ length: n }, (_, i) => destination([wp.lon, wp.lat], wp.radiusKm, (i * 360) / n));
  return [...ring, ring[0]!];
}

export default function WatchMap({ points, hotspots, selectedId, onSelect }: WatchMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!el.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({ container: el.current, style: STYLE, center: [-30, -5], zoom: 1.2, attributionControl: { compact: true }, dragRotate: false });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.touchZoomRotate.disableRotation();
    map.on("load", () => {
      const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
      map.addSource("wp", { type: "geojson", data: empty });
      map.addSource("wp-c", { type: "geojson", data: empty });
      map.addSource("hs", { type: "geojson", data: empty });
      map.addLayer({ id: "wp-fill", type: "fill", source: "wp", paint: { "fill-color": ["get", "colour"], "fill-opacity": 0.22 } });
      map.addLayer({
        id: "wp-line",
        type: "line",
        source: "wp",
        paint: { "line-color": ["get", "colour"], "line-width": ["case", ["get", "sel"], 3.5, ["get", "sub"], 2.5, 1.2] },
      });
      // centre dot keeps small circles clickable at world zoom
      map.addLayer({
        id: "wp-dot",
        type: "circle",
        source: "wp-c",
        paint: { "circle-radius": ["case", ["get", "sel"], 8, 6], "circle-color": ["get", "colour"], "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 },
      });
      map.addLayer({ id: "hs", type: "circle", source: "hs", paint: { "circle-radius": 3, "circle-color": "#ff2a00", "circle-stroke-color": "#fff", "circle-stroke-width": 0.5 } });
      for (const id of ["wp-fill", "wp-dot"]) {
        map.on("click", id, (e) => {
          const pid = e.features?.[0]?.properties?.id;
          if (typeof pid === "string") onSelectRef.current(pid);
        });
        map.on("mouseenter", id, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", id, () => (map.getCanvas().style.cursor = ""));
      }
      setReady(true);
    });
    return () => map.remove();
  }, []);

  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    const props = (p: WatchMapProps["points"][number]) => ({ id: p.id, colour: LEVEL_COLOUR[p.level], sub: p.subscribed, sel: p.id === selectedId });
    (m.getSource("wp") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: points.map((p) => ({ type: "Feature", properties: props(p), geometry: { type: "Polygon", coordinates: [circle(p)] } })),
    });
    (m.getSource("wp-c") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: points.map((p) => ({ type: "Feature", properties: props(p), geometry: { type: "Point", coordinates: [p.lon, p.lat] } })),
    });
    (m.getSource("hs") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: hotspots.map((h) => ({ type: "Feature", properties: { frp: h.frp }, geometry: { type: "Point", coordinates: [h.lon, h.lat] } })),
    });
  }, [points, hotspots, selectedId, ready]);

  // fly to the selected watchpoint
  useEffect(() => {
    const m = mapRef.current;
    const p = points.find((x) => x.id === selectedId);
    if (m && ready && p) m.flyTo({ center: [p.lon, p.lat], zoom: Math.max(5, 9 - Math.log2(p.radiusKm / 10)), duration: 800 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the selection changes
  }, [selectedId, ready]);

  if (err) return <p className="alert small">แสดงแผนที่ไม่ได้ ({err}) — ใช้รายการด้านล่างแทนได้</p>;
  return (
    <div className="aoi-map-wrap">
      <div ref={el} className="aoi-map" role="region" aria-label="แผนที่จุดเฝ้าระวัง" />
      {!ready && (
        <p className="aoi-map-hint" role="status">
          กำลังโหลดแผนที่…
        </p>
      )}
    </div>
  );
}
