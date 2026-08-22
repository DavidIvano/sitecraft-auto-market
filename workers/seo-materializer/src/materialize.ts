import { normalizeBackendValue } from "../../../src/i18n/backendValues.ts";
import { evaluateListingSeoQuality } from "../../../src/lib/seo/listingQuality.ts";
import { getSeoRegionForLocation } from "../../../src/lib/seo/locationSeo.ts";
import {
  SEO_PRICE_BUCKETS,
  SEO_TAXONOMY_MIN_LISTINGS,
  getSeoPriceBucketsForValue,
} from "../../../src/lib/seo/taxonomies.ts";
import { normalizeVehicleFacetSlug } from "../../../src/lib/seo/vehicleTaxonomy.ts";
import type { CarListing } from "../../../src/lib/types.ts";
import type {
  MaterializedFacet,
  MaterializedRows,
  MaterializerListing,
  SnapshotTranslation,
} from "./types.ts";

const clean = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const timestamp = (value: unknown) => {
  const date = new Date(typeof value === "number" || /^\d+$/.test(String(value ?? "")) ? Number(value) : String(value ?? ""));
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
};
const facetKey = (type: string, slug: string, parent = "") => `${type}:${parent}:${slug}`;

const isPublicStatus = (listing: CarListing) => {
  const allowed = new Set(["approved", "published", "sold"]);
  const denied = new Set(["draft", "ai_draft", "pending_review", "needs_fix", "rejected", "blocked", "deleted", "archived"]);
  const status = clean(listing.status).toLowerCase();
  const moderation = clean(listing.moderation_status).toLowerCase();
  return (allowed.has(status) || allowed.has(moderation)) && !denied.has(status) && !denied.has(moderation);
};

export function resolveLocalizedListings(
  listings: MaterializerListing[],
  translations: SnapshotTranslation[],
  locales: string[],
) {
  const byListing = new Map<number, SnapshotTranslation[]>();
  for (const translation of translations) {
    const rows = byListing.get(translation.car_listing_id) || [];
    rows.push(translation);
    byListing.set(translation.car_listing_id, rows);
  }
  const result = new Map<string, MaterializerListing[]>();
  for (const locale of locales) result.set(locale, []);

  for (const listing of listings.filter(isPublicStatus)) {
    const sourceLocale = clean(listing.source_locale).toLowerCase();
    const sourceHash = clean(listing.translation_source_hash).toLowerCase();
    for (const locale of locales) {
      let localized: MaterializerListing | null = null;
      if (locale === sourceLocale && clean(listing.title) && clean(listing.description)) {
        localized = { ...listing, available_locales: [locale], translations_ready: true };
      } else {
        const translation = (byListing.get(Number(listing.id)) || []).find((row) => (
          clean(row.locale_code).toLowerCase() === locale
          && ["completed", "reviewed"].includes(clean(row.translation_status).toLowerCase())
          && clean(row.source_locale).toLowerCase() === sourceLocale
          && clean(row.source_hash).toLowerCase() === sourceHash
          && clean(row.title)
          && clean(row.description)
        ));
        if (translation) {
          localized = {
            ...listing,
            title: clean(translation.title),
            description: clean(translation.description),
            seo_title: clean(translation.seo_title),
            seo_description: clean(translation.seo_description),
            image_alt_texts: translation.image_alt_texts || [],
            translation_updated_at: translation.updated_at,
            available_locales: [locale],
            translations_ready: true,
          };
        }
      }
      if (localized) result.get(locale)!.push(localized);
    }
  }
  return result;
}

