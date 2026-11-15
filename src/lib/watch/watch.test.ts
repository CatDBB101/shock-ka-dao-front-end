import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { assessWatchpoint, hotspotsNear, inSeason, monthDist, parseFirmsCsv, seasonLevel } from "./risk";
import { validateEmail, validateWatchpoints } from "./alerts";
import { circleBox } from "./hooks";
import { homeRedirect, modeForPath, parseMode } from "../mode/mode";
import { haversineKm } from "../firecalendar/geo";
import { aoiToCsv } from "../../components/firecalendar/SeriesTools";
import { seriesValue } from "../../components/firecalendar/CalendarGrid";
import type { AoiRow, Season } from "../firecalendar/types";

const CSV = [
  "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight",
  "-33.20,-60.10,330.1,0.4,0.4,2026-11-14,0412,N20,VIIRS,n,2.0NRT,290.1,12.5,N",
  "-33.25,-60.05,340.0,0.4,0.4,2026-11-13,1745,N21,VIIRS,h,2.0NRT,295.0,30.2,D",
  "-33.21,-60.11,310.0,0.4,0.4,2026-11-14,0412,N20,VIIRS,l,2.0NRT,280.0,1.1,N",
  "-35.00,-60.10,330.0,0.4,0.4,2026-11-14,0412,N20,VIIRS,n,2.0NRT,290.0,5.0,N",
  "-33.20,-60.10,330.0,0.4,0.4,2026-11-10,0412,N20,VIIRS,n,2.0NRT,290.0,5.0,N",
  "# missing 2026-11-12..2026-11-16",
].join("\n");
const WP = { lat: -33.2, lon: -60.1, radiusKm: 40 };
const NOW = new Date("2026-11-14T12:00:00Z");
const AFRICA: Season = { peak_month: 8, start_month: 5, end_month: 9, method: "" };
const SOUTH_AMERICA: Season = { peak_month: 9, start_month: 7, end_month: 12, method: "" };

describe("FIRMS CSV parsing", () => {
  it("parses rows, skips comments, builds UTC time", () => {
    const h = parseFirmsCsv(CSV);
    expect(h).toHaveLength(5);
    expect(h[0]).toMatchObject({ lat: -33.2, lon: -60.1, time: "2026-11-14T04:12:00Z", frp: 12.5, confidence: "n" });
  });
  it("returns [] for an error body", () => {
    expect(parseFirmsCsv("Invalid MAP_KEY.")).toEqual([]);
  });
});

describe("hotspotsNear", () => {
  it("keeps only in-radius, recent, non-low-confidence hotspots", () => {
    const near = hotspotsNear(parseFirmsCsv(CSV), WP, NOW);
    // dropped: low confidence, ~200 km away, 4 days old
    expect(near.map((h) => h.frp)).toEqual([12.5, 30.2]);
  });
});

describe("season", () => {
  it("handles wrap-around seasons", () => {
    expect(inSeason(1, { start_month: 10, end_month: 3 })).toBe(true);
    expect(inSeason(6, { start_month: 10, end_month: 3 })).toBe(false);
    expect(inSeason(7, AFRICA)).toBe(true);
  });
  it("circular month distance", () => {
    expect(monthDist(12, 1)).toBe(1);
    expect(monthDist(1, 7)).toBe(6);
  });
  it("level from the region season", () => {
    expect(seasonLevel(8, AFRICA)).toBe("high");
    expect(seasonLevel(9, AFRICA)).toBe("high");
    expect(seasonLevel(5, AFRICA)).toBe("elevated");
    expect(seasonLevel(11, AFRICA)).toBe("normal");
    expect(seasonLevel(11, undefined)).toBe("normal");
  });
});

describe("assessWatchpoint", () => {
  it("hotspots override the season level", () => {
    const s = assessWatchpoint({ month: 11, season: AFRICA, near: hotspotsNear(parseFirmsCsv(CSV), WP, NOW) });
    expect(s.level).toBe("active");
    expect(s.seasonLevel).toBe("normal");
    expect(s.maxFrp).toBe(30.2);
  });
  it("not checked → season only, no hotspot sentence", () => {
    const s = assessWatchpoint({ month: 11, season: SOUTH_AMERICA, near: null });
    expect(s.level).toBe("elevated");
    expect(s.hotspots).toBeNull();
    expect(s.reasons.some((r) => r.includes("detected"))).toBe(false);
  });
});

