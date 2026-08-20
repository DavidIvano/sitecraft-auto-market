import { getEnabledPublicLocaleDefinitions } from "../../i18n/release4.ts";
import { isStrictSeoReleaseLocale } from "../../i18n/releaseStage3.ts";
import {
  RELEASE4_FLAGS,
  SEO_SITEMAP_COMPATIBILITY_FALLBACK_ENABLED,
  SEO_SITEMAP_SHARDS_ENABLED,
} from "../config.ts";
import {
  getLocalizedSeoListingSitemapShardPayload,
  getSeoSitemapManifestPayload,
} from "../xano.ts";
import {
  SITEMAP_LISTING_SHARD_SIZE,
  normalizeSeoListingSitemapShard,
  normalizeSeoSitemapManifest,
  type SeoListingSitemapShard,
  type SeoSitemapManifest,
} from "./sitemapApi.ts";

export async function loadSeoSitemapManifest(): Promise<SeoSitemapManifest | null> {
  if (!SEO_SITEMAP_SHARDS_ENABLED) return null;
  try {
    const payload = await getSeoSitemapManifestPayload();
    if (payload === null) throw new Error("SEO sitemap manifest endpoint is missing");
    const expectedLocales = getEnabledPublicLocaleDefinitions(RELEASE4_FLAGS)
      .map((definition) => definition.code)
      .filter(isStrictSeoReleaseLocale);
    return normalizeSeoSitemapManifest(payload, expectedLocales);
  } catch (error) {
    if (SEO_SITEMAP_COMPATIBILITY_FALLBACK_ENABLED) return null;
    throw error;
  }
}

export async function loadSeoListingSitemapShard(input: {
  locale: string;
  generation: string;
  page: number;
}): Promise<SeoListingSitemapShard | null> {
  if (!SEO_SITEMAP_SHARDS_ENABLED) return null;
  const payload = await getLocalizedSeoListingSitemapShardPayload({
    locale: input.locale,
    generation: input.generation,
    page: input.page,
    limit: SITEMAP_LISTING_SHARD_SIZE,
  });
  return normalizeSeoListingSitemapShard(payload, {
    locale: input.locale,
    generation: input.generation,
    requestedPage: input.page,
  });
}
