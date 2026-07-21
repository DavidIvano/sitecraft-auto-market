import type { CarListing } from "./types";

export type NullableBoolean = boolean | null;

export type CanonicalListingFields = {
  vehicle_type?: string;
  brand?: string;
  model?: string;
  year?: number | string;
  price?: number | string;
  currency?: string;
  mileage?: number | string;
  city?: string;
  country?: string;
  body_type?: string;
  fuel_type?: string;
  engine_volume?: string;
  transmission?: string;
  drivetrain?: string;
  doors?: number | string;
  seats?: number | string;
  color?: string;
  owners_count?: number | string;
  first_registration?: string;
  vehicle_condition?: string;
  seller_type?: string;
  vin?: string;
  seller_name?: string;
  seller_phone?: string;
  seller_email?: string;
  title?: string;
  description?: string;
  has_valid_tuv?: NullableBoolean;
  tuv_valid_until?: string | null;
};

export const LISTING_FIELD_ALIASES = {
  drive_type: "drivetrain",
  owner_count: "owners_count",
  condition: "vehicle_condition",
  registration_date: "first_registration",
  first_registration_date: "first_registration",
} as const;

const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/i;
const YEAR_MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function cleanListingValue(value: unknown) {
  return typeof value === "string" ? value.trim() : value;
}

export function parseNullableBoolean(value: unknown): NullableBoolean {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  return null;
}

function firstDefined(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

export function normalizeListingFields(
  input: Partial<CarListing> & Record<string, unknown>,
): CanonicalListingFields {
  const fields: CanonicalListingFields = {
    vehicle_type: String(input.vehicle_type ?? "").trim(),
    brand: String(input.brand ?? "").trim(),
    model: String(input.model ?? "").trim(),
    year: cleanListingValue(input.year) as number | string,
    price: cleanListingValue(input.price) as number | string,
    currency: String(input.currency ?? "").trim(),
    mileage: cleanListingValue(input.mileage) as number | string,
    city: String(input.city ?? "").trim(),
    country: String(input.country ?? "").trim(),
    body_type: String(input.body_type ?? "").trim(),
    fuel_type: String(input.fuel_type ?? "").trim(),
    engine_volume: String(input.engine_volume ?? "").trim(),
    transmission: String(input.transmission ?? "").trim(),
    drivetrain: String(firstDefined(input.drivetrain, input.drive_type) ?? "").trim(),
    doors: cleanListingValue(input.doors) as number | string,
    seats: cleanListingValue(input.seats) as number | string,
    color: String(input.color ?? "").trim(),
    owners_count: cleanListingValue(firstDefined(input.owners_count, input.owner_count)) as number | string,
    first_registration: String(
      firstDefined(input.first_registration, input.first_registration_date, input.registration_date) ?? "",
    ).trim(),
    vehicle_condition: String(firstDefined(input.vehicle_condition, input.condition) ?? "").trim(),
    seller_type: String(input.seller_type ?? "").trim(),
    vin: String(input.vin ?? "").trim().toUpperCase(),
    seller_name: String(input.seller_name ?? "").trim(),
    seller_phone: String(input.seller_phone ?? "").trim(),
    seller_email: String(input.seller_email ?? "").trim(),
    title: String(input.title ?? "").trim(),
    description: String(input.description ?? "").trim(),
    has_valid_tuv: parseNullableBoolean(input.has_valid_tuv),
    tuv_valid_until: String(input.tuv_valid_until ?? "").trim() || null,
  };

  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== "" && value !== undefined),
  ) as CanonicalListingFields;
}

export function validateTuvFields(
  hasValidTuv: unknown,
  validUntil: unknown,
  now = new Date(),
) {
  const confirmed = parseNullableBoolean(hasValidTuv);
  const month = String(validUntil ?? "").trim();
  const issues: string[] = [];

  if (confirmed === null) {
    issues.push("Укажите, есть ли у автомобиля действующий TÜV / HU.");
  } else if (confirmed === true) {
    const match = month.match(YEAR_MONTH_PATTERN);
    if (!match) {
      issues.push("Укажите месяц окончания TÜV / HU в формате YYYY-MM.");
    } else {
      const validThrough = new Date(Number(match[1]), Number(match[2]), 0, 23, 59, 59, 999);
      if (validThrough.getTime() < now.getTime()) {
        issues.push("Срок действия TÜV / HU должен быть в будущем.");
      }
    }
  } else if (month) {
    issues.push("Очистите дату TÜV / HU, если действующего осмотра нет.");
  }

  return { valid: issues.length === 0, issues, hasValidTuv: confirmed, validUntil: confirmed ? month || null : null };
}

export function formatTuvValue(hasValidTuv: unknown, validUntil: unknown) {
  const confirmed = parseNullableBoolean(hasValidTuv);
  const month = String(validUntil ?? "").trim();

  if (confirmed === false) return "Нет";
  if (confirmed !== true || !YEAR_MONTH_PATTERN.test(month)) return "";

  const [, year, numericMonth] = month.match(YEAR_MONTH_PATTERN) || [];
  return year && numericMonth ? `до ${numericMonth}/${year}` : "";
}

export function maskVin(value: unknown) {
  const vin = String(value ?? "").trim().toUpperCase();
  if (!VIN_PATTERN.test(vin)) return "";
  return `${vin.slice(0, 3)}${"*".repeat(11)}${vin.slice(-3)}`;
}

export function sanitizePublicDescription(value: unknown) {
  const sensitiveLabel = /^(телефон|phone|email|e-mail|продавец|seller|vin)\s*:/i;

  return String(value ?? "")
    .split(/\r?\n/)
    .filter((line) => !sensitiveLabel.test(line.trim()))
    .map((line) => line
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "")
      .replace(/\+?\d[\d\s()./-]{7,}\d/g, (match) => (
        match.replace(/\D/g, "").length >= 9 ? "" : match
      ))
      .replace(/\s{2,}/g, " ")
      .trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function isDisplayValue(value: unknown) {
  if (value === undefined || value === null || value === false) return false;
  const text = String(value).trim();
  if (!text || /^(undefined|null|nan|0|0\.0|не указан[ао]?)$/i.test(text)) return false;
  return true;
}
