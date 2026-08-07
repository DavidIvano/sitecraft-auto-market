/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_DEAL_FINDER_ENABLED?: string;
  readonly PUBLIC_DEAL_FINDER_USE_MOCK_DATA?: string;
  readonly I18N_ENABLED?: string;
  readonly I18N_API_READ_ENABLED?: string;
  readonly I18N_ADMIN_TEST_LOCALE_AWARE_READ_ENABLED?: string;
  readonly I18N_DUAL_WRITE_ENABLED?: string;
  readonly I18N_PUBLIC_ROUTES_ENABLED?: string;
  readonly I18N_AI_TRANSLATION_ENABLED?: string;
  readonly I18N_LOCALE_DE_ENABLED?: string;
  readonly I18N_LOCALE_EN_ENABLED?: string;
  readonly I18N_LOCALE_UK_ENABLED?: string;
  readonly I18N_LOCALE_ZH_HANS_ENABLED?: string;
  readonly PUBLIC_I18N_ENABLED?: string;
  readonly PUBLIC_I18N_API_READ_ENABLED?: string;
  readonly PUBLIC_I18N_ADMIN_TEST_LOCALE_AWARE_READ_ENABLED?: string;
  readonly PUBLIC_I18N_DUAL_WRITE_ENABLED?: string;
  readonly PUBLIC_I18N_PUBLIC_ROUTES_ENABLED?: string;
  readonly PUBLIC_I18N_AI_TRANSLATION_ENABLED?: string;
  readonly PUBLIC_I18N_LOCALE_DE_ENABLED?: string;
  readonly PUBLIC_I18N_LOCALE_EN_ENABLED?: string;
  readonly PUBLIC_I18N_LOCALE_UK_ENABLED?: string;
  readonly PUBLIC_I18N_LOCALE_ZH_HANS_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
