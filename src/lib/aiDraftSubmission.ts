import { validateTuvFields } from "./listingFields.ts";
import { validateSellerContactProfile } from "./contactProfile.ts";

export type AiDraftIdentity = {
  draftId: string | number | null;
  listingId: string | number | null;
};

export type ListingFieldIssue = {
  field: string;
  message: string;
};

function listingApiMessage(payload: unknown) {
  if (typeof payload === "string") return payload.trim();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const source = payload as Record<string, any>;
  return String(source.message || source.error || source.payload?.message || "").trim();
}

export function isNonEditableListingDraftError(payload: unknown) {
  return /this draft is no longer editable|draft not found/i.test(listingApiMessage(payload));
}

export function isDuplicateListingDraftError(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return /duplicate|already exists|unique constraint|idempotency/i.test(listingApiMessage(payload));
  }

  const source = payload as Record<string, any>;
  const code = String(source.code || source.error_type || source.payload?.code || "").trim();
  return /duplicate|already exists|unique constraint|idempotency/i.test(`${code} ${listingApiMessage(payload)}`);
}

export function extractListingDraftFieldIssues(payload: unknown): ListingFieldIssue[] {
  const structured = extractListingFieldIssues(payload);
  if (structured.length) return structured;

  const message = listingApiMessage(payload);
  const knownIssues: Array<[RegExp, ListingFieldIssue]> = [
    [/year must be between/i, { field: "year", message: "Проверьте год выпуска автомобиля." }],
    [/mileage must be zero or greater/i, { field: "mileage", message: "Пробег не может быть отрицательным." }],
    [/price must be zero or greater/i, { field: "price", message: "Цена не может быть отрицательной." }],
    [/vin must contain 17 valid characters/i, { field: "vin", message: "VIN должен состоять из 17 допустимых символов." }],
    [/city cannot contain digits only/i, { field: "city", message: "Укажите название города, а не только цифры." }],
    [/tüv\/hu date must use yyyy-mm/i, { field: "tuv_valid_until", message: "Укажите срок TÜV / HU в формате месяц и год." }],
    [/maximum of 8 images|images must use public https urls|invalid (r2_images|image_urls|image_keys)/i, {
      field: "images",
      message: "Проверьте фотографии: можно загрузить до 8 изображений поддерживаемого формата.",
    }],
  ];

  const match = knownIssues.find(([pattern]) => pattern.test(message));
  return match ? [match[1]] : [];
}

export class ListingSubmissionApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues: ListingFieldIssue[];
  readonly payload: unknown;

  constructor(status: number, payload: unknown) {
    const source = payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload as Record<string, any>
      : {};
    const issues = extractListingFieldIssues(payload);
    const rawMessage = String(source.message || source.payload?.message || (typeof payload === "string" ? payload : "")).trim();
    const statusMessage = status === 401
      ? "Сессия завершена. Войдите снова и повторите отправку."
      : status === 403
        ? "Сервер отклонил право на отправку объявления. Обновите вход и повторите отправку."
        : "Не удалось отправить объявление на модерацию.";
    super([401, 403].includes(status) ? statusMessage : rawMessage || issues[0]?.message || statusMessage);
    this.name = "ListingSubmissionApiError";
    this.status = status;
    this.code = String(source.code || source.payload?.code || "LISTING_SUBMISSION_FAILED").trim();
    this.issues = issues;
    this.payload = payload;
  }
}

