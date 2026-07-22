import { renderDealFinderAnalysis } from "./analysis-view.ts";
import { DEAL_FINDER_PLACEHOLDER } from "./constants.ts";
import {
  formatDealFinderDate,
  formatDealFinderPrice,
  getSafeDealFinderSourceUrl,
  isSafeDealFinderImageUrl,
} from "./formatters.ts";
import { isComparisonSelected } from "./comparison.ts";
import { decodeDealFinderText } from "./text.ts";
import type { DealFinderAnalysis, DealFinderListing, DealFinderListingDetails } from "./types.ts";

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
}[character] || character));
const displayText = (value: string | null | undefined) => escapeHtml(decodeDealFinderText(value));
const icon = (name: string) => `<i data-lucide="${name}" aria-hidden="true"></i>`;

function uniqueImages(listing: DealFinderListing) {
  const safe = [listing.source_image_url, ...(listing.source_images || [])].filter(isSafeDealFinderImageUrl) as string[];
  return [...new Set(safe)].length ? [...new Set(safe)] : [DEAL_FINDER_PLACEHOLDER];
}

function galleryMarkup(listing: DealFinderListing) {
  const images = uniqueImages(listing);
  const sources = escapeHtml(JSON.stringify(images));
  const title = displayText(listing.title);
  return `<section class="deal-detail-gallery" data-detail-gallery data-gallery-index="0" aria-label="Фотографии автомобиля">
    <div class="deal-detail-gallery-stage">
      <button class="deal-detail-gallery-main vehicle-image-trigger" type="button" data-lightbox-trigger data-lightbox-src="${escapeHtml(images[0])}" data-lightbox-sources="${sources}" data-lightbox-alt="${title}" aria-label="Открыть фотографию на весь экран">
        <img src="${escapeHtml(images[0])}" alt="${title}" loading="eager" fetchpriority="high" decoding="async" referrerpolicy="no-referrer" data-gallery-main-image data-deal-finder-image data-placeholder="${DEAL_FINDER_PLACEHOLDER}">
        <span class="deal-detail-gallery-expand" aria-hidden="true">${icon("maximize-2")}</span>
      </button>
      <button class="deal-detail-gallery-nav is-previous" type="button" data-gallery-previous aria-label="Предыдущая фотография" ${images.length < 2 ? "hidden" : ""}>${icon("chevron-left")}</button>
      <button class="deal-detail-gallery-nav is-next" type="button" data-gallery-next aria-label="Следующая фотография" ${images.length < 2 ? "hidden" : ""}>${icon("chevron-right")}</button>
      <output class="deal-detail-gallery-counter" data-gallery-counter aria-live="polite">1 / ${images.length}</output>
    </div>
    <div class="deal-detail-gallery-thumbnails" data-gallery-thumbnails ${images.length < 2 ? "hidden" : ""}>
      ${images.map((image, index) => `<button class="deal-detail-gallery-thumbnail" type="button" data-gallery-thumbnail="${index}" data-lightbox-trigger data-lightbox-src="${escapeHtml(image)}" data-lightbox-sources="${sources}" data-lightbox-alt="${title}, фото ${index + 1}" aria-label="Открыть фото ${index + 1} из ${images.length}" aria-pressed="${index === 0}"><img src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-deal-finder-image data-placeholder="${DEAL_FINDER_PLACEHOLDER}"></button>`).join("")}
    </div>
    <script type="application/json" data-gallery-sources>${JSON.stringify(images).replace(/</g, "\\u003c")}</script>
  </section>`;
}

function identityMarkup(listing: DealFinderListing, analysis: DealFinderAnalysis | null) {
  const summary = [
    listing.year,
    listing.mileage ? `${Number(listing.mileage).toLocaleString("ru-RU")} км` : null,
    listing.fuel_type,
    listing.transmission,
  ].filter(Boolean).map(escapeHtml).join(" · ");
  const sourceActive = listing.source_status === "active";
  return `<header class="deal-detail-identity">
    <div class="deal-detail-identity-main">
      <span class="eyebrow">${displayText([listing.brand, listing.model, listing.variant].filter(Boolean).join(" · ") || "ВНЕШНЕЕ ПРЕДЛОЖЕНИЕ")}</span>
      <h1>${displayText(listing.title)}</h1>
      <strong class="deal-detail-price">${escapeHtml(formatDealFinderPrice(listing.price, listing.currency))}</strong>
      ${summary ? `<p>${summary}</p>` : ""}
      <p>${displayText(listing.city || "Местоположение не указано")}</p>
    </div>
    <div class="deal-detail-statuses" aria-label="Статусы предложения">
      ${analysis?.analysis_version === "deal-finder-v1" ? '<span class="deal-ai-version-badge">AI v1 · Beta</span>' : ""}
      <span class="deal-status-badge">${escapeHtml(analysis?.recommendation || "AI не запущен")}</span>
      <span class="deal-source-badge" data-source-active="${sourceActive}">${sourceActive ? "Источник активен" : "Источник недоступен"}</span>
    </div>
  </header>`;
}

