import { validateTuvFields } from "./listingFields.ts";

export type AiDraftIdentity = {
  draftId: string | number | null;
  listingId: string | number | null;
};

export type ListingFieldIssue = {
  field: string;
  message: string;
};

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
  seller_contact: "seller_phone",
  contact: "seller_phone",
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

export function normalizeTuvSubmissionValue(value: unknown) {
  if (value === true || value === "true") return "true";
  if (value === false || value === "false") return "false";
  return "";
}

export function validateAiDraftSubmission(
  data: Record<string, string>,
  options: { allowExtremePrice?: boolean; imageCount?: number; now?: Date } = {},
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

  if (!phone && !email) add("seller_contact", "Укажите телефон или email продавца.");
  if (!options.allowExtremePrice && (price < 100 || price > 500000)) add("price", "Цена должна быть от 100 € до 500 000 €.");
  if (year < 1950 || year > currentYear) add("year", `Год выпуска должен быть от 1950 до ${currentYear}.`);
  if (mileage < 0) add("mileage", "Пробег не может быть отрицательным.");
  if ((vehicleType.includes("электро") || fuel.includes("электро")) && fuel.includes("диз")) {
    add("fuel_type", "Нельзя одновременно выбрать электромобиль и дизель.");
  }
  if (!city || /^\d+$/.test(city)) add("city", "Город должен содержать название, а не только цифры.");
  if (phone && !/^[+()\d\s-]{7,24}$/.test(phone)) add("seller_phone", "Телефон указан в неверном формате.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) add("seller_email", "Email указан в неверном формате.");
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
