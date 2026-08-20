import { bodyTypeCodes, fuelTypeCodes, getVehicleTaxonomyLabel } from "../../domain/vehicleTaxonomy.ts";
import { normalizeBackendValue } from "../../i18n/backendValues.ts";
import { getPublicPageMessages } from "../../i18n/publicRoutes.ts";
import { isStrictSeoReleaseLocale } from "../../i18n/releaseStage3.ts";
import type { CarListing } from "../types.ts";
import {
  getCanonicalSeoCity,
  getSeoRegionBySlug,
  getSeoRegionForLocation,
  getSeoRegionLabel,
} from "./locationSeo.ts";
import {
  getVehicleTaxonomyLastmod,
  isValidVehicleFacetSlug,
  normalizeVehicleFacetSlug,
} from "./vehicleTaxonomy.ts";

export type SeoTaxonomyType = "brand" | "model" | "city" | "region" | "fuel" | "body" | "price";
export type NewSeoTaxonomyType = Extract<SeoTaxonomyType, "region" | "fuel" | "body" | "price">;

export const NEW_SEO_TAXONOMY_TYPES: readonly NewSeoTaxonomyType[] = Object.freeze([
  "region",
  "fuel",
  "body",
  "price",
]);

export const SEO_TAXONOMY_MIN_LISTINGS: Readonly<Record<SeoTaxonomyType, number>> = Object.freeze({
  brand: 1,
  model: 1,
  city: 3,
  region: 3,
  fuel: 3,
  body: 3,
  price: 3,
});

export type SeoPriceBucket = Readonly<{
  slug: string;
  min?: number;
  max?: number;
  kind: "under" | "range" | "plus";
}>;

// Only these editorially reviewed price ranges may become SEO landing pages.
// User-entered min/max filters remain catalogue filters and never enter sitemap.
export const SEO_PRICE_BUCKETS: readonly SeoPriceBucket[] = Object.freeze([
  { slug: "under-3000", max: 3_000, kind: "under" },
  { slug: "under-5000", max: 5_000, kind: "under" },
  { slug: "under-10000", max: 10_000, kind: "under" },
  { slug: "10000-20000", min: 10_000, max: 20_000, kind: "range" },
  { slug: "20000-30000", min: 20_000, max: 30_000, kind: "range" },
  { slug: "30000-plus", min: 30_000, kind: "plus" },
]);

export const TAXONOMY_PAGE_SIZE = 24;

export type SeoTaxonomyFacet = {
  type: SeoTaxonomyType;
  key: string;
  slug: string;
  label: string;
  cars: CarListing[];
  parentSlug?: string;
  regionSlug?: string;
  code?: string;
  priceBucket?: SeoPriceBucket;
  lastmod: string | null;
};

export type SeoTaxonomyGraph = {
  cars: CarListing[];
  facets: SeoTaxonomyFacet[];
  byType: Record<SeoTaxonomyType, SeoTaxonomyFacet[]>;
};

export type SeoTaxonomyLink = {
  type: SeoTaxonomyType;
  href: string;
  label: string;
  count?: number;
};

export type SeoRelatedTaxonomyGroup = {
  type: SeoTaxonomyType;
  label: string;
  links: SeoTaxonomyLink[];
};

export type SeoBreadcrumb = { href?: string; label: string };

const clean = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const carKey = (car: CarListing) => clean(car.slug) || String(car.id);
const stableSlug = (explicit: unknown, fallback: unknown) => {
  const supplied = clean(explicit).toLocaleLowerCase("en-US");
  return isValidVehicleFacetSlug(supplied) ? supplied : normalizeVehicleFacetSlug(fallback);
};

const priceMatchesBucket = (price: number, bucket: SeoPriceBucket) => {
  if (!Number.isFinite(price) || price <= 0) return false;
  if (bucket.kind === "under") return price < (bucket.max ?? 0);
  if (bucket.kind === "plus") return price >= (bucket.min ?? Number.POSITIVE_INFINITY);
  return price >= (bucket.min ?? 0) && price < (bucket.max ?? Number.POSITIVE_INFINITY);
};