describe("watchpoints + email", () => {
  it("public/watchpoints.json is valid and inside coverage regions", () => {
    const f = JSON.parse(readFileSync("public/watchpoints.json", "utf8"));
    const list = validateWatchpoints(f);
    expect(list.length).toBe(f.watchpoints.length);
    expect(new Set(list.map((w) => w.id)).size).toBe(list.length);
    for (const w of list) expect(["africa", "south_america", "canada_usa", "australia"]).toContain(w.region);
  });
  it("drops malformed watchpoints", () => {
    expect(validateWatchpoints({ watchpoints: [{ id: "x", name: "x", lat: 200, lon: 0, radiusKm: 5 }] })).toEqual([]);
  });
  it("validates and normalises email", () => {
    expect(validateEmail("  Ranger@Example.ORG ")).toBe("ranger@example.org");
    expect(() => validateEmail("not-an-email")).toThrow();
  });
  it("circleBox covers the watch circle", () => {
    const b = circleBox(WP);
    expect(haversineKm([WP.lon, b.maxLat], [WP.lon, WP.lat])).toBeCloseTo(40, 0);
    expect(b.minLon).toBeLessThan(WP.lon);
    expect(b.maxLon).toBeGreaterThan(WP.lon);
  });
});

describe("mode", () => {
  it("parses and maps exclusive routes", () => {
    expect(parseMode("firefighter")).toBe("firefighter");
    expect(parseMode("admin")).toBeNull();
    expect(modeForPath("/watch")).toBe("firefighter");
    expect(modeForPath("/explore/")).toBe("scientist");
    expect(modeForPath("/evidence")).toBeNull();
    expect(modeForPath("/")).toBeNull(); // scientist home, but must not override a firefighter's mode
    expect(homeRedirect("/", "firefighter")).toBe("/watch");
    expect(homeRedirect("/", "scientist")).toBeNull();
    expect(homeRedirect("/watch", "firefighter")).toBeNull();
    expect(parseMode("simulator")).toBe("simulator");
    expect(modeForPath("/simulator")).toBe("simulator");
    expect(homeRedirect("/", "simulator")).toBe("/simulator");
    expect(modeForPath("/data")).toBe("scientist");
    expect(modeForPath("/spread")).toBe("firefighter");
    expect(modeForPath("/about")).toBeNull();
    expect(modeForPath("/nope")).toBeNull();
  });
});

describe("scientist series", () => {
  const backcast: AoiRow = { year: 2010, month: 8, source: "backcast", value: 500.5, modis: 120, viirs_model: 500.5, p_lo: 400, p_hi: 600, clim_median: 300, pct_vs_ref: 100 };
  const observed: AoiRow = { ...backcast, year: 2022, source: "observed", value: 6593, modis: 1310, viirs_model: 5456, p_lo: 6593, p_hi: 6593, pct_vs_ref: 91.67 };
  it("VIIRS series is empty before VIIRS existed", () => {
    expect(seriesValue(backcast, "viirs")).toBeNull();
    expect(seriesValue(observed, "viirs")).toBe(6593);
    expect(seriesValue(backcast, "modis")).toBe(120);
    expect(seriesValue(backcast, "harmonized")).toBe(500.5);
  });
  it("AOI CSV has all three instruments", () => {
    const [head, r1, r2] = aoiToCsv([backcast, observed]).split("\n");
    expect(head).toBe("year,month,source,harmonized,p_lo,p_hi,modis,viirs_obs,viirs_model,clim_median,pct_vs_ref");
    expect(r1).toBe("2010,8,backcast,500.5,400,600,120,,500.5,300,100");
    expect(r2).toBe("2022,8,observed,6593,6593,6593,1310,6593,5456,300,91.67");
  });
});
