import { formatTuvValue, isDisplayValue, parseNullableBoolean } from "./listingFields";

const monthPattern = /^(\d{4})-(\d{2})$/;

export function formatFirstRegistration(value: unknown) {
  const match = String(value ?? "").trim().match(monthPattern);
  return match ? `${match[2]}/${match[1]}` : "";
}

export function formatOwnersCount(value: unknown) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) return "";
  if (count === 1) return "1 владелец";
  if (count >= 2 && count <= 4) return `${count} владельца`;
  return `${count} владельцев`;
}

export function formatCount(value: unknown, noun: "door" | "seat") {
  const text = String(value ?? "").trim();
  if (noun === "door" && /^\d+\/\d+$/.test(text)) return `${text} дверей`;

  const count = Number(text);
  if (!Number.isInteger(count) || count < 1) return "";
  return noun === "door" ? `${count} дверей` : `${count} мест`;
}

export function formatTuvDetail(hasValidTuv: unknown, validUntil: unknown) {
  const normalized = parseNullableBoolean(hasValidTuv);
  if (normalized === false) return "Нет действующего TÜV / HU";
  if (normalized === true) return formatTuvValue(true, validUntil) || "Действующий TÜV / HU";
  return "Не указано продавцом";
}

export function formatImportantDetail(value: unknown) {
  return isDisplayValue(value) ? String(value).trim() : "Не указано продавцом";
}

export function formatSellerType(value: unknown) {
  const normalized = String(value ?? "").trim().toLocaleLowerCase("ru-RU");
  if (normalized === "dealer" || normalized === "дилер") return "Дилер";
  if (normalized === "salon" || normalized === "автосалон") return "Автосалон";
  if (normalized === "private" || normalized === "частный продавец") return "Частный продавец";
  return "";
}
