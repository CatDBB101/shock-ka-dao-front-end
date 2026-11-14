// DuckDB-WASM, loaded lazily on the first AOI query (F7.2: keep the dynamic import()).
import type { AsyncDuckDB, AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import type { Box, Region, Source } from "./types";
import { REF_YEARS } from "./config";
import { pointInRing, type LonLat } from "./geo";

let dbPromise: Promise<{ db: AsyncDuckDB; conn: AsyncDuckDBConnection }> | null = null;

async function init() {
  const duckdb = await import("@duckdb/duckdb-wasm");
  // Self-hosted wasm/worker files (Vite `?url`), no CDN dependency.
  const [mvpWasm, mvpWorker, ehWasm, ehWorker] = await Promise.all([
    import("@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url"),
    import("@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url"),
    import("@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url"),
    import("@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url"),
  ]);
  const bundle = await duckdb.selectBundle({
    mvp: { mainModule: mvpWasm.default, mainWorker: mvpWorker.default },
    eh: { mainModule: ehWasm.default, mainWorker: ehWorker.default },
  });
  const worker = new Worker(bundle.mainWorker!);
  const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  const conn = await db.connect();
  return { db, conn };
}

export function getDuckDB() {
  dbPromise ??= init().catch((e) => {
    dbPromise = null; // allow retry
    throw e;
  });
  return dbPromise;
}

/** Make relative bases ("/data") absolute — DuckDB's HTTP reader needs a full URL. */
export function absoluteUrl(base: string, file: string): string {
  const u = `${base}/${file}`;
  return /^https?:\/\//.test(u) ? u : new URL(u, window.location.origin).href;
}

const sqlStr = (s: string) => `'${s.replace(/'/g, "''")}'`;
const num = (n: number) => {
  if (!Number.isFinite(n)) throw new Error("non-finite number in SQL");
  return String(n);
};

export interface AoiQueryRow {
  year: number;
  month: number;
  source: Source;
  value: number;
  modis: number;
  viirs_model: number;
  clim_median: number | null;
  pct_vs_ref: number | null;
}

/** Step 1: cells whose centre lies inside the box (cell_index is ~1 MB). */
export function cellsSql(indexUrl: string, b: Box): string {
  return `SELECT h3, region, lat, lon FROM read_parquet(${sqlStr(indexUrl)})
WHERE lat BETWEEN ${num(b.minLat)} AND ${num(b.maxLat)} AND lon BETWEEN ${num(b.minLon)} AND ${num(b.maxLon)}`;
}

/**
 * Step 2: same SQL as docs/03-api-reference.md layer 4, but with a literal h3 list
 * so DuckDB can push the filter into the parquet scan (cell_month is sorted by h3).
 */
export function aoiSql(monthUrl: string, h3: string[], t0: number, t1: number): string {
  const list = h3.map(sqlStr).join(",");
  const lo = h3.reduce((a, b) => (b < a ? b : a));
  const hi = h3.reduce((a, b) => (b > a ? b : a));
  return `WITH m AS (
  SELECT year, month, source, value, modis, viirs_model FROM read_parquet(${sqlStr(monthUrl)})
  WHERE h3 BETWEEN ${sqlStr(lo)} AND ${sqlStr(hi)} AND h3 IN (${list})),
agg AS (SELECT year, month, sum(value) AS value, sum(modis) AS modis, sum(viirs_model) AS viirs_model, mode(source) AS source
  FROM m WHERE year*12+month BETWEEN ${t0} AND ${t1} GROUP BY ALL),
ref AS (SELECT year, month, sum(value) AS v FROM m WHERE year BETWEEN ${REF_YEARS[0]} AND ${REF_YEARS[1]} GROUP BY ALL),
clim AS (SELECT month, median(v) AS clim_median FROM ref GROUP BY month)
SELECT a.year::INTEGER AS year, a.month::INTEGER AS month, a.source, a.value::DOUBLE AS value, a.modis::DOUBLE AS modis,
  a.viirs_model::DOUBLE AS viirs_model, c.clim_median::DOUBLE AS clim_median,
  (SELECT 100.0 * count(*) FILTER (WHERE r.v <= a.value) / count(*) FROM ref r WHERE r.month = a.month)::DOUBLE AS pct_vs_ref
FROM agg a LEFT JOIN clim c USING (month) ORDER BY a.year, a.month`;
}

export async function queryAoi(
  base: string,
  files: { cell_index: string; cell_month: string },
  box: Box,
  t0: number,
  t1: number,
  polygon?: LonLat[],
): Promise<{ cells: number; region: Region | null; rows: AoiQueryRow[]; h3: string[] }> {
  const { conn } = await getDuckDB();
  // bbox prefilter in SQL, then exact point-in-polygon on cell centres (hexagon AOI)
  const cells = (await conn.query(cellsSql(absoluteUrl(base, files.cell_index), box)))
    .toArray()
    .map((r) => ({ h3: String(r.h3), region: String(r.region) as Region, lat: Number(r.lat), lon: Number(r.lon) }))
    .filter((c) => !polygon || pointInRing(c.lon, c.lat, polygon));
  if (cells.length === 0) return { cells: 0, region: null, rows: [], h3: [] };

  // region = the one with most cells (picks the interval ratios)
  const counts = new Map<Region, number>();
  for (const c of cells) counts.set(c.region, (counts.get(c.region) ?? 0) + 1);
  const region = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];

  const res = await conn.query(aoiSql(absoluteUrl(base, files.cell_month), cells.map((c) => c.h3), t0, t1));
  const rows = res.toArray().map((r) => ({
    year: Number(r.year),
    month: Number(r.month),
    source: String(r.source) as Source,
    value: Number(r.value),
    modis: Number(r.modis),
    viirs_model: Number(r.viirs_model),
    clim_median: r.clim_median == null ? null : Number(r.clim_median),
    pct_vs_ref: r.pct_vs_ref == null ? null : Math.round(Number(r.pct_vs_ref) * 100) / 100,
  }));
  return { cells: cells.length, region, rows, h3: cells.map((c) => c.h3) };
}