export function getSeoPriceBucketsForValue(value: unknown) {
  const price = Number(value);
  return SEO_PRICE_BUCKETS.filter((bucket) => priceMatchesBucket(price, bucket));
}

export function getPrimarySeoPriceBucket(value: unknown) {
  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0) return null;
  if (price < 3_000) return SEO_PRICE_BUCKETS.find((bucket) => bucket.slug === "under-3000") || null;
  if (price < 5_000) return SEO_PRICE_BUCKETS.find((bucket) => bucket.slug === "under-5000") || null;
  if (price < 10_000) return SEO_PRICE_BUCKETS.find((bucket) => bucket.slug === "under-10000") || null;
  return SEO_PRICE_BUCKETS.find((bucket) => priceMatchesBucket(price, bucket)) || null;
}

export function getListingSeoIdentity(car: Partial<CarListing>) {
  const brandSlug = stableSlug(car.brand_slug, car.brand);
  const modelSlug = stableSlug(car.model_slug, car.model);
  const canonicalCity = getCanonicalSeoCity(car.city);
  const citySlug = stableSlug(car.city_slug, canonicalCity);
  const knownRegion = getSeoRegionForLocation(car);
  const explicitRegionSlug = clean(car.region_slug).toLocaleLowerCase("en-US");
  const regionSlug = knownRegion?.slug
    || (isValidVehicleFacetSlug(explicitRegionSlug) && clean(car.region) ? explicitRegionSlug : "");
  const regionLabel = knownRegion?.name || clean(car.region);
  const fuelCode = normalizeBackendValue("fuel_type", car.fuel_type);
  const bodyCode = normalizeBackendValue("body_type", car.body_type);
  return {
    brandSlug,
    modelSlug,
    citySlug,
    cityLabel: canonicalCity,
    regionSlug,
    regionLabel,
    fuelCode: (fuelTypeCodes as readonly string[]).includes(fuelCode) ? fuelCode : "",
    bodyCode: (bodyTypeCodes as readonly string[]).includes(bodyCode) ? bodyCode : "",
    priceBucket: getPrimarySeoPriceBucket(car.price),
  };
}

type MutableFacet = Omit<SeoTaxonomyFacet, "cars" | "lastmod"> & { cars: CarListing[] };

const addFacetCar = (
  groups: Map<string, MutableFacet>,
  facet: Omit<MutableFacet, "cars">,
  car: CarListing,
) => {
  const current = groups.get(facet.key);
  if (current) {
    if (!current.cars.some((candidate) => carKey(candidate) === carKey(car))) current.cars.push(car);
    return;
  }
  groups.set(facet.key, { ...facet, cars: [car] });
};

const facetSort = (left: SeoTaxonomyFacet, right: SeoTaxonomyFacet) => (
  right.cars.length - left.cars.length
  || left.label.localeCompare(right.label, "de", { sensitivity: "base" })
  || left.slug.localeCompare(right.slug)
);

