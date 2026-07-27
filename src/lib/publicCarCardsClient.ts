import { Activity, ArrowUp, Badge, BadgeCheck, Calendar, CalendarCheck, CalendarDays, CalendarPlus, Car, CarFront, CircleDot, Coins, DoorOpen, Euro, Fuel, Gauge, Globe2, Heart, Mail, MapPin, Palette, Phone, RefreshCw, Route, ScanLine, Settings2, ShieldCheck, Sparkles, UserRound, Users, X, createIcons } from "lucide";
import { trackProductEvent } from "./analytics/events";
import { API_ROUTES, buildApiUrl } from "./apiRoutes";
import { getAuthToken, redirectToLogin } from "./authClient";
import { showToast } from "./toast";

function setFavoriteState(id: string, selected: boolean) {
  document.querySelectorAll<HTMLButtonElement>(`[data-car-favourite="${CSS.escape(id)}"]`).forEach((button) => {
    button.setAttribute("aria-pressed", String(selected));
    const label = selected ? "Удалить из сохранённых" : "Сохранить";
    button.setAttribute("aria-label", label);
    button.title = label;
    button.dataset.state = selected ? "saved" : "not-saved";
    button.disabled = false;
  });
}

let favoriteStatusRequest: Promise<void> | null = null;

function favoriteIds(root: ParentNode) {
  return [...new Set(
    Array.from(root.querySelectorAll<HTMLButtonElement>("[data-car-favourite]"))
      .map((button) => String(button.dataset.carFavourite || "").trim())
      .filter(Boolean),
  )].slice(0, 100);
}

export function refreshFavoriteStatuses(root: ParentNode = document) {
  const token = getAuthToken();
  const ids = favoriteIds(root);
  if (!token || ids.length === 0) return Promise.resolve();
  if (favoriteStatusRequest) return favoriteStatusRequest;

  favoriteStatusRequest = fetch(buildApiUrl(API_ROUTES.favoriteStatuses), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ listing_ids: ids.map(Number).filter(Number.isInteger) }),
  })
    .then(async (response) => {
      if (response.status === 401) return;
      if (!response.ok) throw new Error(`favorite status request failed ${response.status}`);
      const payload = await response.json() as { items?: Array<{ listing_id?: number | string; is_saved?: boolean }> };
      const statuses = new Map((payload.items || []).map((item) => [String(item.listing_id), item.is_saved === true]));
      ids.forEach((id) => setFavoriteState(id, statuses.get(id) === true));
    })
    .catch(() => undefined)
    .finally(() => {
      favoriteStatusRequest = null;
    });

  return favoriteStatusRequest;
}

export function refreshPublicCarCardIcons(_root: ParentNode = document) {
  createIcons({ icons: { Activity, ArrowUp, Badge, BadgeCheck, Calendar, CalendarCheck, CalendarDays, CalendarPlus, Car, CarFront, CircleDot, Coins, DoorOpen, Euro, Fuel, Gauge, Globe2, Heart, Mail, MapPin, Palette, Phone, RefreshCw, Route, ScanLine, Settings2, ShieldCheck, Sparkles, UserRound, Users, X }, attrs: { width: 18, height: 18, "stroke-width": 2 } });
  void refreshFavoriteStatuses(_root);
}

async function toggleFavorite(button: HTMLButtonElement) {
  const id = String(button.dataset.carFavourite || "");
  if (!id) return;
  const token = getAuthToken();
  if (!token) {
    redirectToLogin(window.location.pathname + window.location.search);
    return;
  }
  const wasSaved = button.getAttribute("aria-pressed") === "true";
  const nextSaved = !wasSaved;
  setFavoriteState(id, nextSaved);
  document.querySelectorAll<HTMLButtonElement>(`[data-car-favourite="${CSS.escape(id)}"]`).forEach((item) => { item.disabled = true; item.dataset.state = nextSaved ? "saving" : "removing"; });
  try {
    const response = await fetch(buildApiUrl(API_ROUTES.favorite(id)), {
      method: nextSaved ? "POST" : "DELETE",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    if (response.status === 401) {
      setFavoriteState(id, wasSaved);
      redirectToLogin(window.location.pathname + window.location.search);
      return;
    }
    const idempotentSuccess = (nextSaved && response.status === 409) || (!nextSaved && response.status === 404);
    if (!response.ok && !idempotentSuccess) throw new Error(`favorite request failed ${response.status}`);
    setFavoriteState(id, nextSaved);
    window.dispatchEvent(new CustomEvent("car-favorite-changed", { detail: { listingId: id, isSaved: nextSaved } }));
    showToast(nextSaved ? "Добавлено в избранное" : "Удалено из избранного");
    trackProductEvent("promotion_favourite", { listing_id: id, status: nextSaved ? "added" : "removed", source: button.dataset.favoriteSource || "public_car_card" });
  } catch {
    setFavoriteState(id, wasSaved);
    document.querySelectorAll<HTMLButtonElement>(`[data-car-favourite="${CSS.escape(id)}"]`).forEach((item) => { item.dataset.state = "error"; });
    showToast("Не удалось изменить избранное. Повторите попытку.", "error");
  }
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
      void toggleFavorite(favourite);
      return;
    }
    const link = target?.closest<HTMLAnchorElement>("[data-car-card-link]");
    if (link) trackProductEvent("promotion_card_open", { listing_id: link.closest<HTMLElement>("[data-car-id]")?.dataset.carId || "", source: link.dataset.cardSource || "public_car_card" });
  });
  refreshPublicCarCardIcons();
}
