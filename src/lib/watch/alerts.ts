// Watchpoints + subscriptions. Two implementations behind one interface (like FireCalendarDataSource):
//   LocalAlertService — demo: watchpoints from /watchpoints.json, subscriptions in this browser, NO email sent
//   HttpAlertService  — real backend (VITE_FC_ALERTS_API), contract in docs/adr/ADR-016-firefighter-alerts.md
import { FireCalendarError } from "../firecalendar/errors";
import type { Region } from "../firecalendar/types";
import type { Subscription, Watchpoint, WatchpointFile } from "./types";

export interface AlertService {
  readonly kind: "local" | "http";
  /** true when the backend really emails subscribers */
  readonly sendsEmail: boolean;
  listWatchpoints(): Promise<Watchpoint[]>;
  listSubscriptions(email: string): Promise<Subscription[]>;
  subscribe(email: string, watchpointId: string): Promise<Subscription>;
  unsubscribe(email: string, watchpointId: string): Promise<void>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const normEmail = (e: string) => e.trim().toLowerCase();

export function validateEmail(email: string): string {
  const e = normEmail(email);
  if (!EMAIL_RE.test(e) || e.length > 254) throw new FireCalendarError("validation", "Invalid email address", 400);
  return e;
}

export function validateWatchpoints(f: unknown): Watchpoint[] {
  const list = (f as Partial<WatchpointFile> | null)?.watchpoints;
  if (!Array.isArray(list)) throw new FireCalendarError("server", "The watchpoint file is invalid");
  return list.filter(
    (w): w is Watchpoint =>
      typeof w?.id === "string" &&
      typeof w.name === "string" &&
      [w.lat, w.lon, w.radiusKm].every((n) => typeof n === "number" && Number.isFinite(n)) &&
      Math.abs(w.lat) <= 90 &&
      Math.abs(w.lon) <= 180 &&
      w.radiusKm > 0,
  );
}

// ---------------------------------------------------------------- main backend: GET /api/watchpoint
/** One row of `GET {backend}/watchpoint` → `{ success, data: BackendWatchpoint[] }`. */
export interface BackendWatchpoint {
  name: string;
  country: string;
  /** continent-level, e.g. "Africa", "Asia", "South America" */
  region: string;
  lat: number;
  lon: number;
}

/**
 * Which FireCalendar region's season statistics may be used for a country. Only the 6 countries
 * the calendar was built from: the backend's "Africa" also contains South Sudan, whose fire season
 * (Dec–Feb) is the opposite of Angola's (Jun–Sep), so the continent alone is not enough.
 */
const COUNTRY_REGION: Record<string, Region> = {
  angola: "africa",
  argentina: "south_america",
  brazil: "south_america",
  canada: "canada_usa",
  "united states": "canada_usa",
  usa: "canada_usa",
  australia: "australia",
};

const COUNTRY_TH: Record<string, string> = {
  angola: "Angola",
  argentina: "Argentina",
  brazil: "Brazil",
  canada: "Canada",
  "united states": "United States",
  usa: "United States",
  australia: "Australia",
  "south sudan": "South Sudan",
};

/** Stable id from the coordinates (the backend sends none); subscriptions are keyed by it. */
export const backendWatchpointId = (lat: number, lon: number) => `wp_${lat.toFixed(4)}_${lon.toFixed(4)}`;

export function parseBackendWatchpoints(body: unknown, radiusKm: number): Watchpoint[] {
  const b = body as { success?: unknown; data?: unknown; error?: unknown } | null;
  if (!b || b.success !== true || !Array.isArray(b.data)) {
    const why = typeof b?.error === "string" ? b.error : "unexpected response format";
    throw new FireCalendarError("server", `Could not load watchpoints from the backend: ${why}`);
  }
  const seen = new Set<string>();
  const out: Watchpoint[] = [];
  for (const w of b.data as Partial<BackendWatchpoint>[]) {
    const lat = Number(w?.lat);
    const lon = Number(w?.lon);
    if (typeof w?.name !== "string" || !w.name.trim() || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    const id = backendWatchpointId(lat, lon);
    if (seen.has(id)) continue; // same point listed twice
    seen.add(id);
    const country = typeof w.country === "string" ? w.country.trim() : "";
    const key = country.toLowerCase();
    out.push({
      id,
      name: w.name.trim(),
      // covered countries: the card already shows the FireCalendar region, so only the country here
      area: COUNTRY_REGION[key] ? (COUNTRY_TH[key] ?? country) : [COUNTRY_TH[key] ?? country, typeof w.region === "string" ? w.region : ""].filter(Boolean).join(" · "),
      region: COUNTRY_REGION[key] ?? null,
      country,
      lat,
      lon,
      radiusKm,
    });
  }
  return out;
}

export async function fetchBackendWatchpoints(base: string, radiusKm: number, signal?: AbortSignal): Promise<Watchpoint[]> {
  let r: Response;
  try {
    r = await fetch(`${base}/watchpoint`, { signal, headers: { accept: "application/json" } });
  } catch {
    throw new FireCalendarError("network", "Could not reach the backend (check VITE_FC_BACKEND_API and CORS)");
  }
  let body: unknown = null;
  try {
    body = await r.json();
  } catch {
    /* not json */
  }
  if (!r.ok) {
    const msg = (body as { error?: unknown } | null)?.error;
    throw new FireCalendarError(r.status < 500 ? "validation" : "server", typeof msg === "string" ? msg : `Backend responded HTTP ${r.status}`, r.status);
  }
  return parseBackendWatchpoints(body, radiusKm);
}

/** Where the watchpoint list comes from (shown on the page so nobody mistakes demo points for real ones). */
export type WatchpointSource = "file" | "alerts" | "backend";
type WatchpointLoader = () => Promise<Watchpoint[]>;

const SUBS_KEY = "fc.subscriptions.v1";

export class LocalAlertService implements AlertService {
  readonly kind = "local" as const;
  readonly sendsEmail = false;
  readonly watchpointSource: WatchpointSource;
  constructor(
    private readonly watchpointsUrl = "/watchpoints.json",
    private readonly loader?: WatchpointLoader,
  ) {
    this.watchpointSource = loader ? "backend" : "file";
  }

  async listWatchpoints(): Promise<Watchpoint[]> {
    if (this.loader) return this.loader();
    const r = await fetch(this.watchpointsUrl);
    if (!r.ok) throw new FireCalendarError("server", `Could not load watchpoints (HTTP ${r.status})`, r.status);
    return validateWatchpoints(await r.json());
  }

  private read(): Subscription[] {
    try {
      const v = JSON.parse(localStorage.getItem(SUBS_KEY) ?? "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  private write(s: Subscription[]): void {
    try {
      localStorage.setItem(SUBS_KEY, JSON.stringify(s));
    } catch {
      throw new FireCalendarError("server", "This browser can't save data (private window?)");
    }
  }

  async listSubscriptions(email: string): Promise<Subscription[]> {
    const e = validateEmail(email);
    return this.read().filter((s) => s.email === e);
  }
  async subscribe(email: string, watchpointId: string): Promise<Subscription> {
    const e = validateEmail(email);
    const all = this.read();
    const found = all.find((s) => s.email === e && s.watchpointId === watchpointId);
    if (found) return found;
    const sub: Subscription = { email: e, watchpointId, createdAt: new Date().toISOString(), confirmed: true };
    this.write([...all, sub]);
    return sub;
  }
  async unsubscribe(email: string, watchpointId: string): Promise<void> {
    const e = validateEmail(email);
    this.write(this.read().filter((s) => !(s.email === e && s.watchpointId === watchpointId)));
  }
}

export class HttpAlertService implements AlertService {
  readonly kind = "http" as const;
  readonly sendsEmail = true;
  readonly watchpointSource: WatchpointSource;
  constructor(
    private readonly base: string,
    private readonly loader?: WatchpointLoader,
  ) {
    this.watchpointSource = loader ? "backend" : "alerts";
  }

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    let r: Response;
    try {
      r = await fetch(`${this.base}${path}`, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
    } catch {
      throw new FireCalendarError("network", "Could not reach the alert service");
    }
    if (!r.ok) {
      let detail = `HTTP ${r.status}`;
      try {
        const b = await r.json();
        if (typeof b?.detail === "string") detail = b.detail;
      } catch {
        /* not json */
      }
      throw new FireCalendarError(r.status < 500 ? "validation" : "server", detail, r.status);
    }
    return r.status === 204 ? (undefined as T) : ((await r.json()) as T);
  }

  async listWatchpoints(): Promise<Watchpoint[]> {
    if (this.loader) return this.loader();
    return validateWatchpoints(await this.req<WatchpointFile>("/v1/watchpoints"));
  }
  async listSubscriptions(email: string): Promise<Subscription[]> {
    const e = validateEmail(email);
    const rows = await this.req<{ watchpoint_id: string; email: string; created_at: string; confirmed: boolean }[]>(
      `/v1/subscriptions?email=${encodeURIComponent(e)}`,
    );
    return rows.map((s) => ({ watchpointId: s.watchpoint_id, email: s.email, createdAt: s.created_at, confirmed: s.confirmed }));
  }
  async subscribe(email: string, watchpointId: string): Promise<Subscription> {
    const e = validateEmail(email);
    const s = await this.req<{ watchpoint_id: string; email: string; created_at: string; confirmed: boolean }>("/v1/subscriptions", {
      method: "POST",
      body: JSON.stringify({ email: e, watchpoint_id: watchpointId }),
    });
    return { watchpointId: s.watchpoint_id, email: s.email, createdAt: s.created_at, confirmed: s.confirmed };
  }
  async unsubscribe(email: string, watchpointId: string): Promise<void> {
    const e = validateEmail(email);
    await this.req<void>(`/v1/subscriptions/${encodeURIComponent(watchpointId)}?email=${encodeURIComponent(e)}`, { method: "DELETE" });
  }
}

/**
 * Watchpoints: main backend (`GET {backendApi}/watchpoint`) when set, else the alerts backend,
 * else /watchpoints.json. Subscriptions: alerts backend when set, else this browser only.
 */
export function createAlertService(alertsApi: string, backendApi = "", radiusKm = 25): AlertService & { readonly watchpointSource: WatchpointSource } {
  const loader = backendApi ? () => fetchBackendWatchpoints(backendApi, radiusKm) : undefined;
  return alertsApi ? new HttpAlertService(alertsApi, loader) : new LocalAlertService("/watchpoints.json", loader);
}
