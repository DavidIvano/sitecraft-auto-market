import type { CarListing } from "../types";
import { validateSellerContactProfile } from "../contactProfile";
import { normalizeListingFields, validateTuvFields } from "../listingFields";

export type ListingValidationSeverity = "critical" | "warning";

export type ListingValidationIssue = {
  field: string;
  code: string;
  message: string;
  severity: ListingValidationSeverity;
};

export type ListingValidationOptions = {
  allowExtremePrice?: boolean;
  requirePhotos?: boolean;
  requireDescription?: boolean;
  requirePublicContact?: boolean;
};

export type ListingValidationResult = {
  valid: boolean;
  canSubmitToReview: boolean;
  canPublish: boolean;
  qualityScore: number;
  issues: ListingValidationIssue[];
  critical: ListingValidationIssue[];
  warnings: ListingValidationIssue[];
};

const CURRENT_YEAR = new Date().getFullYear();
const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/i;

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function asNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(asString(value).replace(/\s/g, ""));
  return Number.isFinite(number) ? number : null;
}

function addIssue(
  issues: ListingValidationIssue[],
  field: string,
  code: string,
  message: string,
  severity: ListingValidationSeverity = "critical",
) {
  issues.push({ field, code, message, severity });
}

function countPhotos(listing: Partial<CarListing> & Record<string, unknown>) {
  if (Array.isArray(listing.images)) {
    return listing.images.filter((image) => !image.is_deleted).length;
  }

  if (Array.isArray(listing.image_urls)) {
    return listing.image_urls.length;
  }

  if (typeof listing.image_urls === "string" && listing.image_urls.trim()) {
    try {
      const parsed = JSON.parse(listing.image_urls);
      return Array.isArray(parsed) ? parsed.length : 1;
    } catch {
      return listing.image_urls.startsWith("http") ? 1 : 0;
    }
  }

  return listing.main_image_url || listing.cover_image_url ? 1 : 0;
}

