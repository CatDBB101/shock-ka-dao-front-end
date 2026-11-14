import type {
  AoiCalendar,
  AoiRow,
  Box,
  CalendarFile,
  DataMode,
  FirmsSource,
  IntervalRatio,
  Manifest,
  Meta,
  Region,
  RegionCalendar,
  YearMonth,
} from "./types";
import { REGIONS } from "./types";
import { config, DEFAULT_FILES, FIRST_YM, LAST_YM } from "./config";
import { FireCalendarError, kindFromStatus, readApiError, toFireCalendarError } from "./errors";
import { validateBox, validateDays, validateRange } from "./validate";
import { tIndex, ymToT } from "./time";
import { downloadFirmsCsv } from "./firms";
import type { LonLat } from "./geo";

/** Layer 2 — one interface, three implementations, switched by VITE_FC_DATA_MODE. */
export interface FireCalendarDataSource {
  readonly mode: DataMode;
  getMeta(): Promise<Meta>;
  getRegionCalendar(region: Region, start?: YearMonth, end?: YearMonth): Promise<RegionCalendar>;
  /** rows are sparse (not filled). polygon ([lon,lat] ring) narrows the box to cells whose centre is inside. */
  getAoiCalendar(box: Box, start?: YearMonth, end?: YearMonth, polygon?: LonLat[]): Promise<AoiCalendar>;
  /** A direct link (api mode). null = use downloadHotspotsCsv or hide the button. */
  hotspotsCsvUrl(box: Box, startDate: string, endDate: string, source?: FirmsSource): string | null;
  /** Can raw hotspots be downloaded at all in this mode? */
  readonly canDownloadHotspots: boolean;
  downloadHotspotsCsv(box: Box, startDate: string, endDate: string, source?: FirmsSource): Promise<string>;
  /** Base URL for the static data files (Data page links). */
  readonly filesBase: string | null;
}

const NOTE = "ranges use region-level monthly ratios; single cells are uncertain";
const AOI_TIMEOUT_MS = 120_000;
const FETCH_TIMEOUT_MS = 30_000;

/** Reject with a retryable network error instead of leaving the UI on a skeleton forever. */
export function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new FireCalendarError("network", message)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t));
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), ...init });
  } catch (e) {
    if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError"))
      throw new FireCalendarError("network", "เซิร์ฟเวอร์ตอบช้าเกินไป");
    throw toFireCalendarError(e);
  }
  if (!r.ok) throw new FireCalendarError(kindFromStatus(r.status), await readApiError(r), r.status);
  try {
    return (await r.json()) as T;
  } catch {
    // e.g. an SPA fallback returning index.html when a data file is missing
    throw new FireCalendarError("server", `ไฟล์ข้อมูลไม่ใช่ JSON: ${url.split("?")[0]}`);
  }
}

function inRange<T extends { year: number; month: number }>(rows: T[], start = FIRST_YM, end = LAST_YM): T[] {
  const t0 = ymToT(start);
  const t1 = ymToT(end);
  return rows.filter((r) => {
    const t = tIndex(r.year, r.month);
    return t >= t0 && t <= t1;
  });
}

function buildMeta(m: Manifest, cal: CalendarFile): Meta {
  return {
    ...m,
    unit: cal.unit,
    sources: cal.sources,
    season: cal.season,
    regions: [...REGIONS],
    years: [Math.min(...cal.rows.map((r) => r.year)), Math.max(...cal.rows.map((r) => r.year))],
  };
}

/** Use manifest.files when it names a single file; fall back for missing keys or globs. */
export function resolveFile(m: Pick<Manifest, "files"> | null, key: keyof typeof DEFAULT_FILES): string {
  const f = m?.files?.[key];
  return f && !f.includes("*") ? f : DEFAULT_FILES[key];
}

