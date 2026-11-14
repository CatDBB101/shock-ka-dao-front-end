import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { AoiRow, CalendarFile } from "./types";
import { fillMonths, sourceFor, parseYm, daysBetween } from "./time";
import { validateBox, validateDays, validateRange } from "./validate";
import { colourSteps, fmtCount } from "./colour";
import { boxToParam, calendarToCsv, readBoxFromUrl } from "./share";
import { countCsvRows, firmsChunkUrls, joinCsvChunks } from "./firms";
import { aoiSql, cellsSql } from "./duckdb";
import { resolveFile, withIntervals, withTimeout } from "./dataSource";
import { kindFromStatus } from "./errors";

const ROSARIO = { minLat: -34.5, minLon: -61, maxLat: -32.5, maxLon: -58.5 };
const row = (year: number, month: number, value: number): AoiRow => ({
  year,
  month,
  source: sourceFor(year, month),
  value,
  modis: 0,
  viirs_model: value,
  p_lo: value,
  p_hi: value,
  clim_median: null,
  pct_vs_ref: null,
});

describe("time", () => {
  it("sourceFor follows the instrument timeline", () => {
    expect(sourceFor(2001, 1)).toBe("backcast_terra");
    expect(sourceFor(2002, 6)).toBe("backcast_terra");
    expect(sourceFor(2002, 7)).toBe("backcast");
    expect(sourceFor(2012, 1)).toBe("backcast");
    expect(sourceFor(2012, 2)).toBe("observed");
  });
  it("fillMonths fills the full 288 months with zeros", () => {
    const out = fillMonths([row(2022, 8, 6593)]);
    expect(out).toHaveLength(288);
    expect(out.filter((r) => r.value > 0)).toHaveLength(1);
    expect(out[0]).toMatchObject({ year: 2001, month: 1, value: 0, source: "backcast_terra", pct_vs_ref: null });
    expect(out.find((r) => r.year === 2022 && r.month === 8)?.value).toBe(6593);
  });
  it("fillMonths respects a sub-range", () => {
    const out = fillMonths([], "2022-01", "2022-12");
    expect(out.map((r) => r.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
  it("parseYm accepts YYYY-MM and YYYY-MM-DD only", () => {
    expect(parseYm("2024-12")).toEqual({ year: 2024, month: 12 });
    expect(parseYm("2024-12-31")).toEqual({ year: 2024, month: 12 });
    expect(parseYm("2024-13")).toBeNull();
    expect(daysBetween("2022-08-01", "2022-08-10")).toBe(10);
  });
});

describe("validation (same rules as the API)", () => {
  it("rejects min >= max and out-of-range coords", () => {
    expect(() => validateBox(ROSARIO)).not.toThrow();
    expect(() => validateBox({ ...ROSARIO, minLat: -30 })).toThrow(/min < max/);
    expect(() => validateBox({ ...ROSARIO, maxLat: 91 })).toThrow();
    expect(() => validateBox({ ...ROSARIO, minLon: Number.NaN })).toThrow();
  });
  it("rejects start after end and bad months", () => {
    expect(() => validateRange("2024-01", "2023-12")).toThrow();
    expect(() => validateRange("2024-13")).toThrow();
    expect(() => validateRange("2001-01", "2024-12")).not.toThrow();
  });
  it("limits raw hotspot downloads to 1-60 days", () => {
    expect(() => validateDays("2022-08-01", "2022-08-10")).not.toThrow();
    expect(() => validateDays("2022-08-01", "2022-09-29")).not.toThrow(); // 60 days
    expect(() => validateDays("2022-08-01", "2022-09-30")).toThrow(); // 61 days
    expect(() => validateDays("2022-08-10", "2022-08-01")).toThrow();
  });
});

describe("colour + formatting", () => {
  it("zero is always level 0, peaks get level 4", () => {
    const step = colourSteps([0, 1, 10, 100, 1000, 10000, 100000]);
    expect(step(0)).toBe(0);
    expect(step(100000)).toBe(4);
    expect(step(1)).toBeGreaterThanOrEqual(1);
  });
  it("formats counts with separators and ~ for computed values", () => {
    expect(fmtCount(6593)).toBe("6,593");
    expect(fmtCount(591271.75, true)).toBe("~591,272");
  });
});

describe("share", () => {
  it("round-trips bbox through the URL", () => {
    const p = boxToParam(ROSARIO);
    expect(p).toBe("-34.5,-61,-32.5,-58.5");
    expect(readBoxFromUrl(new URLSearchParams(`bbox=${p}`))).toEqual(ROSARIO);
    expect(readBoxFromUrl(new URLSearchParams("bbox=1,2,3"))).toBeNull();
  });
});

describe("real data (public/mocks, cut from the backend files)", () => {
  const cal = JSON.parse(readFileSync("public/mocks/calendar_region.json", "utf8")) as CalendarFile;
  it("has 1,152 rows = 4 regions x 288 months", () => {
    expect(cal.rows).toHaveLength(1152);
    for (const r of ["africa", "south_america", "canada_usa", "australia"]) expect(cal.rows.filter((x) => x.region === r)).toHaveLength(288);
  });
  it("critical months per region match the acceptance numbers (180 total)", () => {
    const crit = (r: string) => cal.rows.filter((x) => x.region === r && x.pct_vs_ref >= 90).length;
    expect([crit("africa"), crit("south_america"), crit("canada_usa"), crit("australia")]).toEqual([35, 55, 30, 60]);
  });
  it("calendar CSV has header + 1,152 rows", () => {
    expect(calendarToCsv(cal.rows).split("\n")).toHaveLength(1153);
  });
  it("Rosario AOI Aug 2022 = 6593, 282 cells", () => {
    const a = JSON.parse(readFileSync("public/mocks/aoi.json", "utf8")) as { cells: number; rows: AoiRow[] };
    expect(a.cells).toBe(282);
    expect(a.rows.find((r) => r.year === 2022 && r.month === 8)).toMatchObject({ value: 6593, modis: 1310, clim_median: 299, pct_vs_ref: 91.67 });
  });
});

describe("data source helpers", () => {
  it("falls back when manifest.files is missing a key or holds a glob", () => {
    expect(resolveFile({ files: { cell_month: "cell_month/*.parquet" } }, "cell_month")).toBe("cell_month.parquet");
    expect(resolveFile({ files: {} }, "cell_index")).toBe("cell_index.parquet");
    expect(resolveFile({ files: { calendar_region: "cal_v2.json" } }, "calendar_region")).toBe("cal_v2.json");
  });
  it("intervals: observed → p_lo = p_hi = value, backcast → value × q10/q90", () => {
    const [o, b] = withIntervals(
      [
        { year: 2022, month: 8, source: "observed", value: 100, modis: 0, viirs_model: 0, clim_median: null, pct_vs_ref: null },
        { year: 2010, month: 8, source: "backcast", value: 591271.75, modis: 0, viirs_model: 0, clim_median: null, pct_vs_ref: null },
      ],
      { q10: 0.7633144580217257, q50: 0.97, q90: 1.1368151900006014 },
    );
    expect([o!.p_lo, o!.p_hi]).toEqual([100, 100]);
    expect(Math.round(b!.p_lo)).toBe(451326);
    expect(Math.round(b!.p_hi)).toBe(672167);
  });
  it("maps HTTP status to error kinds", () => {
    expect([400, 422, 404, 503, 500].map(kindFromStatus)).toEqual(["validation", "validation", "not_covered", "not_configured", "server"]);
  });
  it("builds AOI SQL with escaped literals", () => {
    expect(cellsSql("https://x/cell_index.parquet", ROSARIO)).toContain("lat BETWEEN -34.5 AND -32.5");
    const sql = aoiSql("https://x/cell_month.parquet", ["85b", "85a'"], 24001, 24300);
    expect(sql).toContain("h3 IN ('85b','85a''')");
    expect(sql).toContain("BETWEEN 24001 AND 24300");
  });
});

describe("stability fixes", () => {
  it("CSV writes empty cells for null, not the text 'null'", () => {
    const r = { region: "africa", year: 2001, month: 1, source: "backcast_terra", value: 1, p_lo: 1, p_hi: 1, modis: 1, viirs_obs: 0, clim_median: null, pct_vs_ref: null } as unknown as CalendarFile["rows"][number];
    expect(calendarToCsv([r]).split("\n")[1]).toBe("africa,2001,1,backcast_terra,1,1,1,1,0,,");
  });
  it("zero-filled months keep the calendar-month climatology", () => {
    const out = fillMonths([{ ...row(2022, 8, 10), clim_median: 299 }], "2021-01", "2022-12");
    expect(out.find((r) => r.year === 2021 && r.month === 8)).toMatchObject({ value: 0, clim_median: 299, pct_vs_ref: null });
    expect(out.find((r) => r.year === 2021 && r.month === 7)?.clim_median).toBeNull();
  });
  it("counts FIRMS rows without header or # lines", () => {
    expect(countCsvRows("latitude,lon\n1,2\n# missing x\n3,4\n")).toBe(2);
  });
  it("withTimeout rejects with a retryable network error", async () => {
    await expect(withTimeout(new Promise(() => {}), 10, "slow")).rejects.toMatchObject({ kind: "network", message: "slow" });
    await expect(withTimeout(Promise.resolve(1), 10, "slow")).resolves.toBe(1);
  });
});

describe("FIRMS", () => {
  it("splits into 5-day chunks with lon,lat order", () => {
    const urls = firmsChunkUrls("KEY", ROSARIO, "2022-08-01", "2022-08-12", "VIIRS_SNPP_SP");
    expect(urls).toHaveLength(3);
    expect(urls[0]).toContain("/KEY/VIIRS_SNPP_SP/-61,-34.5,-58.5,-32.5/5/2022-08-01");
    expect(urls[2]).toContain("/2/2022-08-11");
  });
  it("joins chunks with one header and marks failures", () => {
    const csv = joinCsvChunks([
      { range: "a", text: "latitude,longitude\n1,2\n" },
      { range: "b", text: null },
      { range: "c", text: "latitude,longitude\n3,4" },
    ]);
    expect(csv.split("\n")).toEqual(["latitude,longitude", "1,2", "# missing b", "3,4"]);
  });
});

describe("hexagon AOI geometry", async () => {
  const g = await import("./geo");
  const hex = { lat: -33.5, lon: -59.75, radiusKm: 100 };
  it("builds a closed 6-vertex ring with every vertex at the radius", () => {
    const ring = g.hexagonRing(hex);
    expect(ring).toHaveLength(7);
    expect(ring[0]).toEqual(ring[6]);
    for (const p of ring.slice(0, 6)) expect(g.haversineKm([hex.lon, hex.lat], p)).toBeCloseTo(100, 3);
  });
  it("point-in-ring and bbox", () => {
    const ring = g.hexagonRing(hex);
    expect(g.pointInRing(hex.lon, hex.lat, ring)).toBe(true);
    expect(g.pointInRing(hex.lon + 3, hex.lat, ring)).toBe(false);
    const b = g.ringBox(ring);
    expect(b.minLat).toBeLessThan(hex.lat);
    expect(b.maxLon).toBeGreaterThan(hex.lon);
  });
  it("validates radius and round-trips the URL param", () => {
    expect(() => g.validateHexagon({ ...hex, radiusKm: 1 })).toThrow();
    expect(() => g.validateHexagon({ ...hex, radiusKm: 5000 })).toThrow();
    expect(g.readHexFromUrl(new URLSearchParams(`hex=${g.hexToParam(hex)}`))).toEqual({ lat: -33.5, lon: -59.75, radiusKm: 100 });
  });
});
