import { DEAL_FINDER_PLACEHOLDER } from "./constants";

export function formatDealFinderPrice(value?: number | null, currency = "EUR") {
  if (!Number.isFinite(value)) return "Цена не указана";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export function formatDealFinderDate(value?: string | null) {
  if (!value) return "Не указано";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Не указано"
    : new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function isSafeDealFinderImageUrl(value?: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !/\.svg(?:$|\?)/i.test(url.pathname);
  } catch {
    return false;
  }
}

export function getDealFinderImageUrl(value?: string | null) {
  return isSafeDealFinderImageUrl(value) ? value! : DEAL_FINDER_PLACEHOLDER;
}

export function getDealFinderSourceHost(value?: string | null) {
  try {
    return value ? new URL(value).hostname.replace(/^www\./, "") : "Источник не указан";
  } catch {
    return "Источник не указан";
  }
}

export function getSafeDealFinderSourceUrl(value?: string | null) {
  try {
    const url = value ? new URL(value) : null;
    return url?.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