const listingFacets = (listing: CarListing) => {
  const brand = clean(listing.brand);
  const model = clean(listing.model);
  const brandSlug = normalizeVehicleFacetSlug(listing.brand_slug || brand);
  const modelSlug = normalizeVehicleFacetSlug(listing.model_slug || model);
  const city = clean(listing.city);
  const citySlug = normalizeVehicleFacetSlug(listing.city_slug || city);
  const region = getSeoRegionForLocation(listing);
  const fuel = normalizeBackendValue("fuel_type", listing.fuel_type);
  const body = normalizeBackendValue("body_type", listing.body_type);
  const facets: MaterializedFacet[] = [];
  if (brand) facets.push({ key: facetKey("brand", brandSlug), taxonomy_type: "brand", slug: brandSlug, label: brand });
  if (brand && model) facets.push({ key: facetKey("model", modelSlug, brandSlug), taxonomy_type: "model", slug: modelSlug, parent_slug: brandSlug, label: `${brand} ${model}` });
  if (city) facets.push({ key: facetKey("city", citySlug), taxonomy_type: "city", slug: citySlug, label: city, ...(region ? { region_slug: region.slug } : {}) });
  if (region) facets.push({ key: facetKey("region", region.slug), taxonomy_type: "region", slug: region.slug, label: region.name });
  if (fuel) facets.push({ key: facetKey("fuel", fuel), taxonomy_type: "fuel", slug: fuel, label: fuel, code: fuel });
  if (body) facets.push({ key: facetKey("body", body), taxonomy_type: "body", slug: body, label: body, code: body });
  for (const bucket of getSeoPriceBucketsForValue(listing.price)) {
    facets.push({
      key: facetKey("price", bucket.slug),
      taxonomy_type: "price",
      slug: bucket.slug,
      label: bucket.slug,
      code: bucket.slug,
      ...(bucket.min === undefined ? {} : { price_min: bucket.min }),
      ...(bucket.max === undefined ? {} : { price_max: bucket.max }),
      price_max_exclusive: true,
    });
  }
  return facets;
};

const promotionRank = (listing: CarListing, now: number) => {
  const active = (value: unknown) => new Date(String(value || 0)).getTime() > now;
  if (active(listing.homepage_until)) return 3;
  if (active(listing.featured_until)) return 2;
  if (active(listing.boosted_until)) return 1;
  return 0;
};

