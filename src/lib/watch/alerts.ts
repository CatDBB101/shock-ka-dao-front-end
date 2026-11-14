// Watchpoints + subscriptions. Two implementations behind one interface (like FireCalendarDataSource):
//   LocalAlertService — demo: watchpoints from /watchpoints.json, subscriptions in this browser, NO email sent
//   HttpAlertService  — real backend (VITE_FC_ALERTS_API), contract in docs/adr/ADR-016-firefighter-alerts.md
import { FireCalendarError } from "../firecalendar/errors";
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
  if (!EMAIL_RE.test(e) || e.length > 254) throw new FireCalendarError("validation", "อีเมลไม่ถูกต้อง", 400);
  return e;
}

export function validateWatchpoints(f: unknown): Watchpoint[] {
  const list = (f as Partial<WatchpointFile> | null)?.watchpoints;
  if (!Array.isArray(list)) throw new FireCalendarError("server", "ไฟล์จุดเฝ้าระวังไม่ถูกต้อง");
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

const SUBS_KEY = "fc.subscriptions.v1";

export class LocalAlertService implements AlertService {
  readonly kind = "local" as const;
  readonly sendsEmail = false;
  constructor(private readonly watchpointsUrl = "/watchpoints.json") {}

  async listWatchpoints(): Promise<Watchpoint[]> {
    const r = await fetch(this.watchpointsUrl);
    if (!r.ok) throw new FireCalendarError("server", `โหลดจุดเฝ้าระวังไม่สำเร็จ (HTTP ${r.status})`, r.status);
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
      throw new FireCalendarError("server", "เบราว์เซอร์นี้บันทึกข้อมูลไม่ได้ (โหมดส่วนตัว?)");
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
  constructor(private readonly base: string) {}

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    let r: Response;
    try {
      r = await fetch(`${this.base}${path}`, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
    } catch {
      throw new FireCalendarError("network", "เชื่อมต่อระบบแจ้งเตือนไม่ได้");
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

export const createAlertService = (api: string): AlertService => (api ? new HttpAlertService(api) : new LocalAlertService());