export function buildSeoTaxonomyGraph(cars: CarListing[]): SeoTaxonomyGraph {
  const brandGroups = new Map<string, MutableFacet>();
  const modelGroups = new Map<string, MutableFacet>();
  const cityGroups = new Map<string, MutableFacet>();
  const regionGroups = new Map<string, MutableFacet>();
  const fuelGroups = new Map<string, MutableFacet>();
  const bodyGroups = new Map<string, MutableFacet>();
  const priceGroups = new Map<string, MutableFacet>();

  for (const car of cars) {
    const identity = getListingSeoIdentity(car);
    const brand = clean(car.brand);
    const model = clean(car.model);
    if (brand && identity.brandSlug) {
      addFacetCar(brandGroups, { type: "brand", key: identity.brandSlug, slug: identity.brandSlug, label: brand }, car);
    }
    if (brand && model && identity.brandSlug && identity.modelSlug) {
      const key = `${identity.brandSlug}/${identity.modelSlug}`;
      addFacetCar(modelGroups, { type: "model", key, slug: identity.modelSlug, parentSlug: identity.brandSlug, label: `${brand} ${model}` }, car);
    }
    if (identity.cityLabel && identity.citySlug) {
      addFacetCar(cityGroups, {
        type: "city",
        key: identity.citySlug,
        slug: identity.citySlug,
        label: identity.cityLabel,
        regionSlug: identity.regionSlug || undefined,
      }, car);
    }
    if (identity.regionSlug && identity.regionLabel) {
      addFacetCar(regionGroups, { type: "region", key: identity.regionSlug, slug: identity.regionSlug, label: identity.regionLabel }, car);
    }
    if (identity.fuelCode) {
      addFacetCar(fuelGroups, { type: "fuel", key: identity.fuelCode, slug: identity.fuelCode, label: identity.fuelCode, code: identity.fuelCode }, car);
    }
    if (identity.bodyCode) {
      addFacetCar(bodyGroups, { type: "body", key: identity.bodyCode, slug: identity.bodyCode, label: identity.bodyCode, code: identity.bodyCode }, car);
    }
    for (const bucket of getSeoPriceBucketsForValue(car.price)) {
      addFacetCar(priceGroups, { type: "price", key: bucket.slug, slug: bucket.slug, label: bucket.slug, code: bucket.slug, priceBucket: bucket }, car);
    }
  }

  const finalize = (groups: Map<string, MutableFacet>) => [...groups.values()]
    .map((facet): SeoTaxonomyFacet => ({ ...facet, lastmod: getVehicleTaxonomyLastmod(facet.cars) }))
    .sort(facetSort);
  const byType: Record<SeoTaxonomyType, SeoTaxonomyFacet[]> = {
    brand: finalize(brandGroups),
    model: finalize(modelGroups),
    city: finalize(cityGroups),
    region: finalize(regionGroups),
    fuel: finalize(fuelGroups),
    body: finalize(bodyGroups),
    price: finalize(priceGroups),
  };
  return { cars, byType, facets: Object.values(byType).flat() };
}

export function isNewSeoTaxonomyType(value: unknown): value is NewSeoTaxonomyType {
  return NEW_SEO_TAXONOMY_TYPES.includes(String(value ?? "") as NewSeoTaxonomyType);
}

export function normalizeTaxonomyRouteSlug(type: SeoTaxonomyType, value: unknown) {
  if (type === "fuel") return normalizeBackendValue("fuel_type", value);
  if (type === "body") return normalizeBackendValue("body_type", value);
  if (type === "city") return normalizeVehicleFacetSlug(getCanonicalSeoCity(value));
  if (type === "region") return getSeoRegionBySlug(value)?.slug || normalizeVehicleFacetSlug(value);
  if (type === "price") return clean(value).toLocaleLowerCase("en-US");
  return normalizeVehicleFacetSlug(value);
}

export function findSeoTaxonomyFacet(
  graph: SeoTaxonomyGraph,
  type: SeoTaxonomyType,
  slug: unknown,
  parentSlug?: unknown,
) {
  const normalizedSlug = normalizeTaxonomyRouteSlug(type, slug);
  const normalizedParent = type === "model" ? normalizeTaxonomyRouteSlug("brand", parentSlug) : "";
  return graph.byType[type].find((facet) => (
    facet.slug === normalizedSlug
    && (type !== "model" || facet.parentSlug === normalizedParent)
  )) || null;
}

export function getTaxonomyBasePath(facet: SeoTaxonomyFacet) {
  if (facet.type === "model") return `/cars/brand/${facet.parentSlug}/${facet.slug}/`;
  return `/cars/${facet.type}/${facet.slug}/`;
}

export function getTaxonomyCanonicalPath(locale: string, facet: SeoTaxonomyFacet, page = 1) {
  const path = `/${locale}${getTaxonomyBasePath(facet)}`;
  return page > 1 ? `${path}?page=${page}` : path;
}

export function getTaxonomyMinimum(type: SeoTaxonomyType) {
  return SEO_TAXONOMY_MIN_LISTINGS[type];
}

export function isSeoTaxonomyFacetIndexable(
  facet: SeoTaxonomyFacet,
  locale: string,
  options: { strictSeoRelease?: boolean; previewNoindex?: boolean } = {},
) {
  const strictSeoRelease = options.strictSeoRelease ?? isStrictSeoReleaseLocale(locale);
  return strictSeoRelease
    && !options.previewNoindex
    && facet.cars.length >= getTaxonomyMinimum(facet.type)
    && Boolean(getTaxonomyDisplayLabel(facet, locale));
}