export const BACKEND_FIELD_TO_CONTROL: Record<string, string> = {
  title: "title",
  vehicle_type: "vehicle_type",
  brand: "brand",
  make: "brand",
  model: "model",
  year: "year",
  price: "price",
  currency: "currency",
  mileage: "mileage",
  city: "city",
  country: "country",
  body_type: "body_type",
  fuel_type: "fuel_type",
  engine_volume: "engine_volume",
  transmission: "transmission",
  drivetrain: "drivetrain",
  doors: "doors",
  seats: "seats",
  color: "color",
  owners_count: "owners_count",
  owner_count: "owners_count",
  first_registration: "first_registration",
  first_registration_date: "first_registration",
  vehicle_condition: "vehicle_condition",
  condition: "vehicle_condition",
  seller_type: "seller_type",
  seller_name: "seller_name",
  seller_phone: "seller_phone",
  seller_email: "seller_email",
  seller_contact: "seller_contact",
  has_valid_tuv: "has_valid_tuv",
  tuv_valid_until: "tuv_valid_until",
  vin: "vin",
  description: "description",
  images: "photos",
  photos: "photos",
};

function explicitId(...values: unknown[]) {
  const value = values.find((candidate) => (
    (typeof candidate === "number" && Number.isInteger(candidate) && candidate > 0)
    || (typeof candidate === "string" && candidate.trim() !== "")
  ));

  return typeof value === "string" ? value.trim() : (value as number | undefined) ?? null;
}

export function extractAiDraftIdentity(payload: unknown): AiDraftIdentity {
  const source = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, any>
    : {};

  return {
    // Root `id` is intentionally ignored: analyze endpoints may return a log or generation id.
    draftId: explicitId(source.draft_id, source.draft?.id),
    listingId: explicitId(source.listing_id, source.car_id, source.listing?.id, source.car?.id),
  };
}

function issueArray(payload: Record<string, any>) {
  const candidates = [
    payload.errors,
    payload.payload?.errors,
    payload.payload,
    payload.response?.errors,
    payload.response?.payload,
  ];

  return candidates.find(Array.isArray) || [];
}

export function extractListingFieldIssues(payload: unknown): ListingFieldIssue[] {
  const source = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, any>
    : {};

  return issueArray(source)
    .map((value: unknown) => {
      if (typeof value === "string") {
        return { field: "", message: value.trim() };
      }

      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const issue = value as Record<string, unknown>;
      const field = String(issue.field || issue.name || "").trim();
      const message = String(issue.message || issue.error || issue.label || "").trim();
      return message ? { field, message } : null;
    })
    .filter((value: ListingFieldIssue | null): value is ListingFieldIssue => Boolean(value));
}

export async function readListingSubmissionApiResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  let payload: unknown;

  if (contentType.includes("application/json")) {
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
  } else {
    payload = await response.text();
  }

  if (!response.ok) throw new ListingSubmissionApiError(response.status, payload);
  return payload;
}

export function normalizeTuvSubmissionValue(value: unknown) {
  if (value === true || value === "true") return "true";
  if (value === false || value === "false") return "false";
  return "";
}

