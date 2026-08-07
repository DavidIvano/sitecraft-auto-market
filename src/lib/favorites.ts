const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>'\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '\"': "&quot;" }[character] || character));

export function renderFavoriteButtonMarkup(listingId: number | string, initialSaved = false, source = "public_car_card") {
  const label = initialSaved ? "Удалить из избранного" : "Сохранить в избранное";
  return `<button class="car-card-favourite" type="button" data-car-favourite="${escapeHtml(listingId)}" data-favorite-source="${escapeHtml(source)}" data-state="${initialSaved ? "saved" : "not-saved"}" aria-pressed="${initialSaved}" aria-label="${label}" title="${label}"><i data-lucide="heart" aria-hidden="true"></i></button>`;
}