export function validateListingData(
  listing: Partial<CarListing> & Record<string, unknown>,
  options: ListingValidationOptions = {},
): ListingValidationResult {
  const issues: ListingValidationIssue[] = [];
  const canonical = normalizeListingFields(listing);
  const price = asNumber(listing.price);
  const year = asNumber(listing.year);
  const mileage = asNumber(listing.mileage);
  const city = asString(listing.city);
  const rawContact = listing.seller_contact && typeof listing.seller_contact === "object"
    ? listing.seller_contact as Record<string, unknown>
    : {
        display_name: listing.seller_name,
        contact_phone: listing.seller_phone,
        contact_email: listing.seller_email,
        show_phone: Boolean(asString(listing.seller_phone)),
        show_email: Boolean(asString(listing.seller_email)),
        preferred_contact_method: null,
      };
  const vin = asString(listing.vin);
  const firstRegistration = asString(canonical.first_registration);
  const fuelType = asString(listing.fuel_type).toLowerCase();
  const vehicleType = asString(listing.vehicle_type).toLowerCase();
  const description = asString(listing.description);
  const photoCount = countPhotos(listing);

  if (!asString(listing.brand)) addIssue(issues, "brand", "brand_required", "Укажите марку автомобиля.");
  if (!asString(listing.model)) addIssue(issues, "model", "model_required", "Укажите модель автомобиля.");
  if (!city) addIssue(issues, "city", "city_required", "Укажите город.");
  if (city && /^\d+$/.test(city)) addIssue(issues, "city", "city_numeric", "Город не может состоять только из цифр.");

  if (year == null) {
    addIssue(issues, "year", "year_required", "Укажите год выпуска.");
  } else if (year < 1950 || year > CURRENT_YEAR) {
    addIssue(issues, "year", "year_range", `Год должен быть между 1950 и ${CURRENT_YEAR}.`);
  }

  if (mileage == null) {
    addIssue(issues, "mileage", "mileage_required", "Укажите пробег.");
  } else if (mileage < 0) {
    addIssue(issues, "mileage", "mileage_negative", "Пробег не может быть отрицательным.");
  }

  if (price == null) {
    addIssue(issues, "price", "price_required", "Укажите цену.");
  } else if (!options.allowExtremePrice && (price < 100 || price > 500000)) {
    addIssue(issues, "price", "price_range", "Цена должна быть от 100 € до 500 000 € или требовать отдельного подтверждения.");
  }

  if (!asString(listing.fuel_type)) addIssue(issues, "fuel_type", "fuel_required", "Укажите тип топлива.");
  if (!asString(listing.transmission)) addIssue(issues, "transmission", "transmission_required", "Укажите коробку передач.");
  if (!asString(canonical.vehicle_type)) addIssue(issues, "vehicle_type", "vehicle_type_required", "Укажите тип транспорта.");
  if (!asString(canonical.body_type)) addIssue(issues, "body_type", "body_type_required", "Укажите тип кузова.");
  if (!asString(canonical.drivetrain)) addIssue(issues, "drivetrain", "drivetrain_required", "Укажите привод.");
  if (!asString(canonical.doors)) addIssue(issues, "doors", "doors_required", "Укажите количество дверей.");
  if (!asString(canonical.seats)) addIssue(issues, "seats", "seats_required", "Укажите количество мест.");
  if (!asString(canonical.color)) addIssue(issues, "color", "color_required", "Укажите цвет.");
  if (!asString(canonical.owners_count)) addIssue(issues, "owners_count", "owners_required", "Укажите количество владельцев.");
  if (!firstRegistration) {
    addIssue(issues, "first_registration", "registration_required", "Укажите дату первой регистрации.");
  } else if (year != null && /^\d{4}-\d{2}$/.test(firstRegistration) && Number(firstRegistration.slice(0, 4)) < year) {
    addIssue(issues, "first_registration", "registration_before_production", "Дата первой регистрации не может быть раньше года выпуска.");
  }
  if (!asString(canonical.vehicle_condition)) addIssue(issues, "vehicle_condition", "condition_required", "Укажите состояние автомобиля.");
  if (!asString(canonical.seller_type)) addIssue(issues, "seller_type", "seller_type_required", "Укажите тип продавца.");
  if (!asString(canonical.seller_name)) addIssue(issues, "seller_name", "seller_name_required", "Укажите имя продавца.");
  if (!asString(canonical.currency)) addIssue(issues, "currency", "currency_required", "Укажите валюту.");
  if (!asString(canonical.country)) addIssue(issues, "country", "country_required", "Укажите страну.");

  const tuvValidation = validateTuvFields(canonical.has_valid_tuv, canonical.tuv_valid_until);
  tuvValidation.issues.forEach((message) => addIssue(
    issues,
    message.startsWith("Укажите, есть ли") ? "has_valid_tuv" : "tuv_valid_until",
    "tuv_invalid",
    message,
  ));

  if ((vehicleType.includes("электро") || fuelType.includes("электро")) && fuelType.includes("диз")) {
    addIssue(issues, "fuel_type", "fuel_conflict", "Нельзя одновременно выбрать электромобиль и дизель.");
  }

  const contactValidation = validateSellerContactProfile(rawContact, {
    requirePublicContact: options.requirePublicContact !== false,
  });
  if (!contactValidation.valid) {
    addIssue(
      issues,
      contactValidation.field || "seller_contact",
      contactValidation.field ? "contact_invalid" : "contact_required",
      contactValidation.message,
    );
  }

  if (vin && !VIN_PATTERN.test(vin)) {
    addIssue(
      issues,
      "vin",
      "vin_invalid",
      "VIN должен состоять из 17 латинских букв и цифр без I, O и Q.",
      "warning",
    );
  }

  if (options.requirePhotos && photoCount < 1) {
    addIssue(issues, "photos", "photo_required", "Добавьте хотя бы одно фото автомобиля.");
  }

  if (options.requireDescription && description.length < 40) {
    addIssue(issues, "description", "description_short", "Добавьте более подробное описание автомобиля.", "warning");
  }

  const critical = issues.filter((issue) => issue.severity === "critical");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const filledChecks = [
    photoCount > 0,
    photoCount >= 3,
    Boolean(year),
    Boolean(mileage != null && mileage >= 0),
    Boolean(price),
    Boolean(city && !/^\d+$/.test(city)),
    Boolean(fuelType),
    Boolean(asString(listing.transmission)),
    description.length >= 40,
    critical.length === 0,
  ];
  const baseScore = Math.round((filledChecks.filter(Boolean).length / filledChecks.length) * 100);
  const qualityScore = Math.max(0, Math.min(100, baseScore - warnings.length * 4));

  return {
    valid: critical.length === 0,
    canSubmitToReview: critical.length === 0,
    canPublish: critical.length === 0 && photoCount > 0,
    qualityScore,
    issues,
    critical,
    warnings,
  };
}

export function getListingValidationMessage(result: ListingValidationResult) {
  if (result.valid) {
    return "Объявление готово к отправке на модерацию.";
  }

  return result.critical[0]?.message || "Проверьте обязательные поля.";
}
