import type { CarListing } from "../types.ts";

const DEFAULT_SITE_URL = "https://automarket.sitecraft.agency";
const FACET_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const CYRILLIC_TRANSLITERATION: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

const text = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizedKey = (value: unknown) => text(value).normalize("NFKC").toLocaleLowerCase("ru-RU");
const stableHash = (value: string) => {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export function normalizeVehicleFacetSlug(value: unknown) {
  const source = normalizedKey(value)
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .split("")
    .map((character) => CYRILLIC_TRANSLITERATION[character] ?? character)
    .join("")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  const slug = source
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80)
    .replace(/-+$/g, "");

  return slug || `facet-${stableHash(normalizedKey(value))}`;
}

export function isValidVehicleFacetSlug(value: unknown) {
  const slug = text(value);
  return slug.length > 0 && slug.length <= 90 && FACET_SLUG_PATTERN.test(slug);
}

const toIsoDate = (value?: string | number) => {
  if (!value) return null;
  const date = typeof value === "number" || /^\d+$/.test(String(value))
    ? new Date(Number(value))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const getVehicleTaxonomyLastmod = (cars: CarListing[]) => cars
  .map((car) => toIsoDate(car.updated_at ?? car.created_at))
  .filter((value): value is string => Boolean(value))
  .sort()
  .at(-1) ?? null;

export type VehicleModelFacet = {
  name: string;
  slug: string;
  cars: CarListing[];
  lastmod: string | null;
};

export type VehicleBrandFacet = {
  name: string;
  slug: string;
  cars: CarListing[];
  models: VehicleModelFacet[];
  lastmod: string | null;
};

const assignUniqueSlugs = <T extends { name: string }>(items: T[]) => {
  const used = new Map<string, number>();
  return items.map((item) => {
    const base = normalizeVehicleFacetSlug(item.name);
    const occurrence = (used.get(base) ?? 0) + 1;
    used.set(base, occurrence);
    return { ...item, slug: occurrence === 1 ? base : `${base}-${occurrence}` };
  });
};

export function buildVehicleTaxonomy(cars: CarListing[]): VehicleBrandFacet[] {
  const brandGroups = new Map<string, { name: string; cars: CarListing[] }>();

  for (const car of cars) {
    const name = text(car.brand);
    if (!name) continue;
    const key = normalizedKey(name);
    const group = brandGroups.get(key) ?? { name, cars: [] };
    group.cars.push(car);
    brandGroups.set(key, group);
  }

  const brands = [...brandGroups.values()]
    .sort((left, right) => left.name.localeCompare(right.name, "ru", { sensitivity: "base" }));

  return assignUniqueSlugs(brands).map((brand) => {
    const modelGroups = new Map<string, { name: string; cars: CarListing[] }>();
    for (const car of brand.cars) {
      const name = text(car.model);
      if (!name) continue;
      const key = normalizedKey(name);
      const group = modelGroups.get(key) ?? { name, cars: [] };
      group.cars.push(car);
      modelGroups.set(key, group);
    }
    const models = assignUniqueSlugs(
      [...modelGroups.values()].sort((left, right) => left.name.localeCompare(right.name, "ru", { sensitivity: "base" })),
    ).map((model) => ({ ...model, lastmod: getVehicleTaxonomyLastmod(model.cars) }));

    return {
      ...brand,
      models,
      lastmod: getVehicleTaxonomyLastmod(brand.cars),
    };
  });
}

export const findVehicleBrandFacet = (taxonomy: VehicleBrandFacet[], slug: string) =>
  taxonomy.find((brand) => brand.slug === slug) ?? null;

export const findVehicleModelFacet = (brand: VehicleBrandFacet, slug: string) =>
  brand.models.find((model) => model.slug === slug) ?? null;

const formatPrice = (value: number, currency = "EUR") => new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency,
  maximumFractionDigits: 0,
}).format(value);

const summarizeCars = (cars: CarListing[]) => {
  const prices = cars.map((car) => Number(car.price)).filter((value) => Number.isFinite(value) && value > 0);
  const years = cars.map((car) => Number(car.year)).filter((value) => Number.isFinite(value) && value > 0);
  const cities = [...new Set(cars.map((car) => text(car.city)).filter(Boolean))];
  return {
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    minYear: years.length ? Math.min(...years) : null,
    maxYear: years.length ? Math.max(...years) : null,
    cities,
  };
};

export function buildVehicleTaxonomySeo(input: {
  brand: VehicleBrandFacet;
  model?: VehicleModelFacet;
  siteUrl?: string;
}) {
  const origin = new URL(input.siteUrl || DEFAULT_SITE_URL);
  const cars = input.model?.cars ?? input.brand.cars;
  const name = [input.brand.name, input.model?.name].filter(Boolean).join(" ");
  const path = input.model
    ? `/cars/brand/${input.brand.slug}/${input.model.slug}`
    : `/cars/brand/${input.brand.slug}`;
  const canonicalUrl = new URL(path, origin).toString();
  const summary = summarizeCars(cars);
  const title = `${name} с пробегом: купить автомобиль`;
  const heading = input.model
    ? `${input.brand.name} ${input.model.name} с пробегом`
    : `Автомобили ${input.brand.name} с пробегом`;
  const facts = [
    `${cars.length} актуальных объявлений ${name}`,
    summary.minPrice ? `цены от ${formatPrice(summary.minPrice, cars[0]?.currency || "EUR")}` : "",
    summary.minYear && summary.maxYear ? `годы выпуска ${summary.minYear}–${summary.maxYear}` : "",
    summary.cities.length ? `предложения в ${summary.cities.slice(0, 3).join(", ")}` : "",
  ].filter(Boolean);
  const description = `${facts.join(". ")}. Фото, характеристики и контакты продавцов на SiteCraft Auto Market.`.slice(0, 220);
  const breadcrumbs = [
    { name: "Главная", path: "/" },
    { name: "Автомобили", path: "/cars" },
    { name: input.brand.name, path: `/cars/brand/${input.brand.slug}` },
    ...(input.model ? [{ name: input.model.name, path }] : []),
  ];
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: new URL(item.path, origin).toString(),
    })),
  };
  const collection = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": canonicalUrl,
    url: canonicalUrl,
    name: heading,
    description,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: cars.length,
      itemListElement: cars.slice(0, 50).map((car, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: car.title,
        url: new URL(`/cars/${car.slug}`, origin).toString(),
      })),
    },
  };

  return { title, heading, description, path, canonicalUrl, summary, breadcrumb, collection };
}
