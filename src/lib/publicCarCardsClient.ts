import { trackProductEvent } from "./analytics/events";
import { API_ROUTES, buildApiUrl } from "./apiRoutes";
import { refreshAppIcons } from "./appIcons";
import { getAuthToken, isSessionConfirmedExpired, redirectToLogin } from "./authClient";
import { fetchWithRetry } from "./http/fetchWithRetry";
import { showToast } from "./toast";

function setFavoriteState(id: string, selected: boolean) {
  document.querySelectorAll<HTMLButtonElement>(`[data-car-favourite="${CSS.escape(id)}"]`).forEach((button) => {
    button.setAttribute("aria-pressed", String(selected));
    const label = selected ? "Удалить из избранного" : "Сохранить в избранное";
    button.setAttribute("aria-label", label);
    button.title = label;
    button.dataset.state = selected ? "saved" : "not-saved";
    button.disabled = false;
  });
}

let favoriteStatusRequest: Promise<void> | null = null;
const pendingFavoriteRoots = new Set<ParentNode>();
const pendingFavoriteMutations = new Set<string>();

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function getInitializedAuthToken() {
  for (const delay of [0, 120, 300]) {
    if (delay) await wait(delay);
    const token = getAuthToken();
    if (token) return token;
  }
  return null;
}

function favoriteIds(root: ParentNode) {
  return [...new Set(
    Array.from(root.querySelectorAll<HTMLButtonElement>("[data-car-favourite]"))
      .map((button) => String(button.dataset.carFavourite || "").trim())
      .filter(Boolean),
  )].slice(0, 100);
}

export function refreshFavoriteStatuses(root: ParentNode = document): Promise<void> {
  pendingFavoriteRoots.add(root);
  if (favoriteStatusRequest) {
    return favoriteStatusRequest.then(async () => {
      if (pendingFavoriteRoots.size) await refreshFavoriteStatuses();
    });
  }

  const roots = Array.from(pendingFavoriteRoots);
  pendingFavoriteRoots.clear();
  favoriteStatusRequest = (async () => {
    const token = await getInitializedAuthToken();
    if (!token) return;
    const ids = [...new Set(roots.flatMap((currentRoot) => favoriteIds(currentRoot)))].slice(0, 100);
    if (ids.length === 0) return;

    const response = await fetchWithRetry(buildApiUrl(API_ROUTES.favoriteStatuses), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ listing_ids: ids.map(Number).filter(Number.isInteger) }),
    }, { attempts: 3, timeoutMs: 8_000, delaysMs: [300, 900] });
    if (response.status === 401 || !response.ok) return;
    const payload = await response.json() as { items?: Array<{ listing_id?: number | string; is_saved?: boolean }> };
    const statuses = new Map((payload.items || []).map((item) => [String(item.listing_id), item.is_saved === true]));
    ids.forEach((id) => setFavoriteState(id, statuses.get(id) === true));
  })()
    .catch(() => undefined)
    .finally(() => {
      favoriteStatusRequest = null;
    });

  return favoriteStatusRequest.then(async () => {
    if (pendingFavoriteRoots.size) await refreshFavoriteStatuses();
  });
}

export function refreshPublicCarCardIcons(_root: ParentNode = document) {
  refreshAppIcons(_root);
  void refreshFavoriteStatuses(_root);
}

async function toggleFavorite(button: HTMLButtonElement) {
  const id = String(button.dataset.carFavourite || "");
  if (!id || pendingFavoriteMutations.has(id)) return;
  const token = await getInitializedAuthToken();
  if (!token) {
    redirectToLogin(window.location.pathname + window.location.search);
    return;
  }
  const wasSaved = button.getAttribute("aria-pressed") === "true";
  const nextSaved = !wasSaved;
  setFavoriteState(id, nextSaved);
  pendingFavoriteMutations.add(id);
  button.disabled = true;
  button.dataset.state = nextSaved ? "saving" : "removing";
  try {
    const response = await fetch(buildApiUrl(API_ROUTES.favorite(id)), {
      method: nextSaved ? "POST" : "DELETE",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    if (response.status === 401) {
      setFavoriteState(id, wasSaved);
      if (await isSessionConfirmedExpired(undefined, token)) {
        redirectToLogin(window.location.pathname + window.location.search);
      } else {
        showToast("Не удалось подтвердить сессию. Повторите попытку.", "error");
      }
      return;
    }
    const idempotentSuccess = (nextSaved && response.status === 409) || (!nextSaved && response.status === 404);
    if (!response.ok && !idempotentSuccess) throw new Error(`favorite request failed ${response.status}`);
    if (!idempotentSuccess) {
      const payload = await response.json().catch(() => null) as { is_saved?: unknown } | null;
      if (payload?.is_saved !== nextSaved) throw new Error("favorite response state mismatch");
    }
    setFavoriteState(id, nextSaved);
    window.dispatchEvent(new CustomEvent("car-favorite-changed", { detail: { listingId: id, isSaved: nextSaved } }));
    showToast(nextSaved ? "Добавлено в избранное" : "Удалено из избранного");
    trackProductEvent("promotion_favourite", { listing_id: id, status: nextSaved ? "added" : "removed", source: button.dataset.favoriteSource || "public_car_card" });
  } catch {
    setFavoriteState(id, wasSaved);
    button.dataset.state = "error";
    button.disabled = false;
    showToast("Не удалось изменить избранное. Повторите попытку.", "error");
  } finally {
    pendingFavoriteMutations.delete(id);
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
