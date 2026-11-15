import { describe, expect, it } from "vitest";
import { viirsGap, VIIRS_GAP_MONTHS } from "./time";
import { keepVegetationFires, SNPP_LAST_DATE, validateFirmsDates } from "./firms";
import { parseFirmsCsv } from "../watch/risk";
import { cellSentence, hasViirsGap } from "../../components/firecalendar/CalendarGrid";

describe("research audit fixes", () => {
  it("flags the 7 incomplete VIIRS months", () => {
    expect(Object.keys(VIIRS_GAP_MONTHS)).toHaveLength(7);
    expect(viirsGap(2022, 7)).not.toBeNull();
    expect(viirsGap(2022, 9)).toBeNull();
  });
  it("calendar sentence warns on an observed gap month only", () => {
    const base = { value: 10, modis: 1, p_lo: 10, p_hi: 10, clim_median: null, pct_vs_ref: null };
    const gap = { ...base, year: 2024, month: 6, source: "observed" as const };
    expect(hasViirsGap(gap)).toBe(true);
    expect(cellSentence(gap)).toContain("value may be too low");
    expect(hasViirsGap({ ...gap, year: 2012, month: 1, source: "backcast" })).toBe(false);
  });
  it("drops non-vegetation detections when the SP type column exists", () => {
    const csv = "latitude,longitude,acq_date,acq_time,type\n1,2,2020-01-01,0100,0\n3,4,2020-01-01,0100,1\n5,6,2020-01-01,0100,2";
    const r = keepVegetationFires(csv);
    expect(r.filtered).toBe(true);
    expect(r.dropped).toBe(2);
    expect(parseFirmsCsv(csv)).toHaveLength(1);
  });
  it("leaves NRT CSVs (no type column) unchanged", () => {
    const csv = "latitude,longitude,acq_date,acq_time\n1,2,2026-11-14,0100";
    expect(keepVegetationFires(csv)).toEqual({ csv, dropped: 0, filtered: false });
  });
  it("rejects S-NPP requests after it stopped delivering", () => {
    expect(() => validateFirmsDates("VIIRS_SNPP_SP", "2026-11-05", "2026-11-06", "2026-11-15")).toThrow(SNPP_LAST_DATE);
    expect(() => validateFirmsDates("VIIRS_SNPP_SP", "2026-10-30", "2026-11-10", "2026-11-15")).toThrow(SNPP_LAST_DATE); // range crossing the end
    expect(() => validateFirmsDates("VIIRS_NOAA20_NRT", "2026-11-05", "2026-11-06", "2026-11-15")).not.toThrow();
  });
});
