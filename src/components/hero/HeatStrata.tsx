// 3D "heat strata": 24 years × 12 months of fire as extruded prisms on a canvas.
// Height and colour = sqrt(count / max), so the 2012 seam's 3–5× jump reads as ~2× taller.
// One render loop drives: idle orbit (until the user takes over), the morph tween with its
// aurora "repair beam" sweeping through the years, bloom on hot bars, and embers off the hottest.
// prefers-reduced-motion → no orbit, no embers, instant morph; still fully interactive.
import { useEffect, useMemo, useRef, useState } from "react";
import type { CalendarRow, Source } from "../../lib/firecalendar";
import { fmtCount, monthTh, SOURCE_LABEL_TH } from "../../lib/firecalendar";

export type StrataMode = "spliced" | "harmonized";
export type StrataRow = Pick<CalendarRow, "year" | "month" | "modis" | "value" | "source">;

/** spliced = what you get by gluing raw MODIS (to Jan 2012) onto VIIRS — shows the seam */
export function strataValue(r: Pick<StrataRow, "year" | "month" | "modis" | "value">, mode: StrataMode): number {
  if (mode === "harmonized") return r.value;
  return r.year * 12 + r.month < 2012 * 12 + 2 ? r.modis : r.value;
}

const RAMP = ["#2a2f4a", "#6b2e3e", "#c2412d", "#f08a3c", "#ffd36e"]; // = --heat-0..4
const YEARS = 24;
const FIRST = 2001;
const FOOT = 0.4;
const TILT = 0.55;
const Z = 6.2; // height of the max value, grid units
const MORPH_MS = 1900;
const ORBIT_RAD_PER_MS = 0.000055;

const RAMP_RGB = RAMP.map((c) => {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
});
function rampRgb(t: number, shade = 1): [number, number, number] {
  const x = Math.min(1, Math.max(0, t)) * (RAMP_RGB.length - 1);
  const i = Math.min(RAMP_RGB.length - 2, Math.floor(x));
  const f = x - i;
  const a = RAMP_RGB[i]!;
  const b = RAMP_RGB[i + 1]!;
  const ch = (k: 0 | 1 | 2) => Math.min(255, Math.round((a[k] + (b[k] - a[k]) * f) * shade));
  return [ch(0), ch(1), ch(2)];
}
const rgb = ([r, g, b]: [number, number, number], a = 1) => `rgba(${r},${g},${b},${a})`;
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

