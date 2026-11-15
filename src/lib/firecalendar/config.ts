import type { DataMode } from "./types";

/** Public HF bucket (ADR-015: path A). Verified: CORS + HTTP Range OK. */
export const BUCKET_BASE = "https://huggingface.co/buckets/Ploychomphoo/firecalendar-data/resolve";

const env = import.meta.env;

function readMode(v: string | undefined): DataMode {
  return v === "api" || v === "mock" || v === "static" ? v : "static";
}

export const config = {
  mode: readMode(env.VITE_FC_DATA_MODE),
  /** base for static files: "/data" (same origin) or the bucket */
  base: (env.VITE_FC_BASE || BUCKET_BASE).replace(/\/+$/, ""),
  api: (env.VITE_FIRECALENDAR_API || "http://localhost:7860").replace(/\/+$/, ""),
  firmsKey: env.VITE_FIRMS_MAP_KEY || "",
  featureAsk: env.VITE_FC_FEATURE_ASK === "true",
  /** Firefighter alerts backend (docs/adr/ADR-016). Empty → demo mode: subscriptions kept in this browser, no email. */
  alertsApi: (env.VITE_FC_ALERTS_API || "").replace(/\/+$/, ""),
} as const;

/** Default file names, used when manifest.files is missing a key or points at a glob. */
export const DEFAULT_FILES = {
  calendar_region: "calendar_region.json",
  cell_month: "cell_month.parquet",
  cell_index: "cell_index.parquet",
} as const;

export const FIRST_YM = "2001-01";
export const LAST_YM = "2024-12";
export const REF_YEARS = [2013, 2024] as const;
export const CRITICAL_PCT = 90;
/** AOI smaller than this: show warning and don't flag critical months */
export const MIN_CELLS_FOR_CRITICAL = 20;
export const MAX_HOTSPOT_DAYS = 60;

export const COVERED_COUNTRIES_TH = "แองโกลา อาร์เจนตินา บราซิล แคนาดา สหรัฐฯ และออสเตรเลีย";
export const COVERED_COUNTRIES_EN = "Angola, Argentina, Brazil, Canada, USA, and Australia";
