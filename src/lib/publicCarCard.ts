import { getCarCardImageUrl } from "./imageUrls.ts";
import { getHighestActivePromotion, parseApiDate } from "./promotions/model.ts";
import type { CarListing } from "./types.ts";
import { renderFavoriteButtonMarkup } from "./favorites.ts";
import {
  normalizePublicViewCount,
} from "./listingViews.ts";
import { DEFAULT_LOCALE, LOCALE_TAGS, type Locale } from "../i18n/locales.ts";
import { getMessages, interpolate } from "../i18n/messages.ts";
import { getDetailMessages } from "../i18n/detailMessages.ts";
import { translateBackendValue } from "../i18n/backendValues.ts";

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character] || character));

const formatDate = (value: unknown, locale: Locale) => {
  const messages = getMessages(locale);
  if (!value) return messages.dateMissing;
  const date = parseApiDate(value);
  return date ? new Intl.DateTimeFormat(LOCALE_TAGS[locale], { day: "numeric", month: "short" }).format(date) : messages.dateMissing;
};

const formatDateTime = (value: unknown) => parseApiDate(value)?.toISOString().slice(0, 10) || "";

const formatPrice = (car: CarListing, locale: Locale) => {
  try {
    return new Intl.NumberFormat(LOCALE_TAGS[locale], { style: "currency", currency: car.currency || "EUR", maximumFractionDigits: 0 }).format(Number(car.price || 0));
  } catch {
    return `${Number(car.price || 0).toLocaleString(LOCALE_TAGS[locale])} ${escapeHtml(car.currency || "EUR")}`;
  }
};

const safeSlugPath = (slug: unknown, locale: Locale, localizedRoute: boolean) => {
  const value = String(slug || "").trim();
  if (!value) return "";
  return localizedRoute
    ? `/${encodeURIComponent(locale)}/cars/${encodeURIComponent(value)}/`
    : `/cars/${encodeURIComponent(value)}/?lang=${encodeURIComponent(locale)}`;
};