export function buildMaterializedRows(input: {
  generation: string;
  localized: Map<string, MaterializerListing[]>;
  now?: number;
}): MaterializedRows {
  const now = input.now ?? Date.now();
  const facetsByKey = new Map<string, MaterializedFacet>();
  const listingIndex: Record<string, unknown>[] = [];
  const edges: Record<string, unknown>[] = [];
  const acceptedListingIds = new Set<number>();
  const rejectedListingIds = new Set<number>();
  const failures: Record<string, number> = {};

  for (const [locale, listings] of input.localized) {
    for (const listing of listings) {
      const quality = evaluateListingSeoQuality(listing);
      if (!quality.eligible) {
        rejectedListingIds.add(Number(listing.id));
        for (const code of quality.failures) failures[code] = (failures[code] || 0) + 1;
        continue;
      }
      acceptedListingIds.add(Number(listing.id));
      const lastmod = timestamp(listing.translation_updated_at || listing.updated_at || listing.created_at);
      listingIndex.push({
        generation: input.generation,
        locale_code: locale,
        car_listing_id: Number(listing.id),
        slug: clean(listing.slug),
        listing_updated_at: lastmod,
        promotion_rank: promotionRank(listing, now),
        sort_published_at: timestamp(listing.created_at || listing.updated_at),
        is_active: false,
      });
      for (const facet of listingFacets(listing)) {
        if (!facetsByKey.has(facet.key)) facetsByKey.set(facet.key, facet);
        edges.push({
          generation: input.generation,
          facet_key: facet.key,
          car_listing_id: Number(listing.id),
          locale_code: locale,
          listing_updated_at: lastmod,
          is_active: false,
        });
      }
    }
  }

  const edgeGroups = new Map<string, typeof edges>();
  for (const edge of edges) {
    const key = `${edge.locale_code}:${edge.facet_key}`;
    const group = edgeGroups.get(key) || [];
    group.push(edge);
    edgeGroups.set(key, group);
  }
  const stats: Record<string, unknown>[] = [];
  for (const [key, group] of edgeGroups) {
    const separator = key.indexOf(":");
    const locale = key.slice(0, separator);
    const canonicalKey = key.slice(separator + 1);
    const facet = facetsByKey.get(canonicalKey)!;
    const threshold = SEO_TAXONOMY_MIN_LISTINGS[facet.taxonomy_type as keyof typeof SEO_TAXONOMY_MIN_LISTINGS] || 1;
    stats.push({
      generation: input.generation,
      facet_key: canonicalKey,
      locale_code: locale,
      ready_listing_count: group.length,
      last_listing_updated_at: group.map((edge) => String(edge.listing_updated_at)).sort().at(-1),
      is_indexable: group.length >= threshold,
      is_active: false,
    });
  }

  const indexable = new Set(stats.filter((stat) => stat.is_indexable).map((stat) => `${stat.locale_code}:${stat.facet_key}`));
  const listingFacetMap = new Map<string, Set<string>>();
  for (const edge of edges) {
    const key = `${edge.locale_code}:${edge.car_listing_id}`;
    const values = listingFacetMap.get(key) || new Set<string>();
    values.add(String(edge.facet_key));
    listingFacetMap.set(key, values);
  }
  const overlap = new Map<string, number>();
  for (const [listingKey, values] of listingFacetMap) {
    const locale = listingKey.split(":", 1)[0]!;
    for (const source of values) for (const target of values) {
      if (source === target || !indexable.has(`${locale}:${target}`)) continue;
      const key = `${locale}|${source}|${target}`;
      overlap.set(key, (overlap.get(key) || 0) + 1);
    }
  }
  const relatedCandidates = [...overlap].map(([key, overlap_count]) => {
    const [locale_code, source_facet_key, related_facet_key] = key.split("|");
    return { locale_code, source_facet_key, related_facet_key, overlap_count };
  });
  const relatedGroups = new Map<string, Map<string, (typeof relatedCandidates)[number]>>();
  for (const row of relatedCandidates) {
    const relatedType = facetsByKey.get(row.related_facet_key!)?.taxonomy_type || "";
    const key = `${row.locale_code}|${row.source_facet_key}`;
    const group = relatedGroups.get(key) || new Map<string, (typeof relatedCandidates)[number]>();
    const current = group.get(relatedType);
    if (!current
      || row.overlap_count > current.overlap_count
      || (row.overlap_count === current.overlap_count && row.related_facet_key!.localeCompare(current.related_facet_key!) < 0)) {
      group.set(relatedType, row);
    }
    relatedGroups.set(key, group);
  }
  const related: Record<string, unknown>[] = [];
  for (const group of relatedGroups.values()) {
    [...group.values()]
      .sort((left, right) => right.overlap_count - left.overlap_count || left.related_facet_key!.localeCompare(right.related_facet_key!))
      .slice(0, 3)
      .forEach((row, index) => related.push({
      generation: input.generation,
      ...row,
      rank: index + 1,
      is_active: false,
      }));
  }

  const manifests = [...input.localized.keys()].map((locale) => {
    const rows = listingIndex.filter((row) => row.locale_code === locale);
    return {
      generation: input.generation,
      locale_code: locale,
      listing_total: rows.length,
      shard_size: 10_000,
      shard_count: Math.ceil(rows.length / 10_000),
      last_listing_updated_at: rows.map((row) => String(row.listing_updated_at)).sort().at(-1) || null,
      is_active: false,
    };
  });

  return {
    listing_index: listingIndex,
    facets: [...facetsByKey.values()].sort((left, right) => left.key.localeCompare(right.key)),
    edges,
    stats,
    related,
    manifests,
    quality: { accepted: acceptedListingIds.size, rejected: rejectedListingIds.size, failures },
  };
}

export const MATERIALIZER_PRICE_BUCKETS = SEO_PRICE_BUCKETS;
