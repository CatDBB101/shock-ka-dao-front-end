// App mode: Scientist (history, MODIS / VIIRS / harmonized, CSV) or Firefighter (watchpoints + alerts).
// Pure helpers live here so they can be unit-tested without React.

export type AppMode = "scientist" | "firefighter";
export const MODES: readonly AppMode[] = ["scientist", "firefighter"];
export const DEFAULT_MODE: AppMode = "scientist";
export const MODE_STORAGE_KEY = "fc.mode.v1";

export const MODE_LABEL: Record<AppMode, { en: string; th: string; home: string }> = {
  scientist: { en: "Scientist", th: "นักวิทยาศาสตร์", home: "/" },
  firefighter: { en: "Firefighter", th: "นักผจญเพลิง", home: "/watch" },
};

export const parseMode = (v: string | null | undefined): AppMode | null =>
  v === "scientist" || v === "firefighter" ? v : null;

/** Routes that only make sense in one mode: visiting them switches the mode. Others are shared. */
export function modeForPath(pathname: string): AppMode | null {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/watch" || p.startsWith("/watch/")) return "firefighter";
  if (p === "/explore" || p === "/data") return "scientist";
  return null;
}

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