const REGION_SECTION_LABELS: Readonly<Record<string, string>> = Object.freeze({
  de: "Regionen", en: "Regions", ru: "Регионы", uk: "Регіони", tr: "Bölgeler", ar: "المناطق",
  bg: "Региони", hr: "Regije", cs: "Regiony", da: "Regioner", nl: "Regio's", et: "Piirkonnad",
  fi: "Alueet", fr: "Régions", el: "Περιφέρειες", hu: "Régiók", ga: "Réigiúin", it: "Regioni",
  lv: "Reģioni", lt: "Regionai", mt: "Reġjuni", pl: "Regiony", pt: "Regiões", ro: "Regiuni",
  sk: "Regióny", sl: "Regije", es: "Regiones", sv: "Regioner",
});

const formatPrice = (value: number, locale: string) => new Intl.NumberFormat(locale, {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
}).format(value);

export function getSeoPriceBucketLabel(bucket: SeoPriceBucket, locale: string) {
  const min = bucket.min ? formatPrice(bucket.min, locale) : "";
  const max = bucket.max ? formatPrice(bucket.max, locale) : "";
  if (locale === "de") return bucket.kind === "under" ? `bis ${max}` : bucket.kind === "plus" ? `ab ${min}` : `${min} bis ${max}`;
  if (locale === "ru") return bucket.kind === "under" ? `до ${max}` : bucket.kind === "plus" ? `от ${min}` : `${min}–${max}`;
  if (locale === "uk") return bucket.kind === "under" ? `до ${max}` : bucket.kind === "plus" ? `від ${min}` : `${min}–${max}`;
  if (locale === "fr") return bucket.kind === "under" ? `jusqu’à ${max}` : bucket.kind === "plus" ? `à partir de ${min}` : `${min} à ${max}`;
  if (locale === "tr") return bucket.kind === "under" ? `${max} altı` : bucket.kind === "plus" ? `${min} üzeri` : `${min}–${max}`;
  if (locale === "ar") return bucket.kind === "under" ? `حتى ${max}` : bucket.kind === "plus" ? `ابتداءً من ${min}` : `${min}–${max}`;
  if (locale === "en") return bucket.kind === "under" ? `under ${max}` : bucket.kind === "plus" ? `${min}+` : `${min}–${max}`;
  return bucket.kind === "under" ? `≤ ${max}` : bucket.kind === "plus" ? `${min}+` : `${min}–${max}`;
}

export function getTaxonomyDisplayLabel(facet: SeoTaxonomyFacet, locale: string) {
  if (facet.type === "fuel") return getVehicleTaxonomyLabel("fuel_type", facet.code || facet.slug, locale);
  if (facet.type === "body") return getVehicleTaxonomyLabel("body_type", facet.code || facet.slug, locale);
  if (facet.type === "price" && facet.priceBucket) return getSeoPriceBucketLabel(facet.priceBucket, locale);
  if (facet.type === "region") {
    const region = getSeoRegionBySlug(facet.slug);
    return region ? getSeoRegionLabel(region, locale) : facet.label;
  }
  return facet.label;
}

export function getTaxonomyGroupLabel(type: SeoTaxonomyType, locale: string) {
  const messages = getPublicPageMessages(locale);
  if (type === "brand") return messages.brand;
  if (type === "model") return messages.model;
  if (type === "city") return messages.location;
  if (type === "region") return REGION_SECTION_LABELS[locale] || REGION_SECTION_LABELS.en;
  if (type === "fuel") return messages.fuel;
  if (type === "body") return messages.bodyType;
  return messages.price;
}

