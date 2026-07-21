import { bodyTypes, carBrands, fuelTypes, transmissions, vehicleTypes } from "../../data/carOptions.ts";

export const BUYER_SEARCH_FILTER_KEYS = [
  "vehicle_type",
  "body_type",
  "brand",
  "model",
  "fuel_type",
  "transmission",
  "price_min",
  "price_max",
  "year_min",
  "year_max",
  "mileage_max",
  "city",
] as const;

export type BuyerSearchFilterKey = typeof BUYER_SEARCH_FILTER_KEYS[number];

export type BuyerSearchCriteria = Partial<{
  vehicle_type: string;
  body_type: string;
  brand: string;
  model: string;
  fuel_type: string;
  transmission: string;
  price_min: number;
  price_max: number;
  year_min: number;
  year_max: number;
  mileage_max: number;
  city: string;
}>;

export type BuyerSearchCriterion = {
  key: BuyerSearchFilterKey;
  label: string;
  value: string;
};

export type BuyerSearchClarification = {
  id: string;
  question: string;
  options: Array<{
    label: string;
    changes: BuyerSearchCriteria;
  }>;
};

export type BuyerSearchRelaxation = {
  id: string;
  label: string;
  description: string;
  remove?: BuyerSearchFilterKey;
  changes?: BuyerSearchCriteria;
};

const ENUM_VALUES: Partial<Record<BuyerSearchFilterKey, ReadonlySet<string>>> = {
  vehicle_type: new Set(vehicleTypes),
  body_type: new Set(bodyTypes),
  brand: new Set(carBrands),
  fuel_type: new Set(fuelTypes),
  transmission: new Set(transmissions),
};

const NUMBER_RANGES: Partial<Record<BuyerSearchFilterKey, [number, number]>> = {
  price_min: [0, 10_000_000],
  price_max: [0, 10_000_000],
  year_min: [1950, new Date().getFullYear() + 1],
  year_max: [1950, new Date().getFullYear() + 1],
  mileage_max: [0, 5_000_000],
};

const FILTER_LABELS: Record<BuyerSearchFilterKey, string> = {
  vehicle_type: "Транспорт",
  body_type: "Кузов",
  brand: "Марка",
  model: "Модель",
  fuel_type: "Топливо",
  transmission: "Коробка",
  price_min: "Цена от",
  price_max: "Цена до",
  year_min: "Год от",
  year_max: "Год до",
  mileage_max: "Пробег до",
  city: "Город",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

function normalizeNumber(value: unknown, range: [number, number]) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const integer = Math.round(parsed);
  return integer >= range[0] && integer <= range[1] ? integer : null;
}

export function normalizeBuyerSearchCriteria(value: unknown): BuyerSearchCriteria {
  const record = asRecord(value);
  const criteria: BuyerSearchCriteria = {};

  BUYER_SEARCH_FILTER_KEYS.forEach((key) => {
    const range = NUMBER_RANGES[key];
    if (range) {
      const normalized = normalizeNumber(record[key], range);
      if (normalized !== null) criteria[key] = normalized as never;
      return;
    }

    const normalized = normalizeString(record[key]);
    if (!normalized) return;

    const allowedValues = ENUM_VALUES[key];
    if (allowedValues && !allowedValues.has(normalized)) return;
    criteria[key] = normalized as never;
  });

  return criteria;
}

export function getBuyerSearchCriteriaFromParams(params: URLSearchParams): BuyerSearchCriteria {
  const raw = Object.fromEntries(BUYER_SEARCH_FILTER_KEYS.map((key) => [key, params.get(key)]));
  if (!raw.price_max && params.get("price")) raw.price_max = params.get("price");
  return normalizeBuyerSearchCriteria(raw);
}

export function applyBuyerSearchCriteriaToParams(
  params: URLSearchParams,
  criteria: BuyerSearchCriteria,
  options: { replace?: boolean } = {},
) {
  const normalized = normalizeBuyerSearchCriteria(criteria);
  if (options.replace) BUYER_SEARCH_FILTER_KEYS.forEach((key) => params.delete(key));
  params.delete("price");

  Object.entries(normalized).forEach(([key, value]) => {
    params.set(key, String(value));
  });

  return params;
}

function formatNumber(value: number) {
  return value.toLocaleString("ru-RU");
}

function formatCriterionValue(key: BuyerSearchFilterKey, value: string | number) {
  if (key === "price_min" || key === "price_max") return `${formatNumber(Number(value))} EUR`;
  if (key === "mileage_max") return `${formatNumber(Number(value))} км`;
  return String(value);
}

export function getBuyerSearchCriteriaList(criteria: BuyerSearchCriteria): BuyerSearchCriterion[] {
  const normalized = normalizeBuyerSearchCriteria(criteria);
  return BUYER_SEARCH_FILTER_KEYS.flatMap((key) => {
    const value = normalized[key];
    return value === undefined
      ? []
      : [{ key, label: FILTER_LABELS[key], value: formatCriterionValue(key, value) }];
  });
}

