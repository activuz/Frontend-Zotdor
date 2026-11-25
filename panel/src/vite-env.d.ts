/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute API origin for split hosting, e.g. https://api.zotdor.uz. Empty = same origin. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
