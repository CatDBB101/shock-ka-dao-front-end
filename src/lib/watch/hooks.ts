import { useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { config } from "../firecalendar/config";
import { FireCalendarError, toFireCalendarError } from "../firecalendar/errors";
import { useDataSource } from "../firecalendar/provider";
import { addDays } from "../firecalendar/time";
import { destination } from "../firecalendar/geo";
import type { Box } from "../firecalendar/types";
import { createAlertService, normEmail } from "./alerts";
import { hotspotsNear, NRT_SOURCES, parseFirmsCsv, type Hotspot } from "./risk";
import type { Subscription, Watchpoint } from "./types";

let service: ReturnType<typeof createAlertService> | null = null;
export const alertService = () => (service ??= createAlertService(config.alertsApi));

const EMAIL_KEY = "fc.ff.email.v1";

/** Firefighter email, remembered in this browser only (convenience). */
export function useStoredEmail(): [string, (e: string) => void] {
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem(EMAIL_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const set = (e: string) => {
    setEmail(e);
    try {
      if (e) localStorage.setItem(EMAIL_KEY, normEmail(e));
      else localStorage.removeItem(EMAIL_KEY);
    } catch {
      /* ignore */
    }
  };
  return [email, set];
}

export function useWatchpoints() {
  return useQuery<Watchpoint[], FireCalendarError>({
    queryKey: ["watch", "points", alertService().kind],
    queryFn: async () => {
      try {
        return await alertService().listWatchpoints();
      } catch (e) {
        throw toFireCalendarError(e);
      }
    },
  });
}

export function useSubscriptions(email: string) {
  const qc = useQueryClient();
  const key = ["watch", "subs", alertService().kind, normEmail(email)];
  const q = useQuery<Subscription[], FireCalendarError>({
    queryKey: key,
    enabled: Boolean(email),
    staleTime: 0,
    queryFn: async () => {
      try {
        return await alertService().listSubscriptions(email);
      } catch (e) {
        throw toFireCalendarError(e);
      }
    },
  });
  const toggle = useMutation<void, FireCalendarError, { id: string; on: boolean }>({
    mutationFn: async ({ id, on }) => {
      try {
        if (on) await alertService().subscribe(email, id);
        else await alertService().unsubscribe(email, id);
      } catch (e) {
        throw toFireCalendarError(e);
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
  return { ...q, toggle };
}

/** Bounding box of the watch circle (FIRMS area API takes rectangles). */
export function circleBox(wp: Pick<Watchpoint, "lat" | "lon" | "radiusKm">): Box {
  const c: [number, number] = [wp.lon, wp.lat];
  const n = destination(c, wp.radiusKm, 0)[1];
  const s = destination(c, wp.radiusKm, 180)[1];
  const e = destination(c, wp.radiusKm, 90)[0];
  const w = destination(c, wp.radiusKm, 270)[0];
  const r = (x: number) => Math.round(x * 1e4) / 1e4;
  return { minLat: r(Math.max(-90, s)), maxLat: r(Math.min(90, n)), minLon: r(Math.max(-180, w)), maxLon: r(Math.min(180, e)) };
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Latest VIIRS NRT hotspots around each watchpoint (yesterday + today UTC, all NRT satellites).
 * Disabled when the data source can't reach FIRMS (no key). Refreshes every 30 min while open.
 */
export function useRecentHotspots(points: Watchpoint[]) {
  const ds = useDataSource();
  const enabled = ds.canDownloadHotspots;
  const results = useQueries({
    queries: points.map((wp) => ({
      queryKey: ["watch", "nrt", ds.mode, wp.id, wp.lat, wp.lon, wp.radiusKm, today()],
      enabled,
      staleTime: 30 * 60_000,
      refetchInterval: 30 * 60_000,
      retry: 1,
      queryFn: async (): Promise<Hotspot[]> => {
        const end = today();
        const start = addDays(end, -1);
        const box = circleBox(wp);
        const parts = await Promise.allSettled(NRT_SOURCES.map((s) => ds.downloadHotspotsCsv(box, start, end, s)));
        if (parts.every((p) => p.status === "rejected")) throw toFireCalendarError((parts[0] as PromiseRejectedResult).reason);
        const all = parts.flatMap((p) => (p.status === "fulfilled" ? parseFirmsCsv(p.value) : []));
        return hotspotsNear(all, wp, new Date());
      },
    })),
  });
  return useMemo(() => {
    const m = new Map<string, { data: Hotspot[] | null; loading: boolean; error: FireCalendarError | null }>();
    points.forEach((wp, i) => {
      const r = results[i];
      m.set(wp.id, {
        data: (r?.data as Hotspot[] | undefined) ?? null,
        loading: Boolean(enabled && r?.isPending),
        error: r?.error ? toFireCalendarError(r.error) : null,
      });
    });
    return { byId: m, enabled };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, enabled, ...results.map((r) => r.dataUpdatedAt), ...results.map((r) => r.status)]);
}