export function renderPublicCarCardMarkup(car: CarListing, options: { priority?: boolean; source?: string; locale?: Locale } = {}) {
  const locale = options.locale || DEFAULT_LOCALE;
  const messages = getMessages(locale);
  const detailMessages = getDetailMessages(locale);
  const detailPath = safeSlugPath(car.slug, locale, String(options.source || "").startsWith("localized_"));
  const image = getCarCardImageUrl(car);
  const promotion = getHighestActivePromotion(car);
  const isHomepagePremium = promotion?.slug === "homepage_premium_7_days";
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
    ? `${isHomepagePremium ? "" : `<span class="promotion-badge promotion-badge-${escapeHtml(promotion.slug)}"><i data-lucide="${promotion.slug === "boost_7_days" ? "arrow-up" : "badge-check"}" aria-hidden="true"></i>${escapeHtml(promotionLabel)}</span>`}<span class="promotion-disclosure">${escapeHtml(messages.promoted)}</span>`
    : "";
  const premiumDecoration = isHomepagePremium
    ? `<div class="car-card-premium-banner" aria-label="${escapeHtml(promotionLabel)}"><i data-lucide="crown" aria-hidden="true"></i><span>${escapeHtml(promotionLabel)}</span></div><span class="car-card-premium-marker" aria-hidden="true"><i data-lucide="gem"></i></span>`
    : "";
  const media = image
    ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" class="car-image" loading="${loading}" decoding="async" width="800" height="500" referrerpolicy="no-referrer"${priority}>`
    : `<div class="car-image car-image-empty" aria-label="${escapeHtml(messages.photoMissing)}">${escapeHtml(messages.photoMissing)}</div>`;

  const source = escapeHtml(options.source || "public_car_card");
  const publicViewsTotal = normalizePublicViewCount(car.views_total);
  const publicViewLabel = interpolate(detailMessages.viewsCount, { count: publicViewsTotal.toLocaleString(LOCALE_TAGS[locale]) });
  const publicViews = `<span class="car-card-views" aria-label="${escapeHtml(publicViewLabel)}" title="${escapeHtml(publicViewLabel)}"><i data-lucide="eye" aria-hidden="true"></i><span>${escapeHtml(publicViewsTotal.toLocaleString(LOCALE_TAGS[locale]))}</span></span>`;
  const city = String(car.city || "").trim();
  const cityBadge = city
    ? `<span class="car-card-location"><i data-lucide="map-pin" aria-hidden="true"></i><span>${escapeHtml(city)}</span></span>`
    : "";
  const statusBadge = `<span class="listing-status-badge ${isSold ? "is-sold" : "is-active"}">${escapeHtml(isSold ? messages.sold : detailMessages.forSale)}</span>`;
  const saved = Boolean(car.is_saved);
  const dateValue = options.source === "dashboard_favorites" && car.saved_at ? car.saved_at : car.published_at || car.created_at;
  const formattedDate = formatDate(dateValue, locale);
  const dateLabel = options.source === "dashboard_favorites" ? interpolate(messages.savedOn, { value: formattedDate }) : formattedDate;
  const dateTime = formatDateTime(dateValue);
  return `<article class="${cardClass}" data-car-id="${escapeHtml(car.id)}" data-favorite-card>
    ${premiumDecoration}
    ${detailPath ? `<a class="car-card-link" href="${escapeHtml(detailPath)}" aria-label="${escapeHtml(interpolate(messages.openListing, { value: title }))}" data-car-card-link data-card-source="${source}">` : '<span class="car-card-link car-card-link-disabled" aria-disabled="true">'}
    <div class="car-card-media">${media}
      <div class="car-card-overlay-badges">${promotionBadge}${isSold ? `<span class="sold-ribbon">${escapeHtml(messages.sold)}</span>` : ""}</div>
      <span class="car-card-media-views">${publicViews}</span>
    </div>
    <div class="car-card-body">
      <h3 class="car-card-title">${escapeHtml(title)}</h3>
      <div class="car-card-price-row"><strong class="car-price">${formatPrice(car, locale)}</strong>${statusBadge}</div>
      <dl class="car-card-specs">
        <div><dt class="sr-only">${escapeHtml(messages.specYear)}</dt><dd aria-label="${escapeHtml(messages.specYear)}: ${escapeHtml(car.year || "—")}"><i data-lucide="calendar" aria-hidden="true"></i><span>${escapeHtml(car.year || "—")}</span></dd></div>
        <div><dt class="sr-only">${escapeHtml(messages.specMileage)}</dt><dd aria-label="${escapeHtml(messages.specMileage)}: ${Number(car.mileage || 0) ? `${Number(car.mileage).toLocaleString(LOCALE_TAGS[locale])} ${escapeHtml(messages.kilometre)}` : "—"}"><i data-lucide="gauge" aria-hidden="true"></i><span>${Number(car.mileage || 0) ? `${Number(car.mileage).toLocaleString(LOCALE_TAGS[locale])} ${escapeHtml(messages.kilometre)}` : "—"}</span></dd></div>
        <div><dt class="sr-only">${escapeHtml(messages.specFuel)}</dt><dd aria-label="${escapeHtml(messages.specFuel)}: ${escapeHtml(car.fuel_type ? translateBackendValue("fuel_type", car.fuel_type, locale) : "—")}"><i data-lucide="fuel" aria-hidden="true"></i><span>${escapeHtml(car.fuel_type ? translateBackendValue("fuel_type", car.fuel_type, locale) : "—")}</span></dd></div>
        <div><dt class="sr-only">${escapeHtml(messages.specTransmission)}</dt><dd aria-label="${escapeHtml(messages.specTransmission)}: ${escapeHtml(car.transmission ? translateBackendValue("transmission", car.transmission, locale) : "—")}"><i data-lucide="settings-2" aria-hidden="true"></i><span>${escapeHtml(car.transmission ? translateBackendValue("transmission", car.transmission, locale) : "—")}</span></dd></div>
      </dl>
      <div class="car-card-footer"><time${dateTime ? ` datetime="${escapeHtml(dateTime)}"` : ""}>${escapeHtml(dateLabel)}</time>${cityBadge}</div>
    </div>
    ${detailPath ? "</a>" : "</span>"}
    ${renderFavoriteButtonMarkup(car.id, saved, options.source || "public_car_card", locale)}
  </article>`;
}
