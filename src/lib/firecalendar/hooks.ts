// Layer 1 — the ONLY way UI code gets data. components must not fetch / query DuckDB / call the API directly
import { useQuery } from "@tanstack/react-query";
import type { AoiCalendar, Box, Region, YearMonth } from "./types";
import { useDataSource } from "./provider";
import { FireCalendarError, toFireCalendarError } from "./errors";
import { fillMonths } from "./time";
import { FIRST_YM, LAST_YM } from "./config";
import type { LonLat } from "./geo";

const wrap = async <T,>(p: Promise<T>): Promise<T> => {
  try {
    return await p;
  } catch (e) {
    throw toFireCalendarError(e);
  }
};

export function useMeta() {
  const ds = useDataSource();
  return useQuery<Awaited<ReturnType<typeof ds.getMeta>>, FireCalendarError>({
    queryKey: ["fc", ds.mode, "meta"],
    queryFn: () => wrap(ds.getMeta()),
  });
}

export function useRegionCalendar(region: Region, start: YearMonth = FIRST_YM, end: YearMonth = LAST_YM) {
  const ds = useDataSource();
  return useQuery<Awaited<ReturnType<typeof ds.getRegionCalendar>>, FireCalendarError>({
    queryKey: ["fc", ds.mode, "region", region, start, end],
    queryFn: () => wrap(ds.getRegionCalendar(region, start, end)),
  });
}

/** box = null → not selected yet, no query. rows are filled with zero months. */
export function useAoiCalendar(box: Box | null, start: YearMonth = FIRST_YM, end: YearMonth = LAST_YM, polygon?: LonLat[]) {
  const ds = useDataSource();
  const polyKey = polygon ? polygon.map((p) => p.map((n) => n.toFixed(5)).join(" ")).join(",") : null;
  return useQuery<AoiCalendar, FireCalendarError>({
    queryKey: ["fc", ds.mode, "aoi", box?.minLat, box?.minLon, box?.maxLat, box?.maxLon, start, end, polyKey],
    enabled: box !== null,
    // validation / not_covered won't change on retry
    retry: (n, e) => n < 1 && (e.kind === "network" || e.kind === "server"),
    queryFn: async () => {
      const a = await wrap(ds.getAoiCalendar(box!, start, end, polygon));
      return { ...a, rows: fillMonths(a.rows, start, end) };
    },
  });
}