export function validateAiDraftSubmission(
  data: Record<string, string>,
  options: { allowExtremePrice?: boolean; imageCount?: number; now?: Date; requirePublicContact?: boolean } = {},
) {
  const issues: ListingFieldIssue[] = [];
  const add = (field: string, message: string) => issues.push({ field, message });
  const price = Number(data.price || 0);
  const year = Number(data.year || 0);
  const mileage = Number(data.mileage || 0);
  const currentYear = (options.now || new Date()).getFullYear();
  const city = String(data.city || data.location || "").trim();
  const fuel = String(data.fuel_type || data.fuelType || "").toLowerCase();
  const vehicleType = String(data.vehicle_type || data.vehicleType || "").toLowerCase();
  const phone = String(data.seller_phone || data.sellerPhone || "").trim();
  const email = String(data.seller_email || data.sellerEmail || "").trim();
  const showPhone = data.show_phone == null || data.show_phone === ""
    ? Boolean(phone)
    : data.show_phone === "true" || data.show_phone === "on";
  const showEmail = data.show_email == null || data.show_email === ""
    ? Boolean(email)
    : data.show_email === "true" || data.show_email === "on";
  const vin = String(data.vin || "").trim();
  const firstRegistration = String(data.first_registration || data.first_registration_date || "").trim();
  const required: Array<[string, string, string]> = [
    ["title", data.title, "Укажите название объявления."],
    ["brand", data.brand, "Укажите марку."],
    ["model", data.model, "Укажите модель."],
    ["currency", data.currency, "Укажите валюту."],
    ["country", data.country, "Укажите страну."],
    ["vehicle_type", data.vehicle_type, "Укажите тип транспорта."],
    ["body_type", data.body_type, "Укажите тип кузова."],
    ["fuel_type", data.fuel_type, "Укажите топливо."],
    ["transmission", data.transmission, "Укажите коробку передач."],
    ["drivetrain", data.drivetrain, "Укажите привод."],
    ["doors", data.doors, "Укажите количество дверей."],
    ["seats", data.seats, "Укажите количество мест."],
    ["color", data.color, "Укажите цвет."],
    ["owners_count", data.owners_count, "Укажите количество владельцев."],
    ["first_registration", data.first_registration, "Укажите дату первой регистрации."],
    ["vehicle_condition", data.vehicle_condition, "Укажите состояние автомобиля."],
    ["seller_type", data.seller_type, "Укажите тип продавца."],
    ["seller_name", data.seller_name, "Укажите имя продавца."],
  ];

  required.forEach(([field, value, message]) => {
    if (!String(value || "").trim()) add(field, message);
  });

  const contactValidation = validateSellerContactProfile({
    display_name: data.seller_name,
    contact_phone: phone,
    contact_email: email,
    show_phone: showPhone,
    show_email: showEmail,
    preferred_contact_method: data.preferred_contact_method,
  }, { requirePublicContact: options.requirePublicContact !== false });
  if (!contactValidation.valid) add(contactValidation.field || "seller_contact", contactValidation.message);
  if (!options.allowExtremePrice && (price < 100 || price > 500000)) add("price", "Цена должна быть от 100 € до 500 000 €.");
  if (year < 1950 || year > currentYear) add("year", `Год выпуска должен быть от 1950 до ${currentYear}.`);
  if (mileage < 0) add("mileage", "Пробег не может быть отрицательным.");
  if ((vehicleType.includes("электро") || fuel.includes("электро")) && fuel.includes("диз")) {
    add("fuel_type", "Нельзя одновременно выбрать электромобиль и дизель.");
  }
  if (!city || /^\d+$/.test(city)) add("city", "Город должен содержать название, а не только цифры.");
  if (vin && !/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) add("vin", "VIN должен состоять из 17 латинских букв и цифр без I, O и Q.");

  if (firstRegistration) {
    const match = firstRegistration.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
    const currentMonth = (options.now || new Date()).getMonth() + 1;
    const registrationMonth = match ? Number(match[1]) * 12 + Number(match[2]) : 0;
    const maximumMonth = currentYear * 12 + currentMonth;

    if (!match) {
      add("first_registration", "Укажите дату первой регистрации в формате YYYY-MM.");
    } else if (registrationMonth > maximumMonth) {
      add("first_registration", "Дата первой регистрации не может быть в будущем.");
    } else if (year && Number(match[1]) < year) {
      add("first_registration", "Дата первой регистрации не может быть раньше года выпуска.");
    }
  }

  const tuv = validateTuvFields(data.has_valid_tuv, data.tuv_valid_until, options.now);
  tuv.issues.forEach((message) => add(
    message.includes("Укажите, есть ли") ? "has_valid_tuv" : "tuv_valid_until",
    message,
  ));

  if (options.imageCount !== undefined && options.imageCount < 1) {
    add("images", "Добавьте минимум одну фотографию автомобиля.");
  }
  if (options.imageCount !== undefined && options.imageCount > 8) {
    add("images", "Можно добавить не более 8 фотографий автомобиля.");
  }

  return { ok: issues.length === 0, issues, errors: issues.map((issue) => issue.message) };
}
