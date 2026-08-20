/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_XANO_API_URL?: string;
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_DEAL_FINDER_ENABLED?: string;
  readonly PUBLIC_DEAL_FINDER_USE_MOCK_DATA?: string;
  readonly PUBLIC_SEO_TAXONOMY_API_ENABLED?: string;
  readonly PUBLIC_SEO_TAXONOMY_COMPATIBILITY_FALLBACK_ENABLED?: string;
  readonly PUBLIC_SEO_CATALOG_API_ENABLED?: string;
  readonly PUBLIC_SEO_CATALOG_COMPATIBILITY_FALLBACK_ENABLED?: string;
  readonly PUBLIC_SEO_SITEMAP_SHARDS_ENABLED?: string;
  readonly PUBLIC_SEO_SITEMAP_COMPATIBILITY_FALLBACK_ENABLED?: string;
  readonly I18N_ENABLED?: string;
  readonly I18N_API_READ_ENABLED?: string;
  readonly I18N_ADMIN_TEST_LOCALE_AWARE_READ_ENABLED?: string;
  readonly I18N_DUAL_WRITE_ENABLED?: string;
  readonly I18N_PUBLIC_ROUTES_ENABLED?: string;
  readonly I18N_AI_TRANSLATION_ENABLED?: string;
  readonly PUBLIC_I18N_ENABLED?: string;
  readonly PUBLIC_I18N_API_READ_ENABLED?: string;
  readonly PUBLIC_I18N_ADMIN_TEST_LOCALE_AWARE_READ_ENABLED?: string;
  readonly PUBLIC_I18N_DUAL_WRITE_ENABLED?: string;
  readonly PUBLIC_I18N_PUBLIC_ROUTES_ENABLED?: string;
  readonly PUBLIC_I18N_AI_TRANSLATION_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
