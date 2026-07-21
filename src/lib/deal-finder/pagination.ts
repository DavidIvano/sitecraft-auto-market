import {
  DEAL_FINDER_ALLOWED_SORTS,
  DEAL_FINDER_DEFAULT_PER_PAGE,
  DEAL_FINDER_DEFAULT_SORT,
  DEAL_FINDER_MAX_PER_PAGE,
  DEAL_FINDER_PER_PAGE_OPTIONS,
} from "./constants.ts";
import type { DealFinderFilters, DealFinderPagination, DealFinderSort } from "./types.ts";

const numericFilterNames = [
  "price_min",
  "price_max",
  "year_min",
  "year_max",
  "mileage_max",
  "deal_score_min",
  "deal_score_max",
] as const;
const textFilterNames = ["search", "brand", "model", "fuel_type", "transmission"] as const;

export type DealFinderPageItem = number | "ellipsis";

export function normalizeDealFinderPage(value: unknown) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function normalizeDealFinderPerPage(value: unknown) {
  const perPage = Number(value);
  return DEAL_FINDER_PER_PAGE_OPTIONS.includes(perPage as (typeof DEAL_FINDER_PER_PAGE_OPTIONS)[number])
    ? perPage
    : DEAL_FINDER_DEFAULT_PER_PAGE;
}

export function clampDealFinderPerPage(value: unknown) {
  const perPage = Number(value);
  return Number.isFinite(perPage)
    ? Math.min(DEAL_FINDER_MAX_PER_PAGE, Math.max(1, Math.trunc(perPage)))
    : DEAL_FINDER_DEFAULT_PER_PAGE;
}

export function parseDealFinderUrlState(params: URLSearchParams): DealFinderFilters {
  const sortValue = params.get("sort") as DealFinderSort | null;
  const filters: DealFinderFilters = {
    page: normalizeDealFinderPage(params.get("page")),
    per_page: normalizeDealFinderPerPage(params.get("per_page")),
    sort: sortValue && DEAL_FINDER_ALLOWED_SORTS.includes(sortValue) ? sortValue : DEAL_FINDER_DEFAULT_SORT,
  };

  textFilterNames.forEach((name) => {
    const value = params.get(name)?.trim();
    if (value) filters[name] = value;
  });
  numericFilterNames.forEach((name) => {
    const raw = params.get(name);
    if (raw === null || raw === "") return;
    const value = Number(raw);
    if (Number.isFinite(value)) filters[name] = value;
  });

  return filters;
}

export function writeDealFinderUrlState(params: URLSearchParams, filters: DealFinderFilters) {
  const next = new URLSearchParams(params);
  ["page", "per_page", "sort", ...textFilterNames, ...numericFilterNames].forEach((name) => next.delete(name));
  next.set("page", String(normalizeDealFinderPage(filters.page)));
  next.set("per_page", String(normalizeDealFinderPerPage(filters.per_page)));
  next.set("sort", filters.sort && DEAL_FINDER_ALLOWED_SORTS.includes(filters.sort) ? filters.sort : DEAL_FINDER_DEFAULT_SORT);

  textFilterNames.forEach((name) => {
    const value = filters[name]?.trim();
    if (value) next.set(name, value);
  });
  numericFilterNames.forEach((name) => {
    const value = filters[name];
    if (typeof value === "number" && Number.isFinite(value)) next.set(name, String(value));
  });
  return next;
}

export function getDealFinderResultRange(pagination: DealFinderPagination, count: number) {
  if (pagination.total <= 0 || count <= 0) return "Показано 0 из 0";
  const start = (pagination.page - 1) * pagination.per_page + 1;
  const end = Math.min(pagination.total, start + count - 1);
  return `Показано ${start}–${end} из ${pagination.total}`;
}

export function getDealFinderPageItems(currentPage: number, totalPages: number): DealFinderPageItem[] {
  if (totalPages <= 1) return [];
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const items: DealFinderPageItem[] = [];
  sorted.forEach((page, index) => {
    const previous = sorted[index - 1];
    if (previous && page - previous > 1) items.push("ellipsis");
    items.push(page);
  });
  return items;
}
