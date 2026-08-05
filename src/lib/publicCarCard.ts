import { getCarCardImageUrl } from "./imageUrls.ts";
import { getHighestActivePromotion, parseApiDate } from "./promotions/model.ts";
import type { CarListing } from "./types.ts";
import { renderFavoriteButtonMarkup } from "./favorites.ts";
import { DEFAULT_LOCALE, LOCALE_TAGS, type Locale } from "../i18n/locales.ts";
import { getMessages, interpolate } from "../i18n/messages.ts";
import { translateBackendValue } from "../i18n/backendValues.ts";

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character] || character));

const formatDate = (value: unknown, locale: Locale) => {
  const messages = getMessages(locale);
  if (!value) return messages.dateMissing;
  const date = parseApiDate(value);
  return date ? new Intl.DateTimeFormat(LOCALE_TAGS[locale], { day: "numeric", month: "short" }).format(date) : messages.dateMissing;
};

const formatPrice = (car: CarListing, locale: Locale) => {
  try {
    return new Intl.NumberFormat(LOCALE_TAGS[locale], { style: "currency", currency: car.currency || "EUR", maximumFractionDigits: 0 }).format(Number(car.price || 0));
  } catch {
    return `${Number(car.price || 0).toLocaleString(LOCALE_TAGS[locale])} ${escapeHtml(car.currency || "EUR")}`;
  }
};

const safeSlugPath = (slug: unknown, locale: Locale) => {
  const value = String(slug || "").trim();
  return value ? `/cars/${encodeURIComponent(value)}/?lang=${encodeURIComponent(locale)}` : "";
};

export function renderPublicCarCardMarkup(car: CarListing, options: { priority?: boolean; source?: string; locale?: Locale } = {}) {
  const locale = options.locale || DEFAULT_LOCALE;
  const messages = getMessages(locale);
  const detailPath = safeSlugPath(car.slug, locale);
  const image = getCarCardImageUrl(car);
  const promotion = getHighestActivePromotion(car);
  const isSold = car.status === "sold" || car.moderation_status === "sold" || Boolean(car.sold_at);
  const title = String(car.title || [car.brand, car.model].filter(Boolean).join(" ") || messages.carDefault);
  const loading = options.priority ? "eager" : "lazy";
  const priority = options.priority ? ' fetchpriority="high"' : "";
  const cardClass = ["car-card", "public-car-card", promotion?.cardClass, isSold && "car-card-sold"].filter(Boolean).join(" ");
  const promotionLabel = promotion?.slug === "boost_7_days"
    ? messages.promotionBoosted
    : promotion?.slug === "featured_14_days"
      ? messages.promotionFeatured
      : messages.promotionPremium;
  const promotionBadge = promotion
    ? `<span class="promotion-badge promotion-badge-${escapeHtml(promotion.slug)}" aria-label="${promotion.slug === "homepage_premium_7_days" ? "Premium, " : ""}${escapeHtml(promotionLabel)}"><i data-lucide="${promotion.slug === "boost_7_days" ? "arrow-up" : promotion.slug === "featured_14_days" ? "badge-check" : "sparkles"}" aria-hidden="true"></i>${escapeHtml(promotionLabel)}</span><span class="promotion-disclosure">${escapeHtml(messages.promoted)}</span>`
    : "";
  const media = image
    ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" class="car-image" loading="${loading}" decoding="async" width="800" height="500" referrerpolicy="no-referrer"${priority}>`
    : `<div class="car-image car-image-empty" aria-label="${escapeHtml(messages.photoMissing)}">${escapeHtml(messages.photoMissing)}</div>`;

  const source = escapeHtml(options.source || "public_car_card");
  const saved = Boolean(car.is_saved);
  const dateValue = options.source === "dashboard_favorites" && car.saved_at ? car.saved_at : car.published_at || car.created_at;
  const formattedDate = formatDate(dateValue, locale);
  const dateLabel = options.source === "dashboard_favorites" ? interpolate(messages.savedOn, { value: formattedDate }) : formattedDate;
  return `<article class="${cardClass}" data-car-id="${escapeHtml(car.id)}" data-favorite-card>
    ${detailPath ? `<a class="car-card-link" href="${escapeHtml(detailPath)}" aria-label="${escapeHtml(interpolate(messages.openListing, { value: title }))}" data-car-card-link data-card-source="${source}">` : '<span class="car-card-link car-card-link-disabled" aria-disabled="true">'}
    <div class="car-card-media">${media}
      <div class="car-card-overlay-badges">${promotionBadge}${isSold ? `<span class="sold-ribbon">${escapeHtml(messages.sold)}</span>` : ""}</div>
    </div>
    <div class="car-card-body">
      <h3>${escapeHtml(title)}</h3>
      <p class="car-price">${formatPrice(car, locale)}</p>
      <dl class="car-card-specs">
        <div><dt><i data-lucide="calendar" aria-hidden="true"></i>${escapeHtml(messages.specYear)}</dt><dd>${escapeHtml(car.year || "—")}</dd></div>
        <div><dt><i data-lucide="gauge" aria-hidden="true"></i>${escapeHtml(messages.specMileage)}</dt><dd>${Number(car.mileage || 0) ? `${Number(car.mileage).toLocaleString(LOCALE_TAGS[locale])} ${escapeHtml(messages.kilometre)}` : "—"}</dd></div>
        <div><dt><i data-lucide="fuel" aria-hidden="true"></i>${escapeHtml(messages.specFuel)}</dt><dd>${escapeHtml(car.fuel_type ? translateBackendValue("fuel_type", car.fuel_type, locale) : "—")}</dd></div>
        <div><dt><i data-lucide="settings-2" aria-hidden="true"></i>${escapeHtml(messages.specTransmission)}</dt><dd>${escapeHtml(car.transmission ? translateBackendValue("transmission", car.transmission, locale) : "—")}</dd></div>
      </dl>
      <div class="car-card-footer"><span><i data-lucide="map-pin" aria-hidden="true"></i>${escapeHtml(car.city || messages.cityMissing)}</span><time>${escapeHtml(dateLabel)}</time></div>
    </div>
    ${detailPath ? "</a>" : "</span>"}
    ${renderFavoriteButtonMarkup(car.id, saved, options.source || "public_car_card", locale)}
  </article>`;
}
