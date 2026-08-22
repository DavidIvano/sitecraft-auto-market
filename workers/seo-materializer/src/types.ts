import type { CarListing } from "../../../src/lib/types.ts";

export type SeoMaterializerEnv = {
  XANO_API_BASE_URL?: string;
  XANO_SEO_MATERIALIZER_SECRET?: string;
  SEO_MATERIALIZER_TRIGGER_SECRET?: string;
  SEO_MATERIALIZER_ENABLED?: string;
  SEO_MATERIALIZER_DRY_RUN?: string;
  SEO_MATERIALIZER_SCHEDULED_ENABLED?: string;
  SEO_MATERIALIZER_BATCH_SIZE?: string;
  SEO_MATERIALIZER_CONCURRENCY?: string;
  SEO_MATERIALIZER_REQUEST_DELAY_MS?: string;
  SEO_MATERIALIZER_HTTP_TIMEOUT_MS?: string;
};

export type SeoQueueJob = {
  id: number;
  event_type?: string;
  locale_code?: string;
  car_listing_id?: number;
  materialization_generation?: string;
  materialization_cursor?: number;
};
export type MaterializerListing = CarListing & {
  translation_source_hash?: string;
  translation_updated_at?: string | number;
};
export type SnapshotTranslation = {
  car_listing_id: number;
  locale_code: string;
  title: string;
  description: string;
  seo_title?: string;
  seo_description?: string;
  image_alt_texts?: string[];
  translation_status: string;
  source_locale: string;
  source_hash: string;
  updated_at?: string | number;
};
export type SnapshotPage = {
  listings: MaterializerListing[];
  translations: SnapshotTranslation[];
  locales: string[];
  pagination: { page: number; total_pages: number; total: number; limit: number };
};

export type MaterializedFacet = {
  key: string;
  taxonomy_type: string;
  slug: string;
  parent_slug?: string;
  label: string;
  region_slug?: string;
  code?: string;
  price_min?: number;
  price_max?: number;
  price_max_exclusive?: boolean;
};
export type MaterializedRows = {
  listing_index: Record<string, unknown>[];
  facets: MaterializedFacet[];
  edges: Record<string, unknown>[];
  stats: Record<string, unknown>[];
  related: Record<string, unknown>[];
  manifests: Record<string, unknown>[];
  quality: { accepted: number; rejected: number; failures: Record<string, number> };
};
