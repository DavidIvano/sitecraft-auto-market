import { getCarCardImageUrl, getCarDetailImageUrls } from "./imageUrls.ts";
import { getHighestActivePromotion, parseApiDate } from "./promotions/model.ts";
import type { CarListing } from "./types.ts";

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character] || character));

const formatDate = (value: unknown) => {
  if (!value) return "Дата не указана";
  const date = parseApiDate(value);
  return date ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(date) : "Дата не указана";
};

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

export function renderPublicCarCardMarkup(car: CarListing, options: { priority?: boolean } = {}) {
  const detailPath = safeSlugPath(car.slug);
  const image = getCarCardImageUrl(car);
  const images = getCarDetailImageUrls(car);
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
    ? `<button class="vehicle-image-trigger car-card-image-button" type="button" data-lightbox-trigger data-lightbox-src="${escapeHtml(image)}" data-lightbox-sources="${escapeHtml(JSON.stringify(images.length ? images : [image]))}" data-lightbox-alt="${escapeHtml(title)}" aria-label="Открыть фотографии автомобиля"><img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" class="car-image" loading="${loading}" decoding="async" width="800" height="500" referrerpolicy="no-referrer"${priority}><span class="vehicle-image-zoom" aria-hidden="true"><i data-lucide="maximize-2"></i></span></button>`
    : `<div class="car-image car-image-empty" aria-label="Фотография отсутствует">Фото пока не добавлено</div>`;

  return `<article class="${cardClass}" data-car-id="${escapeHtml(car.id)}" ${detailPath ? `data-car-card-href="${escapeHtml(detailPath)}" role="link" tabindex="0" aria-label="Открыть объявление ${escapeHtml(title)}"` : 'aria-disabled="true"'}>
    <div class="car-card-media">${media}
      <div class="car-card-overlay-badges">${promotionBadge}${isSold ? '<span class="sold-ribbon">Продано</span>' : ""}</div>
      <button class="car-card-favourite" type="button" data-car-favourite="${escapeHtml(car.id)}" aria-pressed="false" aria-label="Добавить в избранное"><i data-lucide="heart" aria-hidden="true"></i></button>
    </div>
    <div class="car-card-body">
      <h3>${escapeHtml(title)}</h3>
      <p class="car-price">${formatPrice(car)}</p>
      <dl class="car-card-specs">
        <div><dt>Год</dt><dd>${escapeHtml(car.year || "—")}</dd></div>
        <div><dt>Пробег</dt><dd>${Number(car.mileage || 0) ? `${Number(car.mileage).toLocaleString("ru-RU")} км` : "—"}</dd></div>
        <div><dt>Топливо</dt><dd>${escapeHtml(car.fuel_type || "—")}</dd></div>
        <div><dt>Коробка</dt><dd>${escapeHtml(car.transmission || "—")}</dd></div>
      </dl>
      <div class="car-card-footer"><span>${escapeHtml(car.city || "Город не указан")}</span><time>${escapeHtml(formatDate(car.published_at || car.created_at))}</time></div>
    </div>
  </article>`;
}
