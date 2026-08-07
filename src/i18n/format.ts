import { getIntlLocale } from "./locale.ts";

export function formatNumber(value: unknown, locale: string, options: Intl.NumberFormatOptions = {}) {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat(getIntlLocale(locale), options).format(number) : "";
}

export function formatCurrency(value: unknown, currency: string, locale: string) {
  return formatNumber(value, locale, {
    style: "currency",
    currency: currency || "EUR",
    maximumFractionDigits: 0,
  });
}

export function formatDate(value: unknown, locale: string, options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(getIntlLocale(locale), options).format(date);
}

export function formatMileage(value: unknown, locale: string) {
  const number = formatNumber(value, locale, { maximumFractionDigits: 0 });
  return number ? `${number} km` : "";
}

export function formatOwners(value: unknown, locale: string) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) return "";
  const labels: Record<string, [string, string]> = {
    de: ["Halter", "Halter"],
    en: ["owner", "owners"],
    ru: ["владелец", "владельцев"],
    uk: ["власник", "власників"],
    "zh-Hans": ["位车主", "位车主"],
  };
  const [one, many] = labels[getIntlLocale(locale)] || labels.en;
  return `${formatNumber(count, locale)} ${count === 1 ? one : many}`;
}

export function formatDoors(value: unknown, locale: string) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) return "";
  const labels: Record<string, string> = { de: "Türen", en: "doors", ru: "дверей", uk: "дверей", "zh-Hans": "门" };
  return `${formatNumber(count, locale)} ${labels[getIntlLocale(locale)] || labels.en}`;
}

export function formatSeats(value: unknown, locale: string) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) return "";
  const labels: Record<string, string> = { de: "Sitze", en: "seats", ru: "мест", uk: "місць", "zh-Hans": "座" };
  return `${formatNumber(count, locale)} ${labels[getIntlLocale(locale)] || labels.en}`;
}

export function formatSellerType(value: unknown, locale: string) {
  const code = String(value ?? "").trim().toLowerCase();
  const labels: Record<string, Record<string, string>> = {
    private: { de: "Privatverkäufer", en: "Private seller", ru: "Частный продавец", uk: "Приватний продавець", "zh-Hans": "个人卖家" },
    dealer: { de: "Händler", en: "Dealer", ru: "Дилер", uk: "Дилер", "zh-Hans": "经销商" },
  };
  return labels[code]?.[getIntlLocale(locale)] || labels[code]?.en || "";
}
