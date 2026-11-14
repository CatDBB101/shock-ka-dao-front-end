// The 2012 seam in one number, computed from the real calendar:
// average fires 2012–2016 ÷ 2007–2011. Spliced raw data shows a ×3–5 jump; harmonized ≈ ×1.
import { useEffect, useMemo, useRef, useState } from "react";
import { strataValue, type StrataMode, type StrataRow } from "./HeatStrata";

export function seamRatio(rows: StrataRow[], mode: StrataMode): number | null {
  let before = 0;
  let after = 0;
  for (const r of rows) {
    if (r.year >= 2007 && r.year <= 2011) before += strataValue(r, mode);
    else if (r.year >= 2012 && r.year <= 2016) after += strataValue(r, mode);
  }
  return before > 0 ? after / before : null;
}

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Counts from the previous value to the new one (the number "settles" as the bars do). */
function useTween(value: number, ms = 1500) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const still = reduced();
  useEffect(() => {
    if (still) {
      from.current = value;
      return;
    }
    const a = from.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - k, 4);
      const v = a + (value - a) * e;
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms, still]);
  return still ? value : shown;
}

export function SeamMeter({ rows, mode }: { rows: StrataRow[]; mode: StrataMode }) {
  const ratio = useMemo(() => seamRatio(rows, mode), [rows, mode]);
  const shown = useTween(ratio ?? 1);
  if (ratio == null) return null;
  // gauge: ×1 at the left edge, ×5 at the right edge (log scale)
  const pos = Math.min(1, Math.max(0, Math.log(shown) / Math.log(5)));
  const healed = mode === "harmonized";
  return (
    <div className={`seam-meter${healed ? " healed" : ""}`}>
      <span className="sr-only" role="status">
        รอยต่อปี 2012: ยอดเฉลี่ยปี 2012–16 เป็น {ratio.toFixed(1)} เท่าของปี 2007–11
      </span>
      <div className="seam-figure" aria-hidden="true">
        <span className="seam-x">×</span>
        <span className="seam-num">{shown.toFixed(1)}</span>
      </div>
      <div className="seam-text">
        <p>
          {healed ? "หลังปรับเทียบ ไฟเฉลี่ยปี 2012–16 เทียบปี 2007–11 ต่างกันตามธรรมชาติของแต่ละปีเท่านั้น" : "ถ้าต่อข้อมูลตรงๆ ไฟเฉลี่ยปี 2012–16 จะดูมากกว่าปี 2007–11 หลายเท่า ทั้งที่เป็นเพราะเปลี่ยนดาวเทียม"}
        </p>
        <div className="seam-gauge" aria-hidden="true">
          <i style={{ left: `${pos * 100}%` }} />
          <span>×1</span>
          <span>×5</span>
        </div>
      </div>
    </div>
  );
}