export function buildSeoTaxonomyMetadata(facet: SeoTaxonomyFacet, locale: string, page = 1) {
  const label = getTaxonomyDisplayLabel(facet, locale);
  const count = facet.cars.length;
  const messages = getPublicPageMessages(locale);
  let heading = `${label} · ${messages.catalogTitle}`;
  if (locale === "de") {
    if (facet.type === "brand") heading = `${label} Gebrauchtwagen kaufen`;
    else if (facet.type === "model") heading = `${label} gebraucht kaufen`;
    else if (["city", "region"].includes(facet.type)) heading = `Gebrauchtwagen in ${label}`;
    else if (facet.type === "fuel") heading = `${label} Gebrauchtwagen kaufen`;
    else if (facet.type === "body") heading = `${label} gebraucht kaufen`;
    else heading = `Gebrauchtwagen ${label}`;
  } else if (locale === "en") {
    if (["city", "region"].includes(facet.type)) heading = `Used cars in ${label}`;
    else if (facet.type === "price") heading = `Used cars ${label}`;
    else heading = `${label} used cars for sale`;
  } else if (locale === "ru") {
    if (["city", "region"].includes(facet.type)) heading = `Автомобили с пробегом в ${label}`;
    else if (facet.type === "price") heading = `Автомобили с пробегом ${label}`;
    else heading = `${label}: автомобили с пробегом`;
  } else if (locale === "uk") {
    if (["city", "region"].includes(facet.type)) heading = `Вживані автомобілі в ${label}`;
    else if (facet.type === "price") heading = `Вживані автомобілі ${label}`;
    else heading = `${label}: вживані автомобілі`;
  } else if (locale === "fr") {
    if (["city", "region"].includes(facet.type)) heading = `Voitures d’occasion à ${label}`;
    else if (facet.type === "price") heading = `Voitures d’occasion ${label}`;
    else heading = `${label} d’occasion à vendre`;
  } else if (locale === "tr") {
    if (["city", "region"].includes(facet.type)) heading = `${label} bölgesinde ikinci el araçlar`;
    else heading = `${label} ikinci el araçlar`;
  } else if (locale === "ar") {
    if (["city", "region"].includes(facet.type)) heading = `سيارات مستعملة في ${label}`;
    else heading = `سيارات ${label} مستعملة`;
  }
  const pageSuffix = page > 1 ? ` · ${page}` : "";
  const title = `${heading}${pageSuffix}`;
  const description = `${messages.results}: ${count} ${messages.vehicles}. ${messages.catalogDescription} ${label}.`.slice(0, 240);
  return { title, heading, description, label };
}

