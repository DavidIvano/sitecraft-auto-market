/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_DEAL_FINDER_ENABLED?: string;
  readonly PUBLIC_DEAL_FINDER_USE_MOCK_DATA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