export function getBuyerSearchClarifications(
  query: string,
  criteria: unknown,
): BuyerSearchClarification[] {
  const normalized = normalizeBuyerSearchCriteria(criteria);
  const clarifications: BuyerSearchClarification[] = [];

  if (!query.trim()) return [];

  if (normalized.price_min === undefined && normalized.price_max === undefined) {
    clarifications.push({
      id: "budget",
      question: "Какой максимальный бюджет?",
      options: [
        { label: "До 5 000 EUR", changes: { price_max: 5_000 } },
        { label: "До 10 000 EUR", changes: { price_max: 10_000 } },
        { label: "До 20 000 EUR", changes: { price_max: 20_000 } },
      ],
    });
  }

  if (!normalized.body_type && !normalized.model) {
    clarifications.push({
      id: "body",
      question: "Какой тип кузова удобнее?",
      options: [
        { label: "Кроссовер", changes: { body_type: "Кроссовер" } },
        { label: "Универсал", changes: { body_type: "Универсал" } },
        { label: "Хэтчбек", changes: { body_type: "Хэтчбек" } },
      ],
    });
  }

  return clarifications.slice(0, 2);
}

function valuesEqual(left: unknown, right: unknown) {
  return String(left || "").trim().toLocaleLowerCase("ru-RU") === String(right || "").trim().toLocaleLowerCase("ru-RU");
}

export function getBuyerSearchMatchReasons(listing: unknown, criteria: BuyerSearchCriteria): string[] {
  const car = asRecord(listing);
  const normalized = normalizeBuyerSearchCriteria(criteria);
  const reasons = [
    normalized.brand && valuesEqual(car.brand, normalized.brand) ? `Марка ${normalized.brand}` : "",
    normalized.model && String(car.model || "").toLocaleLowerCase("ru-RU").includes(normalized.model.toLocaleLowerCase("ru-RU"))
      ? `Модель ${normalized.model}`
      : "",
    normalized.price_max !== undefined && Number(car.price) <= normalized.price_max
      ? `Цена в бюджете до ${formatNumber(normalized.price_max)} EUR`
      : "",
    normalized.body_type && valuesEqual(car.body_type, normalized.body_type) ? `Кузов: ${normalized.body_type}` : "",
    normalized.fuel_type && valuesEqual(car.fuel_type, normalized.fuel_type) ? `Топливо: ${normalized.fuel_type}` : "",
    normalized.transmission && valuesEqual(car.transmission, normalized.transmission) ? `Коробка: ${normalized.transmission}` : "",
    normalized.year_min !== undefined && Number(car.year) >= normalized.year_min ? `Год от ${normalized.year_min}` : "",
    normalized.mileage_max !== undefined && Number(car.mileage) <= normalized.mileage_max
      ? `Пробег до ${formatNumber(normalized.mileage_max)} км`
      : "",
    normalized.city && String(car.city || "").toLocaleLowerCase("ru-RU").includes(normalized.city.toLocaleLowerCase("ru-RU"))
      ? `Город: ${normalized.city}`
      : "",
  ].filter(Boolean);

  return reasons.slice(0, 3);
}

function roundBudget(value: number) {
  return Math.ceil(value / 500) * 500;
}

export function getBuyerSearchRelaxations(criteria: BuyerSearchCriteria): BuyerSearchRelaxation[] {
  const normalized = normalizeBuyerSearchCriteria(criteria);
  const options: BuyerSearchRelaxation[] = [];

  if (normalized.city) {
    options.push({
      id: "remove-city",
      label: "Искать во всех городах",
      description: `Убрать ограничение «${normalized.city}»`,
      remove: "city",
    });
  }

  if (normalized.price_max !== undefined) {
    const nextBudget = roundBudget(normalized.price_max * 1.15);
    options.push({
      id: "increase-budget",
      label: `Бюджет до ${formatNumber(nextBudget)} EUR`,
      description: "Увеличить верхнюю цену на 15%",
      changes: { price_max: nextBudget },
    });
  }

  if (normalized.model) {
    options.push({
      id: "remove-model",
      label: `Все модели ${normalized.brand || "марки"}`,
      description: `Убрать модель «${normalized.model}»`,
      remove: "model",
    });
  }

  if (normalized.mileage_max !== undefined) {
    const nextMileage = Math.ceil((normalized.mileage_max * 1.25) / 10_000) * 10_000;
    options.push({
      id: "increase-mileage",
      label: `Пробег до ${formatNumber(nextMileage)} км`,
      description: "Расширить допустимый пробег",
      changes: { mileage_max: nextMileage },
    });
  }

  if (normalized.year_min !== undefined) {
    options.push({
      id: "lower-year",
      label: `Год от ${Math.max(1950, normalized.year_min - 3)}`,
      description: "Добавить автомобили на три года старше",
      changes: { year_min: Math.max(1950, normalized.year_min - 3) },
    });
  }

  if (normalized.brand && options.length < 3) {
    options.push({
      id: "remove-brand",
      label: "Показать все марки",
      description: `Убрать марку «${normalized.brand}»`,
      remove: "brand",
    });
  }

  return options.slice(0, 3);
}
