import { isDisplayValue, parseNullableBoolean } from "./listingFields.ts";
import { DEFAULT_LOCALE, type Locale } from "../i18n/locales.ts";
import { getDetailMessages } from "../i18n/detailMessages.ts";
import { interpolate } from "../i18n/messages.ts";
import { normalizeBackendValue, translateBackendValue } from "../i18n/backendValues.ts";

const monthPattern = /^(\d{4})-(\d{2})$/;

export function formatFirstRegistration(value: unknown) {
  const match = String(value ?? "").trim().match(monthPattern);
  return match ? `${match[2]}/${match[1]}` : "";
}

export function formatOwnersCount(value: unknown, locale: Locale = DEFAULT_LOCALE) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) return "";
  if (locale === "ru") {
    if (count === 1) return "1 владелец";
    if (count >= 2 && count <= 4) return `${count} владельца`;
  }
  return interpolate(getDetailMessages(locale).ownersCount, { count });
}

export function formatCount(value: unknown, noun: "door" | "seat", locale: Locale = DEFAULT_LOCALE) {
  const text = String(value ?? "").trim();
  const messages = getDetailMessages(locale);
  if (noun === "door" && /^\d+\/\d+$/.test(text)) return interpolate(messages.doorsCount, { count: text });

  const count = Number(text);
  if (!Number.isInteger(count) || count < 1) return "";
  if (locale === "ru") return noun === "door" ? `${count} дверей` : `${count} мест`;
  return interpolate(noun === "door" ? messages.doorsCount : messages.seatsCount, { count });
}

export function formatTuvDetail(hasValidTuv: unknown, validUntil: unknown, locale: Locale = DEFAULT_LOCALE) {
  const messages = getDetailMessages(locale);
  const normalized = parseNullableBoolean(hasValidTuv);
  if (normalized === false) return messages.noValidTuv;
  if (normalized === true) {
    const formattedUntil = formatFirstRegistration(validUntil);
    return formattedUntil ? interpolate(messages.tuvUntil, { value: formattedUntil }) : messages.validTuv;
  }
  return messages.notProvided;
}

export function formatImportantDetail(value: unknown, locale: Locale = DEFAULT_LOCALE) {
  return isDisplayValue(value) ? String(value).trim() : getDetailMessages(locale).notProvided;
}

export function formatSellerType(value: unknown, locale: Locale = DEFAULT_LOCALE) {
  const code = normalizeBackendValue("seller_type", value);
  return ["private", "dealership", "dealer"].includes(code)
    ? translateBackendValue("seller_type", code, locale)
    : "";
}
