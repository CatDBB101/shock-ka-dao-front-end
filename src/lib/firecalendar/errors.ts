import type { ErrorKind } from "./types";
import { COVERED_COUNTRIES_TH } from "./config";

export class FireCalendarError extends Error {
  readonly kind: ErrorKind;
  readonly status?: number;
  constructor(kind: ErrorKind, message: string, status?: number) {
    super(message);
    this.name = "FireCalendarError";
    this.kind = kind;
    this.status = status;
  }
}

export function kindFromStatus(status: number): ErrorKind {
  if (status === 400 || status === 422) return "validation";
  if (status === 404) return "not_covered";
  if (status === 503) return "not_configured";
  return "server";
}

/** Reads both FastAPI error shapes: `{detail: string}` and `{detail: [{loc, msg}]}`. */
export async function readApiError(r: Response): Promise<string> {
  try {
    const body: unknown = await r.json();
    if (body && typeof body === "object" && "detail" in body) {
      const d = (body as { detail: unknown }).detail;
      if (typeof d === "string") return d;
      if (Array.isArray(d))
        return d
          .map((x: { loc?: unknown[]; msg?: string }) => `${String(x.loc?.at(-1) ?? "")}: ${x.msg ?? ""}`)
          .join("; ");
    }
  } catch {
    /* not JSON */
  }
  return `HTTP ${r.status}`;
}

export function toFireCalendarError(e: unknown): FireCalendarError {
  if (e instanceof FireCalendarError) return e;
  // fetch() rejects with TypeError on network/CORS failure
  if (e instanceof TypeError) return new FireCalendarError("network", e.message);
  return new FireCalendarError("server", e instanceof Error ? e.message : String(e));
}

/** Thai message for the UI. */
export function errorMessageTh(e: FireCalendarError): string {
  switch (e.kind) {
    case "validation":
      return e.message;
    case "not_covered":
      return `No data for this area yet. This release covers ${COVERED_COUNTRIES_TH}`;
    case "not_configured":
      return "Raw hotspot download is not configured";
    case "network":
      return "Could not connect";
    default:
      return "Something went wrong on the server";
  }
}