export function getFacetReadyLocales(facet: SeoTaxonomyFacet, currentLocale: string) {
  const counts = new Map<string, number>();
  for (const car of facet.cars) {
    const locales = new Set([currentLocale, ...(Array.isArray(car.available_locales) ? car.available_locales : [])]);
    for (const locale of locales) counts.set(locale, (counts.get(locale) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([locale, count]) => isStrictSeoReleaseLocale(locale) && count >= getTaxonomyMinimum(facet.type))
    .map(([locale]) => locale);
}

export function buildSeoTaxonomyBreadcrumbs(
  graph: SeoTaxonomyGraph,
  facet: SeoTaxonomyFacet,
  locale: string,
) {
  const messages = getPublicPageMessages(locale);
  const breadcrumbs: SeoBreadcrumb[] = [
    { href: `/${locale}/`, label: messages.homeTitle },
    { href: `/${locale}/cars/`, label: messages.catalogTitle },
  ];
  if (facet.type === "model" && facet.parentSlug) {
    const brand = graph.byType.brand.find((candidate) => candidate.slug === facet.parentSlug);
    breadcrumbs.push({ href: `/${locale}/cars/brand/${facet.parentSlug}/`, label: brand?.label || facet.parentSlug });
  }
  if (facet.type === "city" && facet.regionSlug) {
    const region = graph.byType.region.find((candidate) => candidate.slug === facet.regionSlug);
    if (region) breadcrumbs.push({ href: `/${locale}/cars/region/${region.slug}/`, label: getTaxonomyDisplayLabel(region, locale) });
  }
  breadcrumbs.push({ label: getTaxonomyDisplayLabel(facet, locale) });
  return breadcrumbs;
}

const RELATED_ORDER: Readonly<Record<SeoTaxonomyType, readonly SeoTaxonomyType[]>> = Object.freeze({
  brand: ["model", "city", "region", "fuel", "body", "price"],
  model: ["brand", "city", "region", "fuel", "body", "price"],
  city: ["region", "brand", "model", "fuel", "body", "price"],
  region: ["city", "brand", "model", "fuel", "body", "price"],
  fuel: ["brand", "model", "city", "region", "body", "price"],
  body: ["brand", "model", "city", "region", "fuel", "price"],
  price: ["brand", "model", "city", "region", "fuel", "body"],
});

const facetsOverlap = (left: SeoTaxonomyFacet, right: SeoTaxonomyFacet) => {
  const ids = new Set(left.cars.map(carKey));
  return right.cars.reduce((total, car) => total + (ids.has(carKey(car)) ? 1 : 0), 0);
};

export function buildRelatedSeoTaxonomyGroups(
  graph: SeoTaxonomyGraph,
  facet: SeoTaxonomyFacet | null,
  locale: string,
  limitPerGroup = 8,
) {
  const order = facet ? RELATED_ORDER[facet.type] : (["brand", "model", "city", "region", "fuel", "body", "price"] as const);
  return order.flatMap((type): SeoRelatedTaxonomyGroup[] => {
    const links = graph.byType[type]
      .filter((candidate) => (!facet || candidate.key !== facet.key || candidate.type !== facet.type))
      .filter((candidate) => isSeoTaxonomyFacetIndexable(candidate, locale))
      .map((candidate) => ({ candidate, overlap: facet ? facetsOverlap(facet, candidate) : candidate.cars.length }))
      .filter(({ overlap }) => overlap > 0)
      .sort((left, right) => right.overlap - left.overlap || facetSort(left.candidate, right.candidate))
      .slice(0, limitPerGroup)
      .map(({ candidate }): SeoTaxonomyLink => ({
        type: candidate.type,
        href: `/${locale}${getTaxonomyBasePath(candidate)}`,
        label: getTaxonomyDisplayLabel(candidate, locale),
        count: candidate.cars.length,
      }));
    return links.length ? [{ type, label: getTaxonomyGroupLabel(type, locale), links }] : [];
  });
}

export function buildListingSeoTaxonomyLinks(car: Partial<CarListing>, locale: string): SeoTaxonomyLink[] {
  const identity = getListingSeoIdentity(car);
  const links: SeoTaxonomyLink[] = [];
  if (clean(car.brand) && identity.brandSlug) links.push({ type: "brand", href: `/${locale}/cars/brand/${identity.brandSlug}/`, label: clean(car.brand) });
  if (clean(car.brand) && clean(car.model) && identity.brandSlug && identity.modelSlug) links.push({ type: "model", href: `/${locale}/cars/brand/${identity.brandSlug}/${identity.modelSlug}/`, label: `${clean(car.brand)} ${clean(car.model)}` });
  if (identity.cityLabel && identity.citySlug) links.push({ type: "city", href: `/${locale}/cars/city/${identity.citySlug}/`, label: identity.cityLabel });
  if (identity.regionSlug) {
    const region = getSeoRegionBySlug(identity.regionSlug);
    links.push({ type: "region", href: `/${locale}/cars/region/${identity.regionSlug}/`, label: region ? getSeoRegionLabel(region, locale) : identity.regionLabel });
  }
  if (identity.fuelCode) links.push({ type: "fuel", href: `/${locale}/cars/fuel/${identity.fuelCode}/`, label: getVehicleTaxonomyLabel("fuel_type", identity.fuelCode, locale) });
  if (identity.bodyCode) links.push({ type: "body", href: `/${locale}/cars/body/${identity.bodyCode}/`, label: getVehicleTaxonomyLabel("body_type", identity.bodyCode, locale) });
  if (identity.priceBucket) links.push({ type: "price", href: `/${locale}/cars/price/${identity.priceBucket.slug}/`, label: getSeoPriceBucketLabel(identity.priceBucket, locale) });
  return links.filter((link) => Boolean(link.label));
}

export function hasSeoFilterQuery(searchParams: URLSearchParams) {
  for (const key of searchParams.keys()) {
    if (key === "page" || key.startsWith("utm_") || ["gclid", "fbclid"].includes(key)) continue;
    return true;
  }
  return false;
}

export function getIndexableSeoTaxonomyFacets(graph: SeoTaxonomyGraph, locale: string) {
  return graph.facets.filter((facet) => isSeoTaxonomyFacetIndexable(facet, locale));
}
