import { getCarCardImageUrl } from "./imageUrls.ts";
import { getHighestActivePromotion, parseApiDate } from "./promotions/model.ts";
import type { CarListing } from "./types.ts";
import { renderFavoriteButtonMarkup } from "./favorites.ts";
import {
  formatPublicViewCount,
  normalizePublicViewCount,
} from "./listingViews.ts";

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character] || character));

const formatDate = (value: unknown) => {
  if (!value) return "Дата не указана";
  const date = parseApiDate(value);
  return date ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(date) : "Дата не указана";
};

const formatDateTime = (value: unknown) => parseApiDate(value)?.toISOString().slice(0, 10) || "";

const formatPrice = (car: CarListing) => {
  try {
    return new Intl.NumberFormat("ru-RU", { style: "currency", currency: car.currency || "EUR", maximumFractionDigits: 0 }).format(Number(car.price || 0));
  } catch {
    return `${Number(car.price || 0).toLocaleString("ru-RU")} ${escapeHtml(car.currency || "EUR")}`;
  }
};

const safeSlugPath = (slug: unknown) => {
  const value = String(slug || "").trim();
  return value ? `/cars/${encodeURIComponent(value)}/` : "";
};

export function renderPublicCarCardMarkup(car: CarListing, options: { priority?: boolean; source?: string } = {}) {
  const detailPath = safeSlugPath(car.slug);
  const image = getCarCardImageUrl(car);
  const promotion = getHighestActivePromotion(car);
  const isSold = car.status === "sold" || car.moderation_status === "sold" || Boolean(car.sold_at);
  const title = String(car.title || [car.brand, car.model].filter(Boolean).join(" ") || "Автомобиль");
  const loading = options.priority ? "eager" : "lazy";
  const priority = options.priority ? ' fetchpriority="high"' : "";
  const cardClass = ["car-card", "public-car-card", promotion?.cardClass, isSold && "car-card-sold"].filter(Boolean).join(" ");
  const promotionBadge = promotion
    ? `<span class="promotion-badge promotion-badge-${escapeHtml(promotion.slug)}" aria-label="${promotion.slug === "homepage_premium_7_days" ? "Premium, " : ""}${escapeHtml(promotion.shortName)}"><i data-lucide="${promotion.slug === "boost_7_days" ? "arrow-up" : promotion.slug === "featured_14_days" ? "badge-check" : "sparkles"}" aria-hidden="true"></i>${escapeHtml(promotion.shortName)}</span><span class="promotion-disclosure">Продвигается</span>`
    : "";
  const media = image
    ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" class="car-image" loading="${loading}" decoding="async" width="800" height="500" referrerpolicy="no-referrer"${priority}>`
    : `<div class="car-image car-image-empty" aria-label="Фотография отсутствует">Фото пока не добавлено</div>`;

  const source = escapeHtml(options.source || "public_car_card");
  const publicViewsTotal = normalizePublicViewCount(car.views_total);
  const publicViewLabel = formatPublicViewCount(publicViewsTotal);
  const publicViews = `<span class="car-card-views" aria-label="${escapeHtml(publicViewLabel)}" title="${escapeHtml(publicViewLabel)}"><i data-lucide="eye" aria-hidden="true"></i><span>${escapeHtml(publicViewsTotal.toLocaleString("ru-RU"))}</span></span>`;
  const city = String(car.city || "").trim();
  const cityBadge = city
    ? `<span class="car-card-location"><i data-lucide="map-pin" aria-hidden="true"></i><span>${escapeHtml(city)}</span></span>`
    : "";
  const statusBadge = `<span class="listing-status-badge ${isSold ? "is-sold" : "is-active"}">${isSold ? "Продано" : "В продаже"}</span>`;
  const saved = Boolean(car.is_saved);
  const dateValue = options.source === "dashboard_favorites" && car.saved_at ? car.saved_at : car.published_at || car.created_at;
  const dateLabel = options.source === "dashboard_favorites" ? `Сохранено ${formatDate(dateValue)}` : formatDate(dateValue);
  const dateTime = formatDateTime(dateValue);
  return `<article class="${cardClass}" data-car-id="${escapeHtml(car.id)}" data-favorite-card>
    ${detailPath ? `<a class="car-card-link" href="${escapeHtml(detailPath)}" aria-label="Открыть объявление ${escapeHtml(title)}" data-car-card-link data-card-source="${source}">` : '<span class="car-card-link car-card-link-disabled" aria-disabled="true">'}
    <div class="car-card-media">${media}
      ${cityBadge}
      <div class="car-card-overlay-badges">${promotionBadge}${isSold ? '<span class="sold-ribbon">Продано</span>' : ""}</div>
      <span class="car-card-media-views">${publicViews}</span>
    </div>
    <div class="car-card-body">
      <h3 class="car-card-title">${escapeHtml(title)}</h3>
      <div class="car-card-price-row"><strong class="car-price">${formatPrice(car)}</strong>${statusBadge}</div>
      <dl class="car-card-specs">
        <div><dt class="sr-only">Год</dt><dd aria-label="Год: ${escapeHtml(car.year || "не указан")}"><i data-lucide="calendar" aria-hidden="true"></i><span>${escapeHtml(car.year || "—")}</span></dd></div>
        <div><dt class="sr-only">Пробег</dt><dd aria-label="Пробег: ${Number(car.mileage || 0) ? `${Number(car.mileage).toLocaleString("ru-RU")} км` : "не указан"}"><i data-lucide="gauge" aria-hidden="true"></i><span>${Number(car.mileage || 0) ? `${Number(car.mileage).toLocaleString("ru-RU")} км` : "—"}</span></dd></div>
        <div><dt class="sr-only">Топливо</dt><dd aria-label="Топливо: ${escapeHtml(car.fuel_type || "не указано")}"><i data-lucide="fuel" aria-hidden="true"></i><span>${escapeHtml(car.fuel_type || "—")}</span></dd></div>
        <div><dt class="sr-only">Коробка передач</dt><dd aria-label="Коробка передач: ${escapeHtml(car.transmission || "не указана")}"><i data-lucide="settings-2" aria-hidden="true"></i><span>${escapeHtml(car.transmission || "—")}</span></dd></div>
      </dl>
      <div class="car-card-footer"><time${dateTime ? ` datetime="${escapeHtml(dateTime)}"` : ""}>${escapeHtml(dateLabel)}</time></div>
    </div>
    ${detailPath ? "</a>" : "</span>"}
    ${renderFavoriteButtonMarkup(car.id, saved, options.source || "public_car_card")}
  </article>`;
}
