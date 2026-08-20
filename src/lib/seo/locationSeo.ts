import { normalizeVehicleFacetSlug } from "./vehicleTaxonomy.ts";

const CITY_ALIASES = new Map<string, string>([
  ["ильзеде", "Ilsede"],
  ["ильседе", "Ilsede"],
  ["брауншвейг", "Braunschweig"],
  ["пайне", "Peine"],
]);

const titleCaseLocation = (value: string) => value.replace(/(^|[\s-])([\p{L}])/gu, (_match, separator, letter) => (
  `${separator}${letter.toLocaleUpperCase("de-DE")}`
));

export function getCanonicalSeoCity(value: unknown) {
  const clean = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const alias = CITY_ALIASES.get(clean.toLocaleLowerCase("ru-RU"));
  if (alias) return alias;
  if (clean === clean.toLocaleLowerCase("de-DE") || clean === clean.toLocaleUpperCase("de-DE")) {
    return titleCaseLocation(clean.toLocaleLowerCase("de-DE"));
  }
  return clean;
}

export type SeoRegionDefinition = Readonly<{
  slug: string;
  name: string;
  labels: Readonly<Record<string, string>>;
  aliases?: readonly string[];
  cities?: readonly string[];
}>;

// The region registry is deliberately code-based and additive. Xano may later
// return region_slug directly; until then only explicitly mapped cities are
// assigned to a region. Unknown cities never receive a guessed region.
export const SEO_REGION_DEFINITIONS: readonly SeoRegionDefinition[] = Object.freeze([
  { slug: "baden-wuerttemberg", name: "Baden-Württemberg", labels: { de: "Baden-Württemberg", en: "Baden-Württemberg", ru: "Баден-Вюртемберг", uk: "Баден-Вюртемберг" }, cities: ["stuttgart", "mannheim", "karlsruhe", "freiburg-im-breisgau"] },
  { slug: "bayern", name: "Bayern", labels: { de: "Bayern", en: "Bavaria", ru: "Бавария", uk: "Баварія" }, aliases: ["bavaria", "бавария", "баварія"], cities: ["muenchen", "nuernberg", "augsburg", "regensburg"] },
  { slug: "berlin", name: "Berlin", labels: { de: "Berlin", en: "Berlin", ru: "Берлин", uk: "Берлін" }, cities: ["berlin"] },
  { slug: "brandenburg", name: "Brandenburg", labels: { de: "Brandenburg", en: "Brandenburg", ru: "Бранденбург", uk: "Бранденбург" }, cities: ["potsdam", "cottbus"] },
  { slug: "bremen", name: "Bremen", labels: { de: "Bremen", en: "Bremen", ru: "Бремен", uk: "Бремен" }, cities: ["bremen", "bremerhaven"] },
  { slug: "hamburg", name: "Hamburg", labels: { de: "Hamburg", en: "Hamburg", ru: "Гамбург", uk: "Гамбург" }, cities: ["hamburg"] },
  { slug: "hessen", name: "Hessen", labels: { de: "Hessen", en: "Hesse", ru: "Гессен", uk: "Гессен" }, aliases: ["hesse", "гессен"], cities: ["frankfurt-am-main", "wiesbaden", "kassel", "darmstadt"] },
  { slug: "mecklenburg-vorpommern", name: "Mecklenburg-Vorpommern", labels: { de: "Mecklenburg-Vorpommern", en: "Mecklenburg-Western Pomerania", ru: "Мекленбург-Передняя Померания", uk: "Мекленбург-Передня Померанія" }, cities: ["schwerin", "rostock"] },
  { slug: "niedersachsen", name: "Niedersachsen", labels: { de: "Niedersachsen", en: "Lower Saxony", ru: "Нижняя Саксония", uk: "Нижня Саксонія", fr: "Basse-Saxe", tr: "Aşağı Saksonya", ar: "ساكسونيا السفلى" }, aliases: ["lower-saxony", "нижняя-саксония", "нижня-саксонія"], cities: ["ilsede", "peine", "braunschweig", "hannover", "wolfsburg", "goettingen", "oldenburg", "osnabrueck", "salzgitter", "hildesheim"] },
  { slug: "nordrhein-westfalen", name: "Nordrhein-Westfalen", labels: { de: "Nordrhein-Westfalen", en: "North Rhine-Westphalia", ru: "Северный Рейн-Вестфалия", uk: "Північний Рейн-Вестфалія" }, aliases: ["north-rhine-westphalia"], cities: ["koeln", "duesseldorf", "dortmund", "essen", "duisburg", "bochum", "bonn", "muenster"] },
  { slug: "rheinland-pfalz", name: "Rheinland-Pfalz", labels: { de: "Rheinland-Pfalz", en: "Rhineland-Palatinate", ru: "Рейнланд-Пфальц", uk: "Рейнланд-Пфальц" }, cities: ["mainz", "koblenz", "trier"] },
  { slug: "saarland", name: "Saarland", labels: { de: "Saarland", en: "Saarland", ru: "Саар", uk: "Саар" }, cities: ["saarbruecken"] },
  { slug: "sachsen", name: "Sachsen", labels: { de: "Sachsen", en: "Saxony", ru: "Саксония", uk: "Саксонія" }, aliases: ["saxony", "саксония", "саксонія"], cities: ["dresden", "leipzig", "chemnitz"] },
  { slug: "sachsen-anhalt", name: "Sachsen-Anhalt", labels: { de: "Sachsen-Anhalt", en: "Saxony-Anhalt", ru: "Саксония-Анхальт", uk: "Саксонія-Ангальт" }, cities: ["magdeburg", "halle-saale"] },
  { slug: "schleswig-holstein", name: "Schleswig-Holstein", labels: { de: "Schleswig-Holstein", en: "Schleswig-Holstein", ru: "Шлезвиг-Гольштейн", uk: "Шлезвіг-Гольштейн" }, cities: ["kiel", "luebeck", "flensburg"] },
  { slug: "thueringen", name: "Thüringen", labels: { de: "Thüringen", en: "Thuringia", ru: "Тюрингия", uk: "Тюрингія" }, aliases: ["thuringia", "тюрингия", "тюрингія"], cities: ["erfurt", "jena", "gera"] },
] as SeoRegionDefinition[]);

const regionBySlug = new Map(SEO_REGION_DEFINITIONS.map((region) => [region.slug, region]));
const regionByAlias = new Map<string, SeoRegionDefinition>();
const regionByCity = new Map<string, SeoRegionDefinition>();

for (const region of SEO_REGION_DEFINITIONS) {
  const aliases = [region.slug, region.name, ...Object.values(region.labels), ...(region.aliases || [])];
  for (const alias of aliases) regionByAlias.set(normalizeVehicleFacetSlug(alias), region);
  for (const city of region.cities || []) regionByCity.set(normalizeVehicleFacetSlug(city), region);
}

export function getSeoRegionBySlug(value: unknown) {
  const slug = normalizeVehicleFacetSlug(value);
  return regionBySlug.get(slug) || regionByAlias.get(slug) || null;
}

export function getSeoRegionForLocation(input: {
  region?: unknown;
  region_slug?: unknown;
  city?: unknown;
  city_slug?: unknown;
}) {
  const explicit = getSeoRegionBySlug(input.region_slug) || getSeoRegionBySlug(input.region);
  if (explicit) return explicit;
  const citySlug = normalizeVehicleFacetSlug(input.city_slug || getCanonicalSeoCity(input.city));
  return regionByCity.get(citySlug) || null;
}

export function getSeoRegionLabel(region: SeoRegionDefinition, locale: string) {
  return region.labels[locale] || region.labels.en || region.name;
}