const fact = (label: string, value: unknown) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "—")}</dd></div>`;

function factsMarkup(listing: DealFinderListing) {
  return `<section class="deal-detail-facts" aria-labelledby="deal-detail-facts-title">
    <h2 id="deal-detail-facts-title">Характеристики</h2>
    <div class="deal-detail-fact-group"><h3>Основные</h3><dl>
      ${fact("Год", listing.year)}${fact("Пробег", listing.mileage ? `${Number(listing.mileage).toLocaleString("ru-RU")} км` : null)}
      ${fact("Топливо", listing.fuel_type)}${fact("Коробка", listing.transmission)}
      ${fact("Мощность", listing.power_kw ? `${listing.power_kw} кВт${listing.power_hp ? ` · ${listing.power_hp} л.с.` : ""}` : listing.power_hp ? `${listing.power_hp} л.с.` : null)}
    </dl></div>
    <div class="deal-detail-fact-group"><h3>Местоположение и источник</h3><dl>
      ${fact("Город", listing.city)}${fact("Индекс", listing.postal_code)}
      ${fact("Обнаружено", formatDealFinderDate(listing.first_seen_at))}${fact("Опубликовано", formatDealFinderDate(listing.published_at))}
      ${fact("Проверено", formatDealFinderDate(listing.last_checked_at || listing.last_seen_at))}${fact("Статус", listing.source_status === "active" ? "Активен" : "Недоступен")}
    </dl></div>
  </section>`;
}

function compactAiMarkup(analysis: DealFinderAnalysis | null) {
  const value = (input?: number | null, percent = false) => typeof input === "number"
    ? percent ? `${Math.round(input * 100)}%` : String(Math.round(input))
    : "—";
  return `<section class="deal-detail-ai-summary" aria-labelledby="deal-detail-ai-summary-title">
    <div><span class="eyebrow">AI v1 · Beta</span><h2 id="deal-detail-ai-summary-title">Краткая оценка</h2></div>
    <strong>${escapeHtml(analysis?.recommendation || "Не анализировалось")}</strong>
    <dl>${fact("Deal", value(analysis?.deal_score))}${fact("Risk", value(analysis?.risk_score))}${fact("Confidence", value(analysis?.confidence_score, true))}</dl>
  </section>`;
}

function translationMarkup(listing: DealFinderListing) {
  const description = displayText(listing.description || "Описание не предоставлено источником.");
  const disabled = !listing.description?.trim();
  return `<section class="deal-detail-description deal-detail-content-card" aria-labelledby="deal-detail-description-title">
    <header><div><span class="eyebrow">ТЕКСТ ИСТОЧНИКА</span><h2 id="deal-detail-description-title">Описание</h2></div>
      <button class="deal-translation-button" type="button" data-translation-request ${disabled ? "disabled" : ""}>${icon("languages")}<span>${disabled ? "Нет текста для перевода" : "Перевести на русский"}</span></button>
    </header>
    <div class="deal-translation-toggle" role="group" aria-label="Язык описания" hidden data-translation-toggle>
      <button type="button" data-translation-view="original" aria-pressed="true">Оригинал</button>
      <button type="button" data-translation-view="translated" aria-pressed="false">Русский перевод</button>
    </div>
    <div class="deal-detail-description-text" lang="de" data-translation-original>${description}</div>
    <div class="deal-detail-description-text" lang="ru" data-translation-result hidden></div>
    <p class="deal-translation-status" role="status" aria-live="polite" data-translation-status></p>
  </section>`;
}

function actionButton(options: { action?: string; icon: string; label: string; pressed?: boolean; className: string; disabled?: boolean }) {
  return `<button class="deal-action ${options.className}" type="button" ${options.action ? `data-deal-action="${options.action}"` : ""} ${options.pressed === undefined ? "" : `aria-pressed="${options.pressed}"`} ${options.disabled ? "disabled" : ""}>${icon(options.icon)}<span>${escapeHtml(options.label)}</span></button>`;
}

function actionBarMarkup(listing: DealFinderListing) {
  const sourceUrl = getSafeDealFinderSourceUrl(listing.source_url);
  const compared = typeof window !== "undefined" && isComparisonSelected(window.localStorage, listing.id);
  return `<section class="deal-detail-action-bar" aria-label="Действия с предложением" data-detail-action-bar>
    <div class="deal-detail-action-primary">
      ${actionButton({ action: listing.is_saved ? "unsave" : "save", icon: "bookmark", label: listing.is_saved ? "Сохранено" : "Сохранить", pressed: listing.is_saved, className: "is-save" })}
      ${sourceUrl ? `<a class="deal-action is-source" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer nofollow">${icon("external-link")}<span>Оригинал</span></a>` : `<span class="deal-action is-source is-disabled" aria-disabled="true">${icon("external-link")}<span>Оригинал недоступен</span></span>`}
    </div>
    <div class="deal-detail-action-secondary">
      <button class="deal-action is-compare" type="button" data-deal-compare="${listing.id}" aria-pressed="${compared}">${icon("columns-2")}<span>${compared ? "В сравнении" : "Сравнить"}</span></button>
      <button class="deal-action is-more" type="button" data-action-more aria-expanded="false" aria-controls="deal-detail-more-${listing.id}">${icon("ellipsis")}<span>Ещё</span></button>
      <div class="deal-detail-action-overflow" id="deal-detail-more-${listing.id}" data-action-overflow>
        ${actionButton({ action: "view", icon: listing.is_viewed ? "eye-check" : "eye", label: listing.is_viewed ? "Просмотрено" : "Отметить просмотренным", pressed: listing.is_viewed, className: "is-viewed", disabled: listing.is_viewed })}
        ${actionButton({ action: listing.is_hidden ? "restore" : "hide", icon: listing.is_hidden ? "rotate-ccw" : "eye-off", label: listing.is_hidden ? "Восстановить" : "Скрыть", pressed: listing.is_hidden, className: listing.is_hidden ? "is-restore" : "is-hide" })}
      </div>
    </div>
    <p class="deal-finder-action-status" role="status" aria-live="polite"></p>
  </section>`;
}

export function renderDealFinderDetailView(options: {
  details: DealFinderListingDetails;
  workspaceHtml: string;
  returnHref: string;
}) {
  const { listing, analysis, allowed_actions } = options.details;
  const sourceRemoved = listing.source_status !== "active";
  return `<article class="deal-detail" data-deal-listing-id="${listing.id}">
    <a class="deal-detail-back" href="${escapeHtml(options.returnHref)}">${icon("arrow-left")}<span>Вернуться к Deal Finder</span></a>
    ${galleryMarkup(listing)}
    ${identityMarkup(listing, analysis)}
    ${sourceRemoved ? `<div class="deal-detail-warning" role="status">${icon("circle-alert")}<span>Оригинальное объявление может быть снято. Сверяйте доступность и данные у источника.</span></div>` : ""}
    <div class="deal-detail-layout">
      <main class="deal-detail-main">
        ${translationMarkup(listing)}
        <section class="deal-detail-analysis" aria-label="AI-анализ">${renderDealFinderAnalysis(analysis, allowed_actions.reanalyze)}</section>
        <section class="deal-detail-workspace deal-detail-content-card">${options.workspaceHtml}</section>
        <p class="deal-finder-notice">Источник: Kleinanzeigen. Это закрытый внутренний аналитический инструмент. Проверяйте данные и актуальность в оригинальном объявлении.</p>
      </main>
      <aside class="deal-detail-sidebar">
        <div class="deal-detail-sidebar-panel">
          <strong class="deal-detail-sidebar-price">${escapeHtml(formatDealFinderPrice(listing.price, listing.currency))}</strong>
          ${factsMarkup(listing)}
          ${compactAiMarkup(analysis)}
          ${actionBarMarkup(listing)}
        </div>
      </aside>
    </div>
  </article>`;
}

export function getDealFinderGalleryImages(listing: DealFinderListing) {
  return uniqueImages(listing);
}
