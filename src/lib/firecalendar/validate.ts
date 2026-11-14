import type { Box, YearMonth } from "./types";
import { FireCalendarError } from "./errors";
import { parseYm, tIndex, daysBetween } from "./time";
import { MAX_HOTSPOT_DAYS } from "./config";

const bad = (msg: string) => new FireCalendarError("validation", msg, 400);

/** Same rules as the API (400/422) so all three sources reject the same input. */
export function validateBox(b: Box): void {
  const vals = [b.minLat, b.minLon, b.maxLat, b.maxLon];
  if (vals.some((n) => typeof n !== "number" || !Number.isFinite(n))) throw bad("กรุณากรอกพิกัดเป็นตัวเลขให้ครบ 4 ช่อง");
  if (b.minLat < -90 || b.maxLat > 90) throw bad("ละติจูดต้องอยู่ระหว่าง −90 ถึง 90");
  if (b.minLon < -180 || b.maxLon > 180) throw bad("ลองจิจูดต้องอยู่ระหว่าง −180 ถึง 180");
  if (b.minLat >= b.maxLat || b.minLon >= b.maxLon) throw bad("ค่าต่ำสุดต้องน้อยกว่าค่าสูงสุด (min < max)");
}

export function validateRange(start?: YearMonth, end?: YearMonth): void {
  const s = start ? parseYm(start) : null;
  const e = end ? parseYm(end) : null;
  if (start && !s) throw bad(`เดือนเริ่มต้นต้องเป็นรูปแบบ YYYY-MM (ได้ '${start}')`);
  if (end && !e) throw bad(`เดือนสิ้นสุดต้องเป็นรูปแบบ YYYY-MM (ได้ '${end}')`);
  if (s && e && tIndex(s.year, s.month) > tIndex(e.year, e.month)) throw bad("เดือนเริ่มต้นอยู่หลังเดือนสิ้นสุด");
}

export function validateDays(startDate: string, endDate: string): void {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(startDate) || !re.test(endDate)) throw bad("วันที่ต้องเป็นรูปแบบ YYYY-MM-DD");
  const n = daysBetween(startDate, endDate);
  if (!(n >= 1 && n <= MAX_HOTSPOT_DAYS)) throw bad(`เลือกได้ 1–${MAX_HOTSPOT_DAYS} วัน และวันเริ่มต้องไม่หลังวันสิ้นสุด`);
}