type Pt = [number, number];
interface Ember {
  x: number;
  y: number;
  z: number;
  vz: number;
  drift: number;
  life: number;
  t: number;
}
interface Morph {
  from: Float32Array;
  to: Float32Array;
  t0: number;
  toward: StrataMode;
}

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function HeatStrata({ rows, mode, label, compact = false }: { rows: StrataRow[]; mode: StrataMode; label: string; compact?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [tip, setTip] = useState("");
  const [spinning, setSpinning] = useState(true);

  const az = useRef(-0.62);
  const autoSpin = useRef(true);
  const heights = useRef(new Float32Array(YEARS * 12));
  const morph = useRef<Morph | null>(null);
  const beam = useRef<number | null>(null);
  const embers = useRef<Ember[]>([]);
  const hits = useRef<{ poly: Pt[]; idx: number }[]>([]);
  const hover = useRef(-1);
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const visible = useRef(true);
  const raf = useRef(0);
  const last = useRef(0);
  const reduced = useRef(reducedMotion());

  const cells = useMemo(() => {
    const out: (StrataRow | null)[] = Array.from({ length: YEARS * 12 }, () => null);
    for (const r of rows) {
      const yi = r.year - FIRST;
      if (yi >= 0 && yi < YEARS) out[yi * 12 + r.month - 1] = r;
    }
    return out;
  }, [rows]);
  // one scale for both modes so the morph is honest
  const max = useMemo(() => Math.max(1, ...rows.map((r) => Math.max(r.value, strataValue(r, "spliced")))), [rows]);
  const target = useMemo(() => {
    const t = new Float32Array(YEARS * 12);
    cells.forEach((c, i) => (t[i] = c ? Math.sqrt(strataValue(c, mode) / max) : 0));
    return t;
  }, [cells, mode, max]);
  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // ---------- drawing ----------
  const draw = () => {
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const { w, h, dpr } = size.current;
    if (!w) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const cellsNow = cellsRef.current;
    const a = az.current;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const cx = 5.5;
    const cy = (YEARS - 1) / 2;

    // fit rotated footprint (+ label margin) and the tallest bar into the stage
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (const [gx, gy] of [[-3, -3], [14.5, -3], [14.5, YEARS + 0.5], [-3, YEARS + 0.5]] as const) {
      const X = (gx - cx) * ca - (gy - cy) * sa;
      const Y = (gx - cx) * sa + (gy - cy) * ca;
      xMin = Math.min(xMin, X); xMax = Math.max(xMax, X);
      yMin = Math.min(yMin, Y); yMax = Math.max(yMax, Y);
    }
    const s = Math.min((w * 0.98) / (xMax - xMin), (h * 0.96) / ((yMax - yMin) * TILT + Z * 0.8));
    const zScale = s * Z;
    const ox = w / 2 - ((xMax + xMin) / 2) * s;
    const above = -yMin * TILT * s + zScale * 0.8;
    const oy = above + (h - above - yMax * TILT * s) / 2;
    const P = (x: number, y: number, z: number): Pt => {
      const dx = x - cx;
      const dy = y - cy;
      return [ox + (dx * ca - dy * sa) * s, oy + (dx * sa + dy * ca) * s * TILT - z * zScale];
    };
    const depth = (x: number, y: number) => (x - cx) * sa + (y - cy) * ca;
    const path = (pts: Pt[]) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
    };

    // pool of light under the plate — warmer when the calendar is hotter
    const [px, py] = P(cx, cy, 0);
    const pool = ctx.createRadialGradient(px, py, 0, px, py, s * 16);
    pool.addColorStop(0, "rgba(240,112,58,0.16)");
    pool.addColorStop(0.5, "rgba(127,214,201,0.05)");
    pool.addColorStop(1, "rgba(127,214,201,0)");
    ctx.fillStyle = pool;
    ctx.fillRect(0, 0, w, h);

    // instrument plate + fine grid
    path([P(-0.7, -0.7, 0), P(11.7, -0.7, 0), P(11.7, YEARS - 0.3, 0), P(-0.7, YEARS - 0.3, 0)]);
    ctx.fillStyle = "rgba(8,22,31,0.55)";
    ctx.fill();
    ctx.strokeStyle = "rgba(127,214,201,0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = "rgba(127,214,201,0.07)";
    ctx.beginPath();
    for (let m = 0; m <= 12; m++) {
      ctx.moveTo(...P(m - 0.5, -0.5, 0));
      ctx.lineTo(...P(m - 0.5, YEARS - 0.5, 0));
    }
    for (let y = 0; y <= YEARS; y += 1) {
      ctx.moveTo(...P(-0.5, y - 0.5, 0));
      ctx.lineTo(...P(11.5, y - 0.5, 0));
    }
    ctx.stroke();

    // 2012 seam
    const seamY = 2012 - FIRST - 0.5;
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "rgba(127,214,201,0.9)";
    ctx.shadowColor = "rgba(127,214,201,0.8)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(...P(-1.4, seamY, 0));
    ctx.lineTo(...P(12.4, seamY, 0));
    ctx.stroke();
    ctx.restore();

    // labels
    ctx.font = `500 ${Math.max(10, s * 0.6)}px Anuphan, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const y of [2001, 2006, 2012, 2018, 2024]) {
      const [lx, ly] = P(-2, y - FIRST, 0);
      ctx.fillStyle = y === 2012 ? "rgba(127,214,201,1)" : "rgba(237,230,214,0.6)";
      ctx.fillText(y === 2012 ? "2012 VIIRS" : String(y), lx, ly);
    }
    ctx.fillStyle = "rgba(237,230,214,0.6)";
    for (let m = 0; m < 12; m += 3) {
      const [lx, ly] = P(m, -2, 0);
      ctx.fillText(monthTh(m + 1), lx, ly);
    }

    // prisms, far → near
    const order = Array.from({ length: YEARS * 12 }, (_, i) => i).sort((i, j) => depth(i % 12, (i / 12) | 0) - depth(j % 12, (j / 12) | 0));
    const newHits: { poly: Pt[]; idx: number }[] = [];
    const hot: { p: Pt; t: number }[] = [];
    const curMode = modeRef.current;
    for (const i of order) {
      const c = cellsNow[i];
      if (!c) continue;
      const mx = i % 12;
      const yi = (i / 12) | 0;
      const t = heights.current[i]!;
      const z = Math.max(0.004, t);
      const x0 = mx - FOOT, x1 = mx + FOOT, y0 = yi - FOOT, y1 = yi + FOOT;
      const lit = hover.current === i;
      const boost = lit ? 1.3 : 1;
      // the two side faces whose outward normal faces the viewer
      const sides: [Pt, Pt, number][] = [
        sa > 0 ? [[x1, y0], [x1, y1], 0.66] : [[x0, y1], [x0, y0], 0.66],
        ca > 0 ? [[x1, y1], [x0, y1], 0.48] : [[x0, y0], [x1, y0], 0.48],
      ];
      for (const [[ax, ay], [bx, by], shade] of sides) {
        const bottom = P(ax, ay, 0);
        const top = P(ax, ay, z);
        const g = ctx.createLinearGradient(top[0], top[1], bottom[0], bottom[1]);
        g.addColorStop(0, rgb(rampRgb(t, shade * boost)));
        g.addColorStop(1, rgb(rampRgb(t * 0.55, shade * 0.55 * boost)));
        path([bottom, P(bx, by, 0), P(bx, by, z), top]);
        ctx.fillStyle = g;
        ctx.fill();
      }
      const topFace = [P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)];
      path(topFace);
      ctx.fillStyle = rgb(rampRgb(t, 1.08 * boost));
      ctx.fill();
      if (lit) {
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      // hatch = computed (backcast); denser = Terra only. Raw MODIS in "spliced" is measured → no hatch
      const src: Source = curMode === "spliced" && c.year * 12 + c.month < 2012 * 12 + 2 ? "observed" : c.source;
      if (src !== "observed" && t > 0.03) {
        ctx.save();
        path(topFace);
        ctx.clip();
        ctx.strokeStyle = "rgba(8,22,31,0.5)";
        ctx.lineWidth = 1;
        const step = src === "backcast_terra" ? 2.4 : 4.4;
        const [bx, by] = topFace[0]!;
        ctx.beginPath();
        for (let d = -s * 2; d < s * 2; d += step) {
          ctx.moveTo(bx + d - s, by - s);
          ctx.lineTo(bx + d + s, by + s);
        }
        ctx.stroke();
        ctx.restore();
      }
      if (t > 0.42) hot.push({ p: P(mx, yi, z), t });
      newHits.push({ poly: topFace, idx: i });
    }
    hits.current = newHits;

    // bloom on hot tops (additive)
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const { p, t } of hot) {
      const r = s * (0.9 + 2.2 * (t - 0.42));
      const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
      g.addColorStop(0, rgb(rampRgb(Math.min(1, t + 0.15)), 0.55 * t));
      g.addColorStop(1, "rgba(194,65,45,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
      ctx.fill();
    }
    // embers
    for (const e of embers.current) {
      const [ex, ey] = P(e.x, e.y, e.z);
      const k = 1 - e.life;
      const r = 1 + 2.2 * k * e.t;
      const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, r * 3);
      g.addColorStop(0, `rgba(255,220,140,${0.9 * k})`);
      g.addColorStop(1, "rgba(240,112,58,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ex, ey, r * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // repair beam: a vertical curtain of light at the sweep front
    if (beam.current != null && beam.current > -1 && beam.current < YEARS) {
      const by = beam.current;
      const aurora = morph.current?.toward !== "spliced";
      const col = aurora ? "127,214,201" : "167,154,134";
      const b0 = P(-0.9, by, 0), b1 = P(11.9, by, 0), t0 = P(11.9, by, 1.1), t1 = P(-0.9, by, 1.1);
      const g = ctx.createLinearGradient(b0[0], b0[1], t1[0], t1[1]);
      g.addColorStop(0, `rgba(${col},0.55)`);
      g.addColorStop(1, `rgba(${col},0)`);
      path([b0, b1, t0, t1]);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = `rgba(${col},0.95)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(...b0);
      ctx.lineTo(...b1);
      ctx.stroke();
    }
    ctx.restore();
  };

  // ---------- simulation step ----------
  const step = (now: number) => {
    const dt = Math.min(64, now - (last.current || now));
    last.current = now;
    if (autoSpin.current && !reduced.current) az.current += dt * ORBIT_RAD_PER_MS;

    const m = morph.current;
    if (m) {
      const e = Math.min(1, (now - m.t0) / MORPH_MS);
      const front = e * (YEARS + 8) - 4; // year index of the sweep front
      const hcur = heights.current;
      for (let i = 0; i < hcur.length; i++) {
        const k = smooth((front - ((i / 12) | 0)) / 4);
        hcur[i] = m.from[i]! + (m.to[i]! - m.from[i]!) * k;
      }
      beam.current = front;
      if (e >= 1) {
        heights.current = m.to.slice();
        morph.current = null;
        beam.current = null;
      }
    }

    if (!reduced.current) {
      // embers from the hottest months
      const list = embers.current;
      const hcur = heights.current;
      if (list.length < 70) {
        for (let tries = 0; tries < 6; tries++) {
          const i = (Math.random() * hcur.length) | 0;
          const t = hcur[i]!;
          if (t > 0.55 && Math.random() < (t - 0.5) * dt * 0.02) {
            list.push({ x: (i % 12) + (Math.random() - 0.5) * 0.6, y: ((i / 12) | 0) + (Math.random() - 0.5) * 0.6, z: t, vz: 0.00025 + Math.random() * 0.0003, drift: (Math.random() - 0.5) * 0.0004, life: 0, t });
          }
        }
      }
      for (const e of list) {
        e.z += e.vz * dt;
        e.x += e.drift * dt;
        e.life += dt / 2600;
      }
      embers.current = list.filter((e) => e.life < 1);
    }
  };

  const loop = (now: number) => {
    step(now);
    draw();
    // with motion allowed, embers keep the scene alive; reduced motion only animates the morph (instant anyway)
    const busy = Boolean(morph.current) || !reduced.current;
    if (busy && visible.current && !document.hidden) raf.current = requestAnimationFrame(loop);
    else raf.current = 0;
  };
  const kick = () => {
    if (!raf.current) {
      last.current = 0;
      raf.current = requestAnimationFrame(loop);
    }
  };

  // size
  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = Math.round(compact ? Math.min(460, Math.max(300, w * 0.62)) : Math.min(660, Math.max(320, w * 0.76)));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size.current = { w, h, dpr };
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.height = `${h}px`;
      draw();
    });
    ro.observe(el);
    // pause when off-screen or tab hidden
    const io = new IntersectionObserver(([en]) => {
      visible.current = Boolean(en?.isIntersecting);
      if (visible.current) kick();
    });
    io.observe(el);
    const onVis = () => !document.hidden && kick();
    document.addEventListener("visibilitychange", onVis);
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => {
      reduced.current = mq.matches;
      embers.current = [];
      kick();
    };
    mq.addEventListener("change", onMq);
    return () => {
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      mq.removeEventListener("change", onMq);
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draw/kick read refs
  }, [compact]);

  // morph to the new target (first load rises from the ground)
  useEffect(() => {
    if (reduced.current) {
      heights.current = target.slice();
      morph.current = null;
      draw();
      return;
    }
    morph.current = { from: heights.current.slice(), to: target.slice(), t0: performance.now(), toward: mode };
    kick();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draw/kick read refs
  }, [target]);

  const stopSpin = () => {
    if (autoSpin.current) {
      autoSpin.current = false;
      setSpinning(false);
    }
  };

  // pointer: drag to rotate, hover/tap to inspect
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    let dragX: number | null = null;
    let moved = false;
    const local = (e: PointerEvent): Pt => {
      const r = cv.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    const pick = ([px, py]: Pt) => {
      for (let k = hits.current.length - 1; k >= 0; k--) {
        const { poly: pg, idx } = hits.current[k]!;
        let inside = false;
        for (let i = 0, j = pg.length - 1; i < pg.length; j = i++) {
          const [xi, yi] = pg[i]!;
          const [xj, yj] = pg[j]!;
          if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) return idx;
      }
      return -1;
    };
    const describe = (i: number) => {
      const c = cells[i];
      if (!c) return "";
      const v = strataValue(c, mode);
      const raw = mode === "spliced" && c.year * 12 + c.month < 2012 * 12 + 2;
      return `${monthTh(c.month)} ${c.year}: ${fmtCount(v, !raw && c.source !== "observed")} จุด · ${raw ? "MODIS ดิบ (ยังไม่ปรับเทียบ)" : SOURCE_LABEL_TH[c.source]}`;
    };
    const setHover = (i: number) => {
      if (i === hover.current) return;
      hover.current = i;
      setTip(i >= 0 ? describe(i) : "");
      if (!raf.current) draw();
    };
    const down = (e: PointerEvent) => {
      dragX = e.clientX;
      moved = false;
      cv.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (dragX != null) {
        const dx = e.clientX - dragX;
        if (Math.abs(dx) > 2) {
          moved = true;
          stopSpin();
        }
        az.current += dx * 0.008;
        dragX = e.clientX;
        if (!raf.current) draw();
        return;
      }
      setHover(pick(local(e)));
    };
    const up = (e: PointerEvent) => {
      dragX = null;
      if (!moved) {
        stopSpin();
        setHover(pick(local(e)));
      }
    };
    const leave = () => dragX == null && setHover(-1);
    cv.addEventListener("pointerdown", down);
    cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointerleave", leave);
    return () => {
      cv.removeEventListener("pointerdown", down);
      cv.removeEventListener("pointermove", move);
      cv.removeEventListener("pointerup", up);
      cv.removeEventListener("pointerleave", leave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draw reads refs
  }, [cells, mode]);

  return (
    <div className={`strata${compact ? " is-compact" : ""}`}>
      <div ref={wrap} className="strata-stage">
        <canvas
          ref={canvas}
          tabIndex={0}
          role="img"
          aria-label={`${label}. แท่งละหนึ่งเดือน ความสูงตามจำนวนจุดไฟ กดลูกศรซ้ายขวาเพื่อหมุน`}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            stopSpin();
            az.current += e.key === "ArrowLeft" ? -0.14 : 0.14;
            if (!raf.current) draw();
          }}
        />
        {!reduced.current && (
          <button
            type="button"
            className="strata-spin"
            aria-pressed={spinning}
            onClick={() => {
              autoSpin.current = !spinning;
              setSpinning(!spinning);
              kick();
            }}
          >
            {spinning ? "หยุดหมุน" : "หมุนอัตโนมัติ"}
          </button>
        )}
      </div>
      <p className="strata-tip" aria-live="polite">
        {tip || "ลากเพื่อหมุน · แตะแท่งเพื่อดูตัวเลข"}
      </p>
    </div>
  );
}
