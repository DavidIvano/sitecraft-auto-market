import type { AiSearchFilters, AiSearchIntentResponse } from "./types.ts";
import { carBrands, carModelsByBrand } from "../../data/carOptions.ts";
import { normalizeBuyerSearchCriteria } from "../buyer-search/model.ts";

const BODY_PATTERNS: Array<[RegExp, NonNullable<AiSearchFilters["body_type"]>]> = [
  [/(седан|sedan)/i, "Седан"],
  [/(универсал|touring|variant|kombi)/i, "Универсал"],
  [/(х[эе]тчбек|хеджбек|hatchback)/i, "Хэтчбек"],
  [/(купе|coupe|coupé)/i, "Купе"],
  [/(кабриолет|cabrio|convertible)/i, "Кабриолет"],
  [/(внедорожник|suv|джип|jeep)/i, "Внедорожник / SUV"],
  [/(кроссовер|crossover)/i, "Кроссовер"],
  [/(минив[эе]н|minivan)/i, "Минивэн"],
  [/(фургон|van|transporter)/i, "Фургон"],
  [/(пикап|pickup)/i, "Пикап"],
  [/(лимузин|limousine)/i, "Лимузин"],
];

const FUEL_PATTERNS: Array<[RegExp, NonNullable<AiSearchFilters["fuel_type"]>]> = [
  [/(дизель|diesel)/i, "Дизель"],
  [/(бензин|benzin|petrol|gasoline)/i, "Бензин"],
  [/(электро|электромобиль|electric|ev)/i, "Электро"],
  [/(гибрид|hybrid)/i, "Гибрид"],
  [/(lpg|газ)/i, "Газ / LPG"],
];

const TRANSMISSION_PATTERNS: Array<[RegExp, NonNullable<AiSearchFilters["transmission"]>]> = [
  [/(автомат|automatic|automatik)/i, "Автомат"],
  [/(механика|ручная|manual|schaltgetriebe)/i, "Механика"],
  [/(робот|robot)/i, "Робот"],
  [/(вариатор|cvt)/i, "Вариатор"],
];

function cleanNumber(value: string) {
  return Number(value.replace(/\s+/g, "").replace(",", "."));
}

function findPatternValue<T extends string>(query: string, patterns: Array<[RegExp, T]>) {
  return patterns.find(([pattern]) => pattern.test(query))?.[1] || null;
}

function findPriceMax(query: string) {
  const match = query.match(/(?:до|максимум|max|under|bis)\s*(\d[\d\s]{2,})(?:\s*(?:€|eur|евро))?/i);
  const suffix = match?.index !== undefined ? query.slice(match.index + match[0].length, match.index + match[0].length + 12) : "";
  if (/год|г\.|baujahr|bj|км|km/i.test(suffix)) {
    return null;
  }
  const value = match ? cleanNumber(match[1]) : 0;
  return Number.isFinite(value) && value > 0 ? value : null;
}

function findPriceMin(query: string) {
  const match = query.match(/(?:от|минимум|min|from|ab)\s*(\d[\d\s]{2,})(?:\s*(?:€|eur|евро))?/i);
  const suffix = match?.index !== undefined ? query.slice(match.index + match[0].length, match.index + match[0].length + 12) : "";
  if (/год|г\.|baujahr|bj|км|km/i.test(suffix)) {
    return null;
  }
  const value = match ? cleanNumber(match[1]) : 0;
  return Number.isFinite(value) && value > 0 ? value : null;
}

function findYearMin(query: string) {
  const match = query.match(/(?:от|после|с|from|ab)\s*(19\d{2}|20\d{2})(?:\s*(?:года|год|г\.|bj|baujahr))?/i);
  const value = match ? Number(match[1]) : 0;
  return value >= 1950 && value <= new Date().getFullYear() + 1 ? value : null;
}

function findYearMax(query: string) {
  const match = query.match(/(?:до|не позднее|before|bis)\s*(19\d{2}|20\d{2})(?:\s*(?:года|год|г\.|bj|baujahr))?/i);
  const value = match ? Number(match[1]) : 0;
  return value >= 1950 && value <= new Date().getFullYear() + 1 ? value : null;
}

