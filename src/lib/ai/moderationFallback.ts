import type { AiModerationCheckResponse, AiModerationIssue } from "./types";

type ModerationListing = Record<string, unknown>;
type ModerationImage = { url?: string; image_url?: string; image?: { url?: string } } | string | Record<string, unknown>;

function isFilled(value: unknown) {
  return String(value ?? "").trim().length > 0;
}

function parseLooseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : value.startsWith("http") ? [value] : [];
    } catch {
      return value.startsWith("http") ? [value] : [];
    }
  }

  return [];
}

function getImageCount(listing: ModerationListing, images: ModerationImage[] = []) {
  return Math.max(
    images.filter(Boolean).length,
    parseLooseArray(listing.images).length,
    parseLooseArray(listing.image_urls).length,
    isFilled(listing.cover_image_url) || isFilled(listing.main_image_url) ? 1 : 0,
  );
}

function hasSellerContact(listing: ModerationListing) {
  return isFilled(listing.seller_phone) || isFilled(listing.seller_email) || isFilled(listing.phone) || isFilled(listing.email);
}

function hasBadVin(value: unknown) {
  const vin = String(value || "").trim().toUpperCase();
  return Boolean(vin) && (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin) || /[IOQ]/.test(vin));
}

function pushIssue(issues: AiModerationIssue[], severity: AiModerationIssue["severity"], message: string, field?: string) {
  issues.push({ field, severity, message });
}

export function runModerationFallback(
  listing: ModerationListing,
  images: ModerationImage[] = [],
): AiModerationCheckResponse {
  const issues: AiModerationIssue[] = [];
  const currentYear = new Date().getFullYear();
  const year = Number(listing.year || 0);
  const price = Number(listing.price || 0);
  const mileage = Number(listing.mileage || 0);
  const imageCount = getImageCount(listing, images);
  const city = String(listing.city || "").trim();
  const fuelType = String(listing.fuel_type || "").toLocaleLowerCase("ru-RU");
  const description = String(listing.description || "").trim();

  if (!isFilled(listing.title)) pushIssue(issues, "critical", "Нет названия объявления.", "title");
  if (!isFilled(listing.brand) || !isFilled(listing.model)) pushIssue(issues, "critical", "Не указана марка или модель.", "brand");
  if (!year || year < 1950 || year > currentYear + 1) pushIssue(issues, "critical", "Год выпуска выглядит некорректно.", "year");
  if (!price || price <= 0) pushIssue(issues, "critical", "Цена не указана или равна нулю.", "price");
  if (!city || /^\d+$/.test(city)) pushIssue(issues, "critical", "Город не указан или заполнен некорректно.", "city");
  if (/электро|electric|ev/.test(fuelType) && /дизель|diesel/.test(fuelType)) {
    pushIssue(issues, "critical", "В типе топлива есть противоречие: электро и дизель одновременно.", "fuel_type");
  }
  if (hasBadVin(listing.vin)) pushIssue(issues, "critical", "VIN должен содержать 17 символов без I, O и Q.", "vin");

  if (imageCount === 0) pushIssue(issues, "warning", "Нет фото автомобиля.", "photos");
  if (imageCount > 0 && imageCount < 3) pushIssue(issues, "warning", "Меньше 3 фото, покупателю может быть недостаточно визуальной информации.", "photos");
  if (description.length < 80) pushIssue(issues, "warning", "Описание слишком короткое: добавьте состояние, обслуживание и комплектацию.", "description");
  if ((!mileage || mileage <= 0) && year && year < currentYear) pushIssue(issues, "warning", "Пробег не указан для ненового автомобиля.", "mileage");
  if (year >= currentYear - 2 && price > 0 && price < 1500) pushIssue(issues, "warning", "Цена выглядит слишком низкой для новой машины.", "price");
  if (!hasSellerContact(listing)) pushIssue(issues, "warning", "Контакт продавца не найден в данных объявления.", "seller_contact");
  if ("tuv_hu" in listing && !isFilled(listing.tuv_hu)) pushIssue(issues, "warning", "Поле TÜV/HU есть, но не заполнено.", "tuv_hu");

  if (imageCount > 0) pushIssue(issues, "info", "Фото есть, но локальная проверка не определяет, есть ли фото салона.", "photos");

  const criticalCount = issues.filter((issue) => issue.severity === "critical").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const infoCount = issues.filter((issue) => issue.severity === "info").length;
  const trustScore = Math.max(0, Math.min(100, 100 - criticalCount * 18 - warningCount * 8 - infoCount * 3));
  const riskLevel = criticalCount > 0 ? "high" : warningCount >= 2 ? "medium" : "low";
  const recommendation = riskLevel === "high" ? "needs_fix" : riskLevel === "medium" ? "needs_fix" : "approve";

  return {
    risk_level: riskLevel,
    trust_score: trustScore,
    issues,
    recommendation,
    suggested_action: recommendation === "approve" ? "approve" : "send_to_fix",
    suggested_rejection_reason: buildModerationReason(issues),
    warnings: ["AI endpoint недоступен, выполнена локальная проверка качества данных."],
  };
}

export function buildModerationReason(issues: AiModerationIssue[] = []) {
  const actionableIssues = issues.filter((issue) => issue.severity !== "info");

  if (actionableIssues.length === 0) {
    return "Объявление выглядит заполненным. Финальное решение остаётся за модератором.";
  }

  return [
    "Объявление пока не прошло модерацию. Пожалуйста, исправьте следующие пункты:",
    ...actionableIssues.map((issue, index) => `${index + 1}. ${issue.message}`),
    "",
    "После исправления отправьте объявление на модерацию повторно.",
  ].join("\n");
}
