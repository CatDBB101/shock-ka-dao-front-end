import type { Region } from "../firecalendar/types";

/** A watchpoint defined in advance by the server / admin. Firefighters can only subscribe, not create. */
export interface Watchpoint {
  id: string;
  name: string;
  /** country / area, Thai */
  area: string;
  region: Region;
  lat: number;
  lon: number;
  /** watch circle radius */
  radiusKm: number;
  note?: string;
}

export interface WatchpointFile {
  version: string;
  updated: string;
  watchpoints: Watchpoint[];
}

export interface Subscription {
  watchpointId: string;
  email: string;
  createdAt: string;
  /** http backend: false until the firefighter clicks the confirmation link (double opt-in) */
  confirmed: boolean;
}