function findMileageMax(query: string) {
  const match = query.match(/(?:пробег\s*)?(?:до|максимум|max|under|bis)\s*(\d[\d\s]{3,})(?:\s*(?:км|km))/i);
  const value = match ? cleanNumber(match[1]) : 0;
  return Number.isFinite(value) && value > 0 ? value : null;
}

function findCity(query: string) {
  const match = query.match(/(?:рядом с|около|возле|в|near|around|in)\s+([A-ZА-ЯЁÄÖÜ][A-Za-zА-Яа-яЁёÄÖÜäöüß.-]{1,}(?:[\s-][A-ZА-ЯЁÄÖÜ][A-Za-zА-Яа-яЁёÄÖÜäöüß.-]{1,}){0,2})/u);
  return match?.[1]?.trim().replace(/[,.!?]+$/, "") || null;
}

function findBrand(query: string) {
  const normalizedQuery = query.toLocaleLowerCase("ru-RU");
  return [...carBrands]
    .sort((left, right) => right.length - left.length)
    .find((brand) => normalizedQuery.includes(brand.toLocaleLowerCase("ru-RU"))) || null;
}

function escapePattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findModel(query: string, brand: string | null) {
  if (!brand) return null;
  const models = [...(carModelsByBrand[brand] || [])].sort((left, right) => right.length - left.length);
  return models.find((model) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapePattern(model)}(?=$|[^\\p{L}\\p{N}])`, "iu").test(query)) || null;
}

function countActiveFilters(filters: AiSearchFilters) {
  return Object.values(filters).filter((value) => value !== null && value !== undefined && value !== "").length;
}

function buildExplanation(filters: AiSearchFilters) {
  const parts = [
    filters.brand,
    filters.body_type,
    filters.fuel_type,
    filters.price_max ? `до ${filters.price_max.toLocaleString("ru-RU")} EUR` : "",
    filters.city ? `рядом с ${filters.city}` : "",
  ].filter(Boolean);

  return parts.length
    ? `Применил фильтры: ${parts.join(", ")}.`
    : "Я не нашёл точных фильтров в запросе, попробуйте указать кузов, топливо, бюджет или город.";
}

function buildSuggestions(filters: AiSearchFilters) {
  const suggestions = [];

  if (filters.body_type === "Универсал") {
    suggestions.push("Показать также минивэны");
  }
  if (filters.price_max) {
    suggestions.push(`Расширить бюджет до ${(filters.price_max + 1000).toLocaleString("ru-RU")} €`);
  }
  if (filters.city && filters.city.toLocaleLowerCase("ru-RU") !== "hannover") {
    suggestions.push("Искать рядом с Hannover");
  }
  if (!filters.fuel_type) {
    suggestions.push("Искать дизель");
  }

  return suggestions.slice(0, 4);
}

export function parseCarSearchIntent(query: string): AiSearchIntentResponse {
  const cleanQuery = query.trim();
  const brand = findBrand(cleanQuery);
  const filters: AiSearchFilters = normalizeBuyerSearchCriteria({
    brand,
    model: findModel(cleanQuery, brand),
    body_type: findPatternValue(cleanQuery, BODY_PATTERNS),
    fuel_type: findPatternValue(cleanQuery, FUEL_PATTERNS),
    transmission: findPatternValue(cleanQuery, TRANSMISSION_PATTERNS),
    price_min: findPriceMin(cleanQuery),
    price_max: findPriceMax(cleanQuery),
    year_min: findYearMin(cleanQuery),
    year_max: findYearMax(cleanQuery),
    mileage_max: findMileageMax(cleanQuery),
    city: findCity(cleanQuery),
  });
  const activeCount = countActiveFilters(filters);

  return {
    filters,
    explanation: buildExplanation(filters),
    confidence: Math.min(0.92, Math.max(0.35, activeCount / 8 + 0.35)),
    suggestions: buildSuggestions(filters),
  };
}
