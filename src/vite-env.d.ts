/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_FC_DATA_MODE?: string;
  readonly VITE_FC_BASE?: string;
  readonly VITE_FIRECALENDAR_API?: string;
  readonly VITE_FIRMS_MAP_KEY?: string;
  readonly VITE_FC_FEATURE_ASK?: string;
  readonly VITE_FC_ALERTS_API?: string;
  readonly VITE_FC_BACKEND_API?: string;
  readonly VITE_FC_WATCH_RADIUS_KM?: string;
  readonly VITE_FC_CANOPY_BASE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
