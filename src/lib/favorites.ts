const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>'\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '\"': "&quot;" }[character] || character));

export function renderFavoriteButtonMarkup(listingId: number | string, initialSaved = false, source = "public_car_card", locale: Locale = DEFAULT_LOCALE) {
  const messages = getDetailMessages(locale);
  const label = initialSaved ? messages.removeSaved : messages.save;
  return `<button class="car-card-favourite" type="button" data-car-favourite="${escapeHtml(listingId)}" data-favorite-source="${escapeHtml(source)}" data-state="${initialSaved ? "saved" : "not-saved"}" aria-pressed="${initialSaved}" aria-label="${label}" title="${label}"><i data-lucide="heart" aria-hidden="true"></i></button>`;
}
import { DEFAULT_LOCALE, type Locale } from "../i18n/locales.ts";
import { getDetailMessages } from "../i18n/detailMessages.ts";