export function withIntervals(rows: Omit<AoiRow, "p_lo" | "p_hi">[], ratio: IntervalRatio | undefined): AoiRow[] {
  return rows.map((r) => {
    if (r.source === "observed" || !ratio) return { ...r, p_lo: r.value, p_hi: r.value };
    return { ...r, p_lo: r.value * ratio.q10, p_hi: r.value * ratio.q90 };
  });
}

// ---------------------------------------------------------------- static (path A)
export class StaticSource implements FireCalendarDataSource {
  readonly mode = "static" as const;
  readonly canDownloadHotspots: boolean;
  readonly filesBase: string;
  private manifestP: Promise<Manifest> | null = null;
  private calendarP: Promise<CalendarFile> | null = null;
  private readonly base: string;
  private readonly firmsKey: string;
  constructor(base: string, firmsKey: string) {
    this.base = base;
    this.filesBase = base;
    this.firmsKey = firmsKey;
    this.canDownloadHotspots = Boolean(firmsKey);
  }

  private manifest(): Promise<Manifest> {
    // manifest.json is the version marker — never cache
    this.manifestP ??= getJson<Manifest>(`${this.base}/manifest.json?t=${Date.now()}`, { cache: "no-store" }).catch((e) => {
      this.manifestP = null;
      throw e;
    });
    return this.manifestP;
  }

  private calendar(): Promise<CalendarFile> {
    this.calendarP ??= this.manifest()
      .then((m) => getJson<CalendarFile>(`${this.base}/${resolveFile(m, "calendar_region")}?v=${m.data_version}`))
      .catch((e) => {
        this.calendarP = null;
        throw e;
      });
    return this.calendarP;
  }

  async getMeta(): Promise<Meta> {
    const [m, c] = await Promise.all([this.manifest(), this.calendar()]);
    return buildMeta(m, c);
  }

  async getRegionCalendar(region: Region, start?: YearMonth, end?: YearMonth): Promise<RegionCalendar> {
    validateRange(start, end);
    if (!REGIONS.includes(region)) throw new FireCalendarError("validation", `unknown region '${region}'`, 422);
    const c = await this.calendar();
    return { region, season: c.season[region], rows: inRange(c.rows.filter((r) => r.region === region), start, end) };
  }

