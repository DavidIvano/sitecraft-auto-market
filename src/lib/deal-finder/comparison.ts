import type { DealFinderListing } from "./types";

export const DEAL_FINDER_COMPARISON_STORAGE_KEY = "sitecraft_deal_finder_comparison";
export const DEAL_FINDER_COMPARISON_MIN = 2;
export const DEAL_FINDER_COMPARISON_MAX = 4;

export type DealFinderComparisonToggleResult = {
  ids: number[];
  status: "added" | "removed" | "limit";
};

export type DealFinderComparisonCell = {
  listingId: number;
  value: string;
  missing: boolean;
  best: boolean;
};

export type DealFinderComparisonRow = {
  key: string;
  label: string;
  cells: DealFinderComparisonCell[];
};

type ComparisonField = {
  key: string;
  label: string;
  numeric?: "min" | "max";
  raw: (listing: DealFinderListing) => string | number | null | undefined;
  format?: (value: string | number) => string;
};

const fields: ComparisonField[] = [
  { key: "price", label: "Цена", numeric: "min", raw: (listing) => listing.price, format: (value) => `${Number(value).toLocaleString("ru-RU")} ${value === null ? "" : "EUR"}` },
  { key: "year", label: "Год", numeric: "max", raw: (listing) => listing.year },
  { key: "mileage", label: "Пробег", numeric: "min", raw: (listing) => listing.mileage, format: (value) => `${Number(value).toLocaleString("ru-RU")} км` },
  { key: "fuel", label: "Топливо", raw: (listing) => listing.fuel_type },
  { key: "transmission", label: "Коробка", raw: (listing) => listing.transmission },
  { key: "power", label: "Мощность", numeric: "max", raw: (listing) => listing.power_kw, format: (value) => `${value} кВт` },
  { key: "city", label: "Город", raw: (listing) => listing.city },
  { key: "score", label: "Deal score", numeric: "max", raw: (listing) => listing.analysis?.deal_score, format: (value) => `${Math.round(Number(value))}/100` },
  { key: "recommendation", label: "Рекомендация", raw: (listing) => listing.analysis?.recommendation },
  { key: "confidence", label: "Уверенность AI", numeric: "max", raw: (listing) => listing.analysis?.confidence_score, format: (value) => `${Math.round(Number(value) * 100)}%` },
  { key: "source", label: "Источник", raw: (listing) => listing.source_status === "active" ? "Активен" : "Недоступен" },
];

export function normalizeComparisonIds(value: unknown) {
  const input = Array.isArray(value) ? value : [];
  return [...new Set(input.map(Number).filter((id) => Number.isInteger(id) && id > 0))].slice(0, DEAL_FINDER_COMPARISON_MAX);
}

export function readComparisonIds(storage: Pick<Storage, "getItem"> | null) {
  if (!storage) return [];
  try {
    return normalizeComparisonIds(JSON.parse(storage.getItem(DEAL_FINDER_COMPARISON_STORAGE_KEY) || "[]"));
  } catch {
    return [];
  }
}

export function writeComparisonIds(storage: Pick<Storage, "setItem"> | null, ids: unknown) {
  const normalized = normalizeComparisonIds(ids);
  storage?.setItem(DEAL_FINDER_COMPARISON_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function toggleComparisonId(
  storage: Pick<Storage, "getItem" | "setItem"> | null,
  listingId: number,
): DealFinderComparisonToggleResult {
  const ids = readComparisonIds(storage);
  if (ids.includes(listingId)) {
    return { ids: writeComparisonIds(storage, ids.filter((id) => id !== listingId)), status: "removed" };
  }
  if (ids.length >= DEAL_FINDER_COMPARISON_MAX) return { ids, status: "limit" };
  return { ids: writeComparisonIds(storage, [...ids, listingId]), status: "added" };
}

export function isComparisonSelected(storage: Pick<Storage, "getItem"> | null, listingId: number) {
  return readComparisonIds(storage).includes(listingId);
}

function isPresent(value: unknown): value is string | number {
  return value !== null && value !== undefined && value !== "";
}

export function buildComparisonRows(listings: DealFinderListing[]): DealFinderComparisonRow[] {
  return fields.map((field) => {
    const rawValues = listings.map(field.raw);
    const numericValues = rawValues.filter(isPresent).map(Number).filter(Number.isFinite);
    const bestValue = field.numeric && numericValues.length
      ? field.numeric === "min" ? Math.min(...numericValues) : Math.max(...numericValues)
      : null;
    return {
      key: field.key,
      label: field.label,
      cells: listings.map((listing, index) => {
        const raw = rawValues[index];
        const missing = !isPresent(raw);
        return {
          listingId: listing.id,
          value: missing ? "Нет данных" : field.format ? field.format(raw) : String(raw),
          missing,
          best: !missing && bestValue !== null && Number(raw) === bestValue,
        };
      }),
    };
  });
}
