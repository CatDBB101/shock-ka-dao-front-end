// App mode: Scientist (history, MODIS / VIIRS / harmonized, CSV), Firefighter (watchpoints + alerts + forecast)
// or Simulator (3D what-if fire scenarios).
// Pure helpers live here so they can be unit-tested without React.

export type AppMode = "scientist" | "firefighter" | "simulator";
export const MODES: readonly AppMode[] = ["scientist", "firefighter", "simulator"];
export const DEFAULT_MODE: AppMode = "scientist";
export const MODE_STORAGE_KEY = "fc.mode.v1";

export const MODE_LABEL: Record<AppMode, { en: string; th: string; home: string; tagline: string }> = {
  scientist: { en: "Scientist", th: "Scientist", home: "/", tagline: "Monthly fire history 2001–2024 for analysis and download" },
  firefighter: { en: "Firefighter", th: "Firefighter", home: "/watch", tagline: "Current situation and fire spread forecast for the next 72 hours" },
  simulator: { en: "Simulator", th: "3D Simulator", home: "/simulator", tagline: "Test fire scenarios on 3D terrain: set wind and fuel, draw firebreaks" },
};

/**
 * Which pages belong to which role. Single source of truth for the nav and for route → mode.
 *   Scientist  = the past: harmonized calendar, area exploration, data export
 *   Firefighter = now / next: watchpoints, live hotspots, alerts, spread forecast
 *   Simulator   = what if: 3D terrain playback of a scenario the user sets up (wind, fuel, firebreaks)
 *   shared      = how much to trust the numbers (evidence) and project info (about)
 */
export const MODE_ROUTES: Record<AppMode | "shared", readonly string[]> = {
  scientist: ["/", "/explore", "/data", "/ask"],
  firefighter: ["/watch", "/spread"],
  simulator: ["/simulator"],
  shared: ["/evidence", "/about"],
};

export const parseMode = (v: string | null | undefined): AppMode | null =>
  v === "scientist" || v === "firefighter" || v === "simulator" ? v : null;

/**
 * Routes that only make sense in one mode: visiting them switches the mode. Shared and unknown routes → null.
 * The site root "/" is the scientist home but does NOT force the mode: a firefighter opening the site
 * keeps their mode and is sent to /watch instead (see homeRedirect).
 */
export function modeForPath(pathname: string): AppMode | null {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/") return null;
  for (const m of MODES) if (MODE_ROUTES[m].some((r) => r !== "/" && (p === r || p.startsWith(`${r}/`)))) return m;
  return null;
}

/** Where to send someone who opens the site root in this mode (null = stay). */
export const homeRedirect = (pathname: string, mode: AppMode): string | null =>
  (pathname.replace(/\/+$/, "") || "/") === "/" && mode !== "scientist" ? MODE_LABEL[mode].home : null;

export function readStoredMode(): AppMode | null {
  try {
    return parseMode(localStorage.getItem(MODE_STORAGE_KEY));
  } catch {
    return null; // private window / blocked storage
  }
}

export function storeMode(m: AppMode): void {
  try {
    localStorage.setItem(MODE_STORAGE_KEY, m);
  } catch {
    /* ignore */
  }
}
