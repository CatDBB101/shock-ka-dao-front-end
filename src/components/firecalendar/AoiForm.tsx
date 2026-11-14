import { useState, type FormEvent } from "react";
import type { Box } from "../../lib/firecalendar";
import { FireCalendarError, validateBox } from "../../lib/firecalendar";

/** Example boxes. Cell counts verified against cell_index.parquet. */
export const EXAMPLE_AREAS: { id: string; name: string; box: Box; cells: number }[] = [
  { id: "rosario", name: "โรซาริโอ (อาร์เจนตินา)", box: { minLat: -34.5, minLon: -61, maxLat: -32.5, maxLon: -58.5 }, cells: 282 },
  { id: "angola", name: "แองโกลาตอนกลาง", box: { minLat: -14, minLon: 16, maxLat: -10, maxLon: 20 }, cells: 669 },
  { id: "bc", name: "บริติชโคลัมเบีย (แคนาดา)", box: { minLat: 49, minLon: -126, maxLat: 56, maxLon: -118 }, cells: 1762 },
  { id: "nt", name: "นอร์เทิร์นเทร์ริทอรี (ออสเตรเลีย)", box: { minLat: -17, minLon: 130, maxLat: -12, maxLon: 136 }, cells: 1366 },
];

export const exampleName = (b: Box | null) =>
  EXAMPLE_AREAS.find((e) => b && e.box.minLat === b.minLat && e.box.minLon === b.minLon && e.box.maxLat === b.maxLat && e.box.maxLon === b.maxLon)?.name;

type Fields = Record<keyof Box, string>;
const toFields = (b: Box | null): Fields =>
  b ? { minLat: String(b.minLat), minLon: String(b.minLon), maxLat: String(b.maxLat), maxLon: String(b.maxLon) } : { minLat: "", minLon: "", maxLat: "", maxLon: "" };

const LABELS: [keyof Box, string][] = [
  ["minLat", "ละติจูดใต้สุด (min lat)"],
  ["minLon", "ลองจิจูดตะวันตกสุด (min lon)"],
  ["maxLat", "ละติจูดเหนือสุด (max lat)"],
  ["maxLon", "ลองจิจูดตะวันออกสุด (max lon)"],
];

export function AoiForm({ value, onSubmit, externalError }: { value: Box | null; onSubmit: (b: Box) => void; externalError?: string | null }) {
  const [f, setF] = useState<Fields>(() => toFields(value));
  const [err, setErr] = useState<string | null>(null);
  // reset only when the box itself changes (not on every new object, e.g. when the month range changes)
  const key = value ? `${value.minLat},${value.minLon},${value.maxLat},${value.maxLon}` : "";
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setF(toFields(value));
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const b: Box = { minLat: Number(f.minLat), minLon: Number(f.minLon), maxLat: Number(f.maxLat), maxLon: Number(f.maxLon) };
    const blank = Object.values(f).some((v) => v.trim() === "");
    try {
      if (blank) throw new FireCalendarError("validation", "กรุณากรอกพิกัดให้ครบ 4 ช่อง");
      validateBox(b);
      setErr(null);
      onSubmit(b);
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x));
    }
  };

  const shown = err ?? externalError;
  return (
    <form onSubmit={submit} className="stack" noValidate aria-describedby={shown ? "aoi-err" : undefined}>
      <div className="form-grid">
        {LABELS.map(([k, l]) => (
          <label key={k} className="field">
            {l}
            <input
              inputMode="decimal"
              value={f[k]}
              onChange={(e) => setF((o) => ({ ...o, [k]: e.target.value }))}
              aria-invalid={Boolean(shown)}
            />
          </label>
        ))}
      </div>
      <div className="row">
        <button className="btn primary" type="submit">
          ดูปฏิทินพื้นที่นี้
        </button>
        <span className="small muted">หรือเลือกพื้นที่ตัวอย่าง:</span>
        {EXAMPLE_AREAS.map((a) => (
          <button
            key={a.id}
            type="button"
            className="btn ghost"
            onClick={() => {
              setErr(null);
              onSubmit(a.box);
            }}
          >
            {a.name}
          </button>
        ))}
      </div>
      {shown && (
        <p id="aoi-err" className="error" role="alert">
          {shown}
        </p>
      )}
    </form>
  );
}