  async getAoiCalendar(box: Box, start: YearMonth = FIRST_YM, end: YearMonth = LAST_YM, polygon?: LonLat[]): Promise<AoiCalendar> {
    validateBox(box);
    validateRange(start, end);
    const m = await this.manifest();
    const { queryAoi } = await import("./duckdb");
    let res;
    try {
      res = await withTimeout(
        queryAoi(
          this.base,
          { cell_index: resolveFile(m, "cell_index"), cell_month: resolveFile(m, "cell_month") },
          box,
          ymToT(start),
          ymToT(end),
          polygon,
        ),
        AOI_TIMEOUT_MS,
        "คำนวณนานเกินไป (เกิน 2 นาที) ลองกรอบที่เล็กลง หรือกดลองใหม่",
      );
    } catch (e) {
      throw e instanceof FireCalendarError ? e : new FireCalendarError("network", `อ่านไฟล์ข้อมูลไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (res.cells === 0 || !res.region)
      throw new FireCalendarError("not_covered", "no covered cells in this box", 404);
    return { cells: res.cells, region: res.region, note: NOTE, h3: res.h3, rows: withIntervals(res.rows, m.calendar_interval_ratios[res.region]) };
  }

  hotspotsCsvUrl(): string | null {
    return null;
  }

  downloadHotspotsCsv(box: Box, startDate: string, endDate: string, source: FirmsSource = "VIIRS_SNPP_SP"): Promise<string> {
    return downloadFirmsCsv(this.firmsKey, box, startDate, endDate, source);
  }
}

// ---------------------------------------------------------------- api (path B, phase 6)
export class ApiSource implements FireCalendarDataSource {
  readonly mode = "api" as const;
  readonly canDownloadHotspots = true;
  readonly filesBase = null;
  readonly base: string;
  constructor(base: string) {
    this.base = base;
  }

  private url(path: string, q: Record<string, string | number | undefined>): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined) sp.set(k, String(v));
    const s = sp.toString();
    return `${this.base}${path}${s ? `?${s}` : ""}`;
  }

  /** Wake a sleeping HF Space. */
  async health(): Promise<boolean> {
    try {
      const r = await fetch(`${this.base}/health`);
      return r.ok;
    } catch {
      return false;
    }
  }

  getMeta(): Promise<Meta> {
    return getJson<Meta>(this.url("/v1/meta", {}));
  }

  getRegionCalendar(region: Region, start?: YearMonth, end?: YearMonth): Promise<RegionCalendar> {
    validateRange(start, end);
    return getJson<RegionCalendar>(this.url("/v1/calendar/region", { region, start, end }));
  }

  async getAoiCalendar(box: Box, start?: YearMonth, end?: YearMonth, polygon?: LonLat[]): Promise<AoiCalendar> {
    validateBox(box);
    validateRange(start, end);
    const a = await getJson<AoiCalendar>(
      this.url("/v1/calendar/aoi", { min_lat: box.minLat, min_lon: box.minLon, max_lat: box.maxLat, max_lon: box.maxLon, start, end }),
    );
    // the API only takes a bbox: say so instead of pretending it is the hexagon
    return polygon ? { ...a, note: `${a.note ?? ""} · API mode: hexagon approximated by its bounding box`.replace(/^ · /, "") } : a;
  }

  hotspotsCsvUrl(box: Box, startDate: string, endDate: string, source: FirmsSource = "VIIRS_SNPP_SP"): string {
    return this.url("/v1/hotspots.csv", {
      min_lat: box.minLat,
      min_lon: box.minLon,
      max_lat: box.maxLat,
      max_lon: box.maxLon,
      start: startDate,
      end: endDate,
      source,
    });
  }

  async downloadHotspotsCsv(box: Box, startDate: string, endDate: string, source?: FirmsSource): Promise<string> {
    validateBox(box);
    validateDays(startDate, endDate);
    let r: Response;
    try {
      r = await fetch(this.hotspotsCsvUrl(box, startDate, endDate, source));
    } catch (e) {
      throw toFireCalendarError(e);
    }
    if (!r.ok) throw new FireCalendarError(kindFromStatus(r.status), await readApiError(r), r.status);
    return r.text();
  }
}

// ---------------------------------------------------------------- mock
/** Reads /mocks/* (cut from the real data). AOI returns the Rosario box for every box. */
export class MockSource implements FireCalendarDataSource {
  readonly mode = "mock" as const;
  readonly canDownloadHotspots = false;
  readonly filesBase = "/mocks";
  private readonly base: string;
  constructor(base = "/mocks") {
    this.base = base;
  }
  getMeta(): Promise<Meta> {
    return getJson<Meta>(`${this.base}/meta.json`);
  }
  async getRegionCalendar(region: Region, start?: YearMonth, end?: YearMonth): Promise<RegionCalendar> {
    validateRange(start, end);
    const c = await getJson<CalendarFile>(`${this.base}/calendar_region.json`);
    return { region, season: c.season[region], rows: inRange(c.rows.filter((r) => r.region === region), start, end) };
  }
  async getAoiCalendar(box: Box, start?: YearMonth, end?: YearMonth): Promise<AoiCalendar> {
    validateBox(box);
    validateRange(start, end);
    const a = await getJson<AoiCalendar>(`${this.base}/aoi.json`);
    return { ...a, rows: inRange(a.rows, start, end) };
  }
  hotspotsCsvUrl(): null {
    return null;
  }
  downloadHotspotsCsv(): Promise<string> {
    return Promise.reject(new FireCalendarError("not_configured", "mock mode has no hotspot export", 503));
  }
}

export function createDataSource(mode: DataMode = config.mode): FireCalendarDataSource {
  if (mode === "api") return new ApiSource(config.api);
  if (mode === "mock") return new MockSource();
  return new StaticSource(config.base, config.firmsKey);
}
