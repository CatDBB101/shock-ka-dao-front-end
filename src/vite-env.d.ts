/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_FC_DATA_MODE?: string;
  readonly VITE_FC_BASE?: string;
  readonly VITE_FIRECALENDAR_API?: string;
  readonly VITE_FIRMS_MAP_KEY?: string;
  readonly VITE_FC_FEATURE_ASK?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
