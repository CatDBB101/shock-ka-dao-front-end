// The curve of the Earth at night under the heat strata: orthographic globe, only its top cap in view.
// Turns to face the selected region (user-triggered motion only). Land from public/geo/land.json.
import { useEffect, useRef } from "react";
import type { Region } from "../../lib/firecalendar";

const CENTROID: Record<Region, [number, number]> = {
  africa: [18, -12],
  south_america: [-55, -18],
  canada_usa: [-105, 48],
  australia: [134, -25],
};

type Ring = [number, number][];
let landP: Promise<Ring[]> | null = null;
function loadLand(): Promise<Ring[]> {
  landP ??= fetch("/geo/land.json")
    .then((r) => r.json())
    .then((g: { geometry?: { type: string; coordinates: unknown } }) => {
      const geom = g.geometry;
      if (!geom) return [];
      const polys = (geom.type === "MultiPolygon" ? geom.coordinates : [geom.coordinates]) as Ring[][];
      // keep outer rings, every 2nd vertex — plenty at this scale
      return polys.map((p) => (p[0] ?? []).filter((_, i) => i % 2 === 0)).filter((r) => r.length > 3);
    })
    .catch(() => []);
  return landP;
}

const rad = Math.PI / 180;
const prefersReduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function EarthLimb({ region }: { region: Region }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const view = useRef<[number, number]>([CENTROID[region][0], CENTROID[region][1] - 58]);
  const land = useRef<Ring[]>([]);
  const raf = useRef(0);

  const draw = () => {
    const c = cv.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (c.width !== Math.round(w * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const R = Math.max(w * 0.95, 520);
    const cx = w / 2;
    const cy = h + R * 0.7;
    const [lon0, lat0] = view.current;
    const sl0 = Math.sin(lat0 * rad);
    const cl0 = Math.cos(lat0 * rad);
    const proj = (lon: number, lat: number): [number, number, boolean] => {
      const l = (lon - lon0) * rad;
      const p = lat * rad;
      const cosc = sl0 * Math.sin(p) + cl0 * Math.cos(p) * Math.cos(l);
      let x = Math.cos(p) * Math.sin(l);
      let y = cl0 * Math.sin(p) - sl0 * Math.cos(p) * Math.cos(l);
      if (cosc < 0) {
        // behind the globe → pin to the limb so filled rings stay closed
        const n = Math.hypot(x, y) || 1;
        x /= n;
        y /= n;
      }
      return [cx + x * R, cy - y * R, cosc >= 0];
    };

    // atmosphere
    const atm = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.12);
    atm.addColorStop(0, "rgba(127,214,201,0.35)");
    atm.addColorStop(0.35, "rgba(127,214,201,0.10)");
    atm.addColorStop(1, "rgba(127,214,201,0)");
    ctx.fillStyle = atm;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.12, 0, Math.PI * 2);
    ctx.fill();

    // ocean
    const sea = ctx.createRadialGradient(cx, cy - R * 0.85, R * 0.1, cx, cy, R);
    sea.addColorStop(0, "#1a4660");
    sea.addColorStop(1, "#0a1c29");
    ctx.fillStyle = sea;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();

    // land
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "rgba(201,183,156,0.20)";
    ctx.strokeStyle = "rgba(237,230,214,0.28)";
    ctx.lineWidth = 0.7;
    for (const ring of land.current) {
      let any = false;
      ctx.beginPath();
      ring.forEach(([lon, lat], i) => {
        const [x, y, vis] = proj(lon, lat);
        any ||= vis;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      if (!any) continue;
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // graticule: a few latitude arcs give the curvature away
    ctx.strokeStyle = "rgba(127,214,201,0.10)";
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      let pen = false;
      for (let lon = -180; lon <= 180; lon += 3) {
        const [x, y, vis] = proj(lon, lat);
        if (!vis) {
          pen = false;
          continue;
        }
        if (pen) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
        pen = true;
      }
      ctx.stroke();
    }
    ctx.restore();

    // fire glow on each covered region; the selected one burns brighter
    for (const [r, [lon, lat]] of Object.entries(CENTROID) as [Region, [number, number]][]) {
      const [x, y, vis] = proj(lon, lat);
      if (!vis) continue;
      const k = r === region ? 1 : 0.45;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 70 * k + 20);
      g.addColorStop(0, `rgba(255,211,110,${0.9 * k})`);
      g.addColorStop(0.25, `rgba(240,138,60,${0.55 * k})`);
      g.addColorStop(1, "rgba(194,65,45,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 70 * k + 20, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  useEffect(() => {
    let alive = true;
    void loadLand().then((l) => {
      if (!alive) return;
      land.current = l;
      draw();
    });
    const ro = new ResizeObserver(() => draw());
    if (cv.current) ro.observe(cv.current);
    return () => {
      alive = false;
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draw reads refs
  }, []);

  // turn to the selected region
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    const [lonT, latT0] = CENTROID[region];
    const latT = latT0 - 58;
    const [lonF, latF] = view.current;
    const dLon = ((lonT - lonF + 540) % 360) - 180; // shortest way round
    if (prefersReduced()) {
      view.current = [lonT, latT];
      draw();
      return;
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 1400);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      view.current = [lonF + dLon * e, latF + (latT - latF) * e];
      draw();
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draw reads refs
  }, [region]);

  return <canvas ref={cv} className="earth-limb" aria-hidden="true" />;
}
