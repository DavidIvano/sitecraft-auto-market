import { Heart, Maximize2, Sparkles, createIcons } from "lucide";
import { trackProductEvent } from "./analytics/events";

const FAVOURITES_KEY = "sitecraft-public-car-favourites";

function readFavourites() {
  try {
    const value = JSON.parse(localStorage.getItem(FAVOURITES_KEY) || "[]");
    return new Set(Array.isArray(value) ? value.map(String) : []);
  } catch {
    return new Set<string>();
  }
}

function syncFavourites(root: ParentNode) {
  const favourites = readFavourites();
  root.querySelectorAll<HTMLButtonElement>("[data-car-favourite]").forEach((button) => {
    const selected = favourites.has(String(button.dataset.carFavourite));
    button.setAttribute("aria-pressed", String(selected));
    button.setAttribute("aria-label", selected ? "Убрать из избранного" : "Добавить в избранное");
  });
}

export function refreshPublicCarCardIcons(root: ParentNode = document) {
  createIcons({ icons: { Heart, Maximize2, Sparkles }, attrs: { width: 18, height: 18, "stroke-width": 2 } });
  syncFavourites(root);
}

export function installPublicCarCardInteractions() {
  const documentRoot = document.documentElement;
  if (documentRoot.dataset.publicCarCardsInstalled === "true") {
    refreshPublicCarCardIcons();
    return;
  }
  documentRoot.dataset.publicCarCardsInstalled = "true";
  document.addEventListener("click", (event) => {
    const target = event.target as Element | null;
    const favourite = target?.closest<HTMLButtonElement>("[data-car-favourite]");
    if (favourite) {
      event.preventDefault();
      event.stopPropagation();
      const id = String(favourite.dataset.carFavourite || "");
      const favourites = readFavourites();
      favourites.has(id) ? favourites.delete(id) : favourites.add(id);
      localStorage.setItem(FAVOURITES_KEY, JSON.stringify([...favourites]));
      syncFavourites(document);
      trackProductEvent("promotion_favourite", {
        listing_id: id,
        status: favourites.has(id) ? "added" : "removed",
        source: "public_car_card",
      });
      return;
    }
    const card = target?.closest<HTMLElement>("[data-car-card-href]");
    if (!card || target?.closest("a,button,input,select,textarea,[role='button']")) return;
    trackProductEvent("promotion_card_open", { listing_id: card.dataset.carId || "", source: "public_car_card" });
    window.location.assign(String(card.dataset.carCardHref));
  });
  document.addEventListener("keydown", (event) => {
    const card = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-car-card-href]") : null;
    if (!card || event.target !== card || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    trackProductEvent("promotion_card_open", { listing_id: card.dataset.carId || "", source: "public_car_card" });
    window.location.assign(String(card.dataset.carCardHref));
  });
  refreshPublicCarCardIcons();
}
