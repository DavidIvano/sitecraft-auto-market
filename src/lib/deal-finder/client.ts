import { fetchCurrentUser, getAuthToken, getAuthUser, isDealFinderUser } from "../authClient";
import {
  getAccessStateForHttpError,
  resolveDealFinderAccess,
  type AppAccessState,
} from "../accessState";
import { trackProductEvent } from "../analytics/events";
import { DEAL_FINDER_ENABLED, DEAL_FINDER_PLACEHOLDER, DEAL_FINDER_USE_MOCK_DATA } from "./constants";
import {
  DealFinderApiError,
  type DealFinderFilters,
  type DealFinderListing,
  type DealFinderSearch,
  type DealFinderStats,
  type DealFinderWorkspacePayload,
} from "./types";
import { renderDealFinderAnalysis } from "./analysis-view";
import {
  formatDealFinderDate,
  formatDealFinderPrice,
  getDealFinderImageUrl,
  getSafeDealFinderSourceUrl,
  isSafeDealFinderImageUrl,
} from "./formatters";
import { decodeDealFinderText } from "./text";
import { detailUrl } from "./routes";
import { DEAL_FINDER_PER_PAGE_OPTIONS } from "./constants";
import {
  getDealFinderPageItems,
  getDealFinderResultRange,
  normalizeDealFinderPage,
  normalizeDealFinderPerPage,
  parseDealFinderUrlState,
  writeDealFinderUrlState,
} from "./pagination";
import {
  getDealFinderWorkspace,
  getDealFinderEmails,
  getDealFinderListing,
  getDealFinderListings,
  getDealFinderSearches,
  getDealFinderStats,
  hideDealFinderListing,
  markDealFinderViewed,
  requestDealFinderAnalysis,
  restoreDealFinderListing,
  saveDealFinderListing,
  saveDealFinderWorkspace,
  unsaveDealFinderListing,
} from "./api";
import {
  buildTodayOverview,
  getSearchOperations,
  readWorkspaceRecord,
  type DealFinderWorkspaceRecord,
} from "./workspace";
import {
  buildComparisonRows,
  DEAL_FINDER_COMPARISON_MAX,
  DEAL_FINDER_COMPARISON_MIN,
  isComparisonSelected,
  readComparisonIds,
  toggleComparisonId,
  writeComparisonIds,
} from "./comparison";
import {
  notificationDedupeKey,
  readNotificationDeliveries,
  readNotificationPreferences,
  registerNotificationDelivery,
  writeNotificationPreferences,
  type DealFinderNotificationDelivery,
  type DealFinderNotificationEvent,
  type DealFinderNotificationPreferences,
} from "./notifications";

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character] || character));
const escapeDisplayText = (value: string | null | undefined) => escapeHtml(decodeDealFinderText(value));

function actionButtons(listing: DealFinderListing, includeDetail = true) {
  const sourceUrl = getSafeDealFinderSourceUrl(listing.source_url);
  const saveAction = listing.is_saved
    ? `<button class="button button-dark" type="button" data-deal-action="unsave">Убрать из сохранённых</button>`
    : `<button class="button button-dark" type="button" data-deal-action="save">Сохранить</button>`;
  const hideAction = listing.is_hidden
    ? `<button class="button button-dark" type="button" data-deal-action="restore">Восстановить</button>`
    : `<button class="button button-dark" type="button" data-deal-action="hide">Скрыть</button>`;
  const compared = typeof window !== "undefined" && isComparisonSelected(window.localStorage, listing.id);
  return `<div class="deal-finder-actions">
    ${sourceUrl ? `<a class="button button-dark" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer nofollow">Открыть оригинал</a>` : ""}
    ${saveAction}
    <button class="button button-dark" type="button" data-deal-action="view" ${listing.is_viewed ? "disabled" : ""}>${listing.is_viewed ? "Просмотрено" : "Отметить просмотренным"}</button>
    ${hideAction}
    <button class="button button-dark" type="button" data-deal-compare="${listing.id}" aria-pressed="${compared}">${compared ? "В сравнении" : "Сравнить"}</button>
    ${includeDetail ? `<a class="button button-primary" href="${detailUrl(listing.id)}">Подробнее</a>` : ""}
  </div>`;
}

const decisionLabels: Record<DealFinderWorkspaceRecord["decision"], string> = {
  undecided: "Решение не принято",
  contact: "Связаться",
  watch: "Наблюдать",
  skip: "Пропустить",
};

function shortlistContext(listing: DealFinderListing) {
  if (!listing.is_saved || typeof window === "undefined") return "";
  const workspace = readWorkspaceRecord(window.localStorage, listing.id);
  if (!workspace.note && workspace.decision === "undecided" && !workspace.next_action_at) return "";
  return `<section class="deal-finder-shortlist-context" aria-label="Рабочая заметка"><strong>${escapeHtml(decisionLabels[workspace.decision])}</strong>${workspace.note ? `<p>${escapeHtml(workspace.note)}</p>` : ""}${workspace.next_action_at ? `<span>Следующий шаг: ${escapeHtml(formatDealFinderDate(workspace.next_action_at))}</span>` : ""}</section>`;
}

function card(listing: DealFinderListing) {
  const score = listing.analysis?.deal_score;
  const image = getDealFinderImageUrl(listing.source_image_url);
  const recommendation = listing.analysis?.recommendation || (listing.source_status === "source_removed" ? "Источник удалён" : listing.user_status === "saved" ? "Сохранено" : listing.user_status === "hidden" ? "Скрыто" : "Новое");
  const identity = [listing.brand, listing.model].filter(Boolean).join(" · ") || "Марка не определена";
  const gallery = [...new Set([listing.source_image_url, ...(listing.source_images || [])].filter(isSafeDealFinderImageUrl))];
  const lightboxImages = gallery.length ? gallery : [DEAL_FINDER_PLACEHOLDER];
  return `<article class="deal-finder-card" data-deal-listing-id="${listing.id}">
    <button class="deal-finder-image vehicle-image-trigger" type="button" data-lightbox-trigger data-lightbox-src="${escapeHtml(image)}" data-lightbox-sources="${escapeHtml(JSON.stringify(lightboxImages))}" data-lightbox-alt="${escapeDisplayText(listing.title)}" aria-label="Увеличить фото: ${escapeDisplayText(listing.title)}"><img src="${escapeHtml(image)}" alt="${escapeDisplayText(listing.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-deal-finder-image data-placeholder="${DEAL_FINDER_PLACEHOLDER}"><span class="vehicle-image-zoom" aria-hidden="true">＋</span></button>
    <div class="deal-finder-card-body">
      <div class="deal-finder-card-top"><span class="deal-status-badge">${escapeHtml(recommendation)}</span><span class="deal-score-badge">${typeof score === "number" ? `Score ${Math.round(score)}` : "AI не запущен"}</span></div>
      <div><p class="deal-finder-kicker">${escapeDisplayText(identity)}</p><h2><a href="${detailUrl(listing.id)}">${escapeDisplayText(listing.title)}</a></h2></div>
      <strong class="deal-finder-price">${escapeHtml(formatDealFinderPrice(listing.price, listing.currency))}</strong>
      <dl><div><dt>Год</dt><dd>${listing.year || "—"}</dd></div><div><dt>Пробег</dt><dd>${listing.mileage ? `${Number(listing.mileage).toLocaleString("ru-RU")} км` : "—"}</dd></div><div><dt>Город</dt><dd>${escapeHtml(listing.city || "—")}</dd></div></dl>
      <p class="deal-finder-meta">Найдено: ${escapeHtml(formatDealFinderDate(listing.first_seen_at))}</p>
      ${shortlistContext(listing)}
      ${actionButtons(listing)}
      <p class="deal-finder-action-status" role="status" aria-live="polite"></p>
    </div>
  </article>`;
}

function loadingMarkup() {
  return `<div class="deal-finder-grid" aria-label="Загрузка предложений" aria-busy="true">${Array.from({ length: 6 }, () => `<article class="deal-finder-card deal-finder-skeleton"><div></div><span></span><span></span><span></span></article>`).join("")}</div>`;
}

function accessStateMarkup(state: AppAccessState) {
  const nextPath = `${window.location.pathname}${window.location.search}`;
  const actionHref = state.code === "sign_in_required"
    ? `/login?next=${encodeURIComponent(nextPath)}`
    : state.actionHref;
  const action = state.retryable
    ? `<button class="button button-dark" type="button" data-access-state-retry>${escapeHtml(state.actionLabel || "Повторить")}</button>`
    : actionHref
      ? `<a class="button button-dark" href="${escapeHtml(actionHref)}">${escapeHtml(state.actionLabel || "Продолжить")}</a>`
      : "";

  return `<section class="deal-finder-state ${state.code === "ready" ? "" : "deal-finder-error"}" role="${state.code === "ready" ? "status" : "alert"}" data-access-state="${state.code}">
    <strong>${escapeHtml(state.title)}</strong>
    ${state.message ? `<p>${escapeHtml(state.message)}</p>` : ""}
    ${action}
  </section>`;
}

function renderAccessState(root: HTMLElement, state: AppAccessState) {
  root.removeAttribute("aria-busy");
  root.innerHTML = accessStateMarkup(state);
  trackProductEvent("access_state_shown", { state: state.code });
  root.querySelector<HTMLButtonElement>("[data-access-state-retry]")?.addEventListener("click", () => {
    window.location.reload();
  });
}

function paginationMarkup(pagination: import("./types").DealFinderPagination, count: number) {
  const pageItems = getDealFinderPageItems(pagination.page, pagination.total_pages);
  const pageButtons = pageItems.map((item) => item === "ellipsis"
    ? `<span class="deal-finder-pagination-ellipsis" aria-hidden="true">…</span>`
    : `<button class="deal-finder-page-button" type="button" data-deal-page="${item}" ${item === pagination.page ? `aria-current="page"` : ""} aria-label="Страница ${item}">${item}</button>`).join("");
  const navigation = pagination.total_pages > 1
    ? `<nav class="deal-finder-pagination" aria-label="Страницы результатов">
        <button class="deal-finder-page-button" type="button" data-deal-page="${pagination.page - 1}" aria-label="Предыдущая страница" ${pagination.has_previous ? "" : "disabled"}>←</button>
        <div class="deal-finder-pagination-pages">${pageButtons}</div>
        <button class="deal-finder-page-button" type="button" data-deal-page="${pagination.page + 1}" aria-label="Следующая страница" ${pagination.has_next ? "" : "disabled"}>→</button>
      </nav>`
    : "";
  const options = DEAL_FINDER_PER_PAGE_OPTIONS.map((value) => `<option value="${value}" ${value === pagination.per_page ? "selected" : ""}>${value}</option>`).join("");
  return `<footer class="deal-finder-results-footer">
    <p class="deal-finder-range" tabindex="-1" data-deal-results-summary>${escapeHtml(getDealFinderResultRange(pagination, count))}</p>
    <label class="deal-finder-page-size">Показывать:<select data-deal-per-page aria-label="Количество объявлений на странице">${options}</select></label>
    ${navigation}
  </footer>`;
}

function syncFilterForm(form: HTMLFormElement | null, filters: DealFinderFilters) {
  if (!form) return;
  const values: Record<string, string> = {
    search: filters.search || "",
    brand: filters.brand || "",
    price_max: filters.price_max === undefined ? "" : String(filters.price_max),
    deal_score_min: filters.deal_score_min === undefined ? "" : String(filters.deal_score_min),
    deal_score_max: filters.deal_score_max === undefined ? "" : String(filters.deal_score_max),
    sort: filters.sort || "newest",
  };
  Object.entries(values).forEach(([name, value]) => {
    const control = form.elements.namedItem(name);
    if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement) control.value = value;
  });
}

function installImageFallbacks(root: ParentNode) {
  root.querySelectorAll<HTMLImageElement>("[data-deal-finder-image]").forEach((image) => {
    image.addEventListener("error", () => {
      image.src = image.dataset.placeholder || DEAL_FINDER_PLACEHOLDER;
    }, { once: true });
  });
}

function renderStats(root: Element | null, stats: DealFinderStats) {
  if (!root) return;
  root.setAttribute("aria-busy", "false");
  const values: Array<[string, number]> = [
    ["Активные", stats.active],
    ["Новые", stats.new],
    ["Сохранённые", stats.saved],
    ["Скрытые", stats.hidden],
    ["Горячие", stats.hot],
  ];
  root.innerHTML = values.map(([label, value]) => `<div class="glass-panel"><span>${label}</span><strong>${value}</strong></div>`).join("") + `<p class="deal-finder-stats-updated">Последняя синхронизация: ${escapeHtml(formatDealFinderDate(stats.last_sync_at))}</p>`;
}

function renderStatsUnavailable(root: Element | null) {
  if (!root) return;
  root.setAttribute("aria-busy", "false");
  root.innerHTML = ["Активные", "Новые", "Сохранённые", "Скрытые", "Горячие"]
    .map((label) => `<div class="glass-panel"><span>${label}</span><strong>—</strong></div>`)
    .join("") + `<p class="deal-finder-stats-updated">Статистика временно недоступна</p>`;
}

function renderToday(root: HTMLElement | null, listings: DealFinderListing[], stats: DealFinderStats | null) {
  if (!root) return;
  const records = listings.map((listing) => readWorkspaceRecord(window.localStorage, listing.id));
  const overview = buildTodayOverview(listings, records);
  const sourceState = stats?.last_sync_at
    ? `Источник обновлён ${formatDealFinderDate(stats.last_sync_at)}`
    : stats
      ? "Время последней синхронизации не передано"
      : "Статистика источника временно недоступна";
  const priorities = [
    { key: "new", label: "Новые", value: overview.newCount },
    { key: "hot", label: "Горячие", value: overview.hotCount },
    { key: "pending", label: "AI ожидает", value: overview.analysisPendingCount },
    { key: "due", label: "Контакт сегодня", value: overview.dueContactCount },
  ];
  root.setAttribute("aria-busy", "false");
  root.innerHTML = `<div class="deal-finder-today-heading"><div><span class="eyebrow">РАБОЧИЙ СПИСОК</span><h2>Что требует внимания</h2></div><span class="deal-finder-source-health">${escapeHtml(sourceState)}</span></div>
    <div class="deal-finder-system-health" aria-label="Состояние системы"><span><i data-health="ready"></i>Xano доступен</span><span><i data-health="${stats ? (stats.analysis_pending > 0 ? "waiting" : "ready") : "unknown"}"></i>Worker: ${stats ? (stats.analysis_pending > 0 ? `в очереди ${stats.analysis_pending}` : "очередь пуста") : "состояние не получено"}</span><span><i data-health="${stats?.last_sync_at ? "ready" : "unknown"}"></i>Kleinanzeigen: ${stats?.last_sync_at ? "данные получены" : "время не указано"}</span></div>
    <div class="deal-finder-today-grid">${priorities.map((item) => `<button type="button" data-deal-today="${item.key}"><span>${escapeHtml(item.label)}</span><strong>${item.value}</strong></button>`).join("")}</div>
    <p>Приоритет строится из срока следующего действия, рекомендации AI, сохранения и новизны. Просмотр ленты и фильтры не расходуют кредиты.</p>`;
}

function searchCriteria(search: DealFinderSearch) {
  return [
    [search.brand, search.model].filter(Boolean).join(" "),
    search.price_max ? `до ${formatDealFinderPrice(search.price_max, "EUR")}` : "",
    search.year_min ? `от ${search.year_min} года` : "",
    search.mileage_max ? `до ${Number(search.mileage_max).toLocaleString("ru-RU")} км` : "",
    search.location_name || search.postal_code || "",
  ].filter(Boolean);
}

function searchProfileMarkup(search: DealFinderSearch) {
  const operations = getSearchOperations(search);
  const criteria = searchCriteria(search);
  const budgetLabel = operations.budgetState === "paused"
    ? "Расход остановлен"
    : operations.budgetState === "over_limit"
      ? "Выше дневного лимита"
      : `До ${operations.maximumCredits} из ${operations.dailyLimit} кредитов/день`;
  return `<article class="deal-finder-search-card">
    <header><div><span class="deal-status-badge">${search.is_active !== false ? "Активен" : "Отключён"}</span><h2>${escapeHtml(search.name)}</h2></div><span class="deal-finder-budget-state" data-budget-state="${operations.budgetState}">${escapeHtml(budgetLabel)}</span></header>
    <div class="deal-finder-search-criteria" aria-label="Критерии поиска">${criteria.length ? criteria.map((value) => `<span>${escapeHtml(value)}</span>`).join("") : "<span>Критерии не заполнены</span>"}</div>
    <dl class="deal-finder-search-meta"><div><dt>Расписание</dt><dd>${escapeHtml(operations.scheduleLabel)}</dd></div><div><dt>Следующий запуск</dt><dd>${escapeHtml(formatDealFinderDate(operations.nextRunAt))}</dd></div><div><dt>Последний запуск</dt><dd>${escapeHtml(formatDealFinderDate(search.last_sync_at))}</dd></div><div><dt>Поиск</dt><dd>${operations.searchCredits} кредит</dd></div><div><dt>Новые детали</dt><dd>до ${operations.detailCredits} кредитов</dd></div><div><dt>Результат</dt><dd>${escapeHtml(search.last_sync_status || "Не указан")}</dd></div></dl>
    ${search.last_sync_error ? `<p class="deal-finder-inline-error">Последняя ошибка: ${escapeHtml(search.last_sync_error)}</p>` : ""}
    <p class="deal-finder-meta">Лента, фильтры, сохранение и просмотр бесплатны. Кредиты источника тратятся только во время запуска поиска и загрузки новых детальных карточек.</p>
  </article>`;
}

async function requireAccess(root: HTMLElement) {
  if (DEAL_FINDER_USE_MOCK_DATA) return true;
  const token = getAuthToken();
  let user = getAuthUser();
  let authFailed = false;

  if (DEAL_FINDER_ENABLED && token) {
    try {
      user = (await fetchCurrentUser()) || user;
    } catch {
      authFailed = true;
    }
  }

  const state = resolveDealFinderAccess({
    enabled: DEAL_FINDER_ENABLED,
    hasToken: Boolean(getAuthToken()),
    hasUser: Boolean(user?.id),
    hasRole: isDealFinderUser(user),
    authFailed,
  });
  if (state.code === "ready") return true;

  renderAccessState(root, state);
  return false;
}

function apiErrorMessage(error: unknown) {
  if (error instanceof DealFinderApiError) {
    return getAccessStateForHttpError(error.status, error.code).message;
  }
  return "Не удалось загрузить внутренние данные. Повторите попытку позже.";
}

function renderApiError(root: HTMLElement, error: unknown) {
  const state = error instanceof DealFinderApiError
    ? getAccessStateForHttpError(error.status, error.code)
    : getAccessStateForHttpError(0);
  renderAccessState(root, state);
}

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function waitForAnalysis(id: number, onChanged: () => Promise<void>) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await wait(10_000);
    const { analysis } = await getDealFinderListing(id);
    await onChanged();
    const status = analysis?.status || analysis?.analysis_status;
    if (status === "completed" || status === "failed") return;
  }
}

async function runAction(id: number, action: string, force = false) {
  if (action === "save") return saveDealFinderListing(id);
  if (action === "unsave") return unsaveDealFinderListing(id);
  if (action === "view") return markDealFinderViewed(id);
  if (action === "hide") return hideDealFinderListing(id);
  if (action === "restore") return restoreDealFinderListing(id);
  if (action === "analyze") return requestDealFinderAnalysis(id, { force });
  throw new Error("Unsupported Deal Finder action");
}

function installActions(root: HTMLElement, onChanged: () => Promise<void>) {
  root.addEventListener("click", async (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-deal-action]");
    if (!button) return;
    const card = button.closest<HTMLElement>("[data-deal-listing-id]");
    const id = Number(card?.dataset.dealListingId || 0);
    if (!id || button.disabled) return;
    const status = card?.querySelector<HTMLElement>(".deal-finder-action-status");
    button.disabled = true;
    if (status) status.textContent = "Сохраняем изменение…";
    try {
      const action = button.dataset.dealAction || "";
      await runAction(id, action, button.dataset.dealForce === "true");
      trackProductEvent("deal_finder_action_completed", { action, listing_id: id, status: "completed" });
      await onChanged();
      if (action === "analyze") await waitForAnalysis(id, onChanged);
    } catch (error) {
      button.disabled = false;
      trackProductEvent("deal_finder_action_failed", {
        action: button.dataset.dealAction || "unknown",
        listing_id: id,
        status: error instanceof DealFinderApiError ? error.status : "error",
      });
      if (status) status.textContent = apiErrorMessage(error);
    }
  });
}

function comparisonBarMarkup(ids: number[]) {
  const ready = ids.length >= DEAL_FINDER_COMPARISON_MIN;
  return `<div><strong>Сравнение: ${ids.length} из ${DEAL_FINDER_COMPARISON_MAX}</strong><span>${ready ? "Можно открыть таблицу" : `Выберите ещё ${DEAL_FINDER_COMPARISON_MIN - ids.length}`}</span></div><div>${ids.length ? `<button class="button button-dark" type="button" data-compare-clear>Очистить</button>` : ""}<a class="button button-primary" href="/dashboard/deal-finder/compare/" ${ready ? "" : `aria-disabled="true" tabindex="-1"`}>Открыть сравнение</a></div>`;
}

function ensureComparisonBar(root: HTMLElement) {
  const parent = root.parentElement;
  if (!parent) return null;
  let bar = parent.querySelector<HTMLElement>(":scope > [data-deal-comparison-bar]");
  if (!bar) {
    bar = document.createElement("aside");
    bar.className = "deal-finder-comparison-bar";
    bar.dataset.dealComparisonBar = "";
    bar.setAttribute("aria-live", "polite");
    parent.insertBefore(bar, root);
  }
  const ids = readComparisonIds(window.localStorage);
  bar.hidden = ids.length === 0;
  bar.innerHTML = comparisonBarMarkup(ids);
  return bar;
}

function syncComparisonControls(root: ParentNode = document) {
  const ids = readComparisonIds(window.localStorage);
  root.querySelectorAll<HTMLButtonElement>("[data-deal-compare]").forEach((button) => {
    const selected = ids.includes(Number(button.dataset.dealCompare));
    button.setAttribute("aria-pressed", String(selected));
    button.textContent = selected ? "В сравнении" : "Сравнить";
  });
}

function installComparisonControls(root: HTMLElement, onChanged?: () => void) {
  ensureComparisonBar(root);
  root.addEventListener("click", (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-deal-compare]");
    if (!button) return;
    const id = Number(button.dataset.dealCompare);
    if (!Number.isInteger(id) || id <= 0) return;
    const result = toggleComparisonId(window.localStorage, id);
    syncComparisonControls(document);
    const bar = ensureComparisonBar(root);
    if (bar && result.status === "limit") {
      const message = bar.querySelector("span");
      if (message) message.textContent = `Можно сравнить максимум ${DEAL_FINDER_COMPARISON_MAX} автомобиля`;
    }
    trackProductEvent("deal_finder_action_completed", { action: `compare_${result.status}`, listing_id: id, status: "completed" });
    onChanged?.();
  });
  root.parentElement?.addEventListener("click", (event) => {
    const clear = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-compare-clear]");
    if (!clear) return;
    writeComparisonIds(window.localStorage, []);
    syncComparisonControls(document);
    ensureComparisonBar(root);
    onChanged?.();
  });
}

export async function mountDealFinderFeed(root: HTMLElement, initialFilters: DealFinderFilters = {}) {
  if (!(await requireAccess(root))) return;
  const aborter = new AbortController();
  const filterForm = document.querySelector<HTMLFormElement>("[data-deal-finder-filters]");
  const baseFilters = { source_status: "active" as const, is_hidden: false, ...initialFilters };
  const urlFilters = parseDealFinderUrlState(new URLSearchParams(window.location.search));
  let currentFilters: DealFinderFilters = { ...baseFilters, ...urlFilters };
  let restoreScroll = Number(sessionStorage.getItem(`deal-finder-scroll:${window.location.href}`) || 0);
  sessionStorage.removeItem(`deal-finder-scroll:${window.location.href}`);
  syncFilterForm(filterForm, currentFilters);

  const updateUrl = (filters: DealFinderFilters, mode: "push" | "replace" = "push") => {
    const params = writeDealFinderUrlState(new URLSearchParams(window.location.search), filters);
    const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history[mode === "push" ? "pushState" : "replaceState"]({ dealFinder: true }, "", nextUrl);
  };

  const load = async (nextFilters: DealFinderFilters = currentFilters, options: { focus?: boolean; scroll?: boolean } = {}) => {
    currentFilters = nextFilters;
    root.setAttribute("aria-busy", "true");
    root.innerHTML = loadingMarkup();
    try {
      const [statsResult, listingsResult] = await Promise.allSettled([
        getDealFinderStats(aborter.signal),
        getDealFinderListings(nextFilters, aborter.signal),
      ]);
      if (listingsResult.status === "rejected") throw listingsResult.reason;
      const response = listingsResult.value;
      const stats = statsResult.status === "fulfilled" ? statsResult.value : null;
      if (stats) renderStats(document.querySelector("[data-deal-finder-stats]"), stats);
      else renderStatsUnavailable(document.querySelector("[data-deal-finder-stats]"));
      renderToday(document.querySelector<HTMLElement>("#deal-finder-today"), response.data, stats);
      root.setAttribute("aria-busy", "false");
      root.innerHTML = response.data.length
        ? `<div class="deal-finder-grid" data-deal-results-list>${response.data.map(card).join("")}</div>${paginationMarkup(response.pagination, response.data.length)}`
        : `<section class="deal-finder-state"><strong>Нет подходящих объявлений</strong><p>Измените фильтры или дождитесь следующей ручной синхронизации.</p></section>`;
      installImageFallbacks(root);
      trackProductEvent("deal_finder_feed_loaded", {
        page: response.pagination.page,
        result_count: response.data.length,
        count: response.pagination.total,
        sort: nextFilters.sort || "newest",
      });
      if (options.scroll) root.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      if (options.focus) root.querySelector<HTMLElement>("[data-deal-results-summary]")?.focus({ preventScroll: true });
      if (restoreScroll > 0) {
        window.scrollTo({ top: restoreScroll, behavior: "auto" });
        restoreScroll = 0;
      }
    } catch (error) {
      renderApiError(root, error);
    }
  };
  installActions(root, () => load());
  installComparisonControls(root);
  document.querySelector<HTMLElement>("#deal-finder-today")?.addEventListener("click", (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-deal-today]");
    if (!button) return;
    if (button.dataset.dealToday === "new") {
      const nextFilters = { ...currentFilters, page: 1, is_new: true, deal_score_min: undefined, sort: "newest" as const };
      updateUrl(nextFilters);
      load(nextFilters, { focus: true, scroll: true });
      return;
    }
    if (button.dataset.dealToday === "hot") {
      const nextFilters = { ...currentFilters, page: 1, is_new: undefined, deal_score_min: 80, sort: "deal_score_desc" as const };
      updateUrl(nextFilters);
      load(nextFilters, { focus: true, scroll: true });
      return;
    }
    root.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  });
  filterForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(filterForm);
    const numeric = (name: string) => data.get(name) ? Number(data.get(name)) : undefined;
    const nextFilters = {
      ...currentFilters,
      ...baseFilters,
      page: 1,
      per_page: normalizeDealFinderPerPage(currentFilters.per_page),
      search: String(data.get("search") || ""),
      brand: String(data.get("brand") || ""),
      price_max: numeric("price_max"),
      deal_score_min: numeric("deal_score_min"),
      deal_score_max: numeric("deal_score_max"),
      sort: String(data.get("sort") || "newest") as DealFinderFilters["sort"],
    };
    trackProductEvent("deal_finder_filter_applied", {
      has_filters: Boolean(nextFilters.search || nextFilters.brand || nextFilters.price_max || nextFilters.deal_score_min || nextFilters.deal_score_max),
      sort: nextFilters.sort || "newest",
    });
    updateUrl(nextFilters);
    load(nextFilters, { focus: true, scroll: true });
  });
  root.addEventListener("change", (event) => {
    const select = (event.target as Element | null)?.closest<HTMLSelectElement>("[data-deal-per-page]");
    if (!select) return;
    const nextFilters = { ...currentFilters, page: 1, per_page: normalizeDealFinderPerPage(select.value) };
    updateUrl(nextFilters);
    load(nextFilters, { focus: true, scroll: true });
  });
  root.addEventListener("click", (event) => {
    const pageButton = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-deal-page]");
    if (pageButton && !pageButton.disabled) {
      const nextFilters = { ...currentFilters, page: normalizeDealFinderPage(pageButton.dataset.dealPage) };
      updateUrl(nextFilters);
      load(nextFilters, { focus: true, scroll: true });
      return;
    }
    const detailLink = (event.target as Element | null)?.closest<HTMLAnchorElement>(`a[href^="/dashboard/deal-finder/listing/"]`);
    if (detailLink) sessionStorage.setItem(`deal-finder-scroll:${window.location.href}`, String(window.scrollY));
  });
  window.addEventListener("popstate", () => {
    currentFilters = { ...baseFilters, ...parseDealFinderUrlState(new URLSearchParams(window.location.search)) };
    syncFilterForm(filterForm, currentFilters);
    load(currentFilters, { focus: true });
  });
  document.querySelector<HTMLButtonElement>("[data-deal-finder-refresh]")?.addEventListener("click", () => load());
  updateUrl(currentFilters, "replace");
  await load(currentFilters);
}

export async function mountDealFinderSearches(root: HTMLElement) {
  if (!(await requireAccess(root))) return;
  try {
    const searches = await getDealFinderSearches();
    root.innerHTML = searches.length
      ? `<div class="deal-finder-list">${searches.map(searchProfileMarkup).join("")}</div>`
      : `<section class="deal-finder-state"><strong>Нет поисков</strong><p>Профили добавляются вручную; связь с Kleinanzeigen включается отдельно.</p></section>`;
  } catch (error) {
    renderApiError(root, error);
  }
}

export async function mountDealFinderInbox(root: HTMLElement) {
  if (!(await requireAccess(root))) return;
  try {
    const emails = await getDealFinderEmails();
    root.innerHTML = emails.length
      ? `<div class="deal-finder-list">${emails.map((email) => `<article class="glass-panel"><strong>${escapeHtml(email.subject || "Без темы")}</strong><p>${escapeHtml(formatDealFinderDate(email.received_at))}</p><span>${escapeHtml(email.processing_status)}</span></article>`).join("")}</div>`
      : `<section class="deal-finder-state"><strong>Inbox пока отключён</strong><p>Gmail и обработка писем не подключены на этом этапе.</p></section>`;
  } catch (error) {
    renderApiError(root, error);
  }
}

function toLocalDateTimeInput(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function workspaceMarkup(record: DealFinderWorkspaceRecord) {
  const option = (value: string, label: string, current: string) => `<option value="${value}" ${value === current ? "selected" : ""}>${escapeHtml(label)}</option>`;
  const storageLabel = record.storage === "server"
    ? "Синхронизируется между вашими устройствами"
    : "Черновик хранится в этом браузере до включения Xano-синхронизации";
  return `<section class="deal-finder-workspace-panel">
    <div class="deal-finder-workspace-heading"><div><span class="eyebrow">РАБОЧАЯ ЗАПИСЬ</span><h2>Решение и следующий шаг</h2></div><span data-workspace-storage>${escapeHtml(storageLabel)}</span></div>
    <form class="deal-finder-workspace-form" data-deal-workspace-form>
      <label>Решение<select name="decision">${option("undecided", "Не решено", record.decision)}${option("contact", "Связаться", record.decision)}${option("watch", "Наблюдать", record.decision)}${option("skip", "Пропустить", record.decision)}</select></label>
      <label>Контакт<select name="contact_status">${option("not_contacted", "Не связывались", record.contact_status)}${option("planned", "Запланирован", record.contact_status)}${option("contacted", "Связались", record.contact_status)}${option("waiting", "Ждём ответ", record.contact_status)}${option("closed", "Закрыт", record.contact_status)}</select></label>
      <label>Канал<select name="contact_channel">${option("none", "Не выбран", record.contact_channel)}${option("phone", "Телефон", record.contact_channel)}${option("email", "Email", record.contact_channel)}${option("message", "Сообщение", record.contact_channel)}</select></label>
      <label>Следующее действие<input name="next_action_at" type="datetime-local" value="${escapeHtml(toLocalDateTimeInput(record.next_action_at))}" /></label>
      <label class="deal-finder-workspace-note">Заметка<textarea name="note" rows="4" maxlength="2000" placeholder="Что проверить, о чём спросить, какой результат звонка">${escapeHtml(record.note)}</textarea></label>
      <div class="deal-finder-workspace-submit"><button class="button button-primary" type="submit">Сохранить запись</button><p role="status" aria-live="polite" data-workspace-status>${record.updated_at ? `Сохранено ${escapeHtml(formatDealFinderDate(record.updated_at))}` : ""}</p></div>
    </form>
  </section>`;
}

function dossierSummary(listing: DealFinderListing, search: DealFinderSearch | null) {
  const sourceLabel = listing.source_status === "active" ? "Источник активен" : "Источник недоступен";
  const analysisLabel = listing.analysis?.status === "completed"
    ? `AI обновлён ${formatDealFinderDate(listing.analysis.completed_at || listing.analysis.analyzed_at)}`
    : listing.analysis
      ? "AI-задача выполняется"
      : "AI ещё не запускался";
  return `<section class="deal-finder-dossier-summary" aria-label="Состояние досье"><div><span>Источник</span><strong>${escapeHtml(sourceLabel)}</strong></div><div><span>Данные</span><strong>${escapeHtml(formatDealFinderDate(listing.last_checked_at || listing.last_seen_at))}</strong></div><div><span>AI</span><strong>${escapeHtml(analysisLabel)}</strong></div><div><span>Профиль</span><strong>${escapeHtml(search?.name || "Ручное добавление")}</strong></div></section>`;
}

export async function mountDealFinderDetail(root: HTMLElement, id: string) {
  if (!(await requireAccess(root))) return;
  root.addEventListener("submit", async (event) => {
    const form = (event.target as Element | null)?.closest<HTMLFormElement>("[data-deal-workspace-form]");
    if (!form) return;
    event.preventDefault();
    const status = form.querySelector<HTMLElement>("[data-workspace-status]");
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const data = new FormData(form);
    const localDate = String(data.get("next_action_at") || "");
    const payload: DealFinderWorkspacePayload = {
      decision: String(data.get("decision") || "undecided") as DealFinderWorkspacePayload["decision"],
      contact_status: String(data.get("contact_status") || "not_contacted") as DealFinderWorkspacePayload["contact_status"],
      contact_channel: String(data.get("contact_channel") || "none") as DealFinderWorkspacePayload["contact_channel"],
      next_action_at: localDate && Number.isFinite(Date.parse(localDate)) ? new Date(localDate).toISOString() : null,
      note: String(data.get("note") || "").trim(),
    };
    if (button) button.disabled = true;
    if (status) status.textContent = "Сохраняем…";
    try {
      const saved = await saveDealFinderWorkspace(id, payload);
      const storage = root.querySelector<HTMLElement>("[data-workspace-storage]");
      if (storage) storage.textContent = saved.storage === "server"
        ? "Синхронизируется между вашими устройствами"
        : "Черновик сохранён в этом браузере";
      if (status) status.textContent = `Сохранено ${formatDealFinderDate(saved.updated_at)}`;
      trackProductEvent("deal_finder_action_completed", { action: "workspace_save", listing_id: Number(id), status: "completed" });
    } catch (error) {
      if (status) status.textContent = apiErrorMessage(error);
      trackProductEvent("deal_finder_action_failed", { action: "workspace_save", listing_id: Number(id), status: "error" });
    } finally {
      if (button) button.disabled = false;
    }
  });
  const render = async () => {
    try {
      const [{ listing, analysis, search, allowed_actions }, workspace] = await Promise.all([
        getDealFinderListing(id),
        getDealFinderWorkspace(id),
      ]);
      const sourceImages = [listing.source_image_url, ...(listing.source_images || [])].filter(isSafeDealFinderImageUrl) as string[];
      const gallery = [...new Set(sourceImages)];
      const images = gallery.length ? gallery : [DEAL_FINDER_PLACEHOLDER];
      root.dataset.dealListingId = String(listing.id);
      root.innerHTML = `<article class="deal-finder-detail">
        <div class="deal-finder-gallery">${images.map((image, index) => `<button class="deal-finder-image vehicle-image-trigger" type="button" data-lightbox-trigger data-lightbox-group="deal-finder-${listing.id}" data-lightbox-src="${escapeHtml(image)}" data-lightbox-alt="${escapeDisplayText(listing.title)}, фото ${index + 1}" aria-label="Увеличить фото ${index + 1} из ${images.length}"><img src="${escapeHtml(image)}" alt="${escapeDisplayText(listing.title)}${images.length > 1 ? `, фото ${index + 1}` : ""}" loading="${index === 0 ? "eager" : "lazy"}" decoding="async" referrerpolicy="no-referrer" data-deal-finder-image data-placeholder="${DEAL_FINDER_PLACEHOLDER}"><span class="vehicle-image-zoom" aria-hidden="true">＋</span></button>`).join("")}</div>
        <div class="glass-panel"><span class="eyebrow">ДОСЬЕ РЕШЕНИЯ · KLEINANZEIGEN</span><h1>${escapeDisplayText(listing.title)}</h1><strong class="deal-finder-price">${escapeHtml(formatDealFinderPrice(listing.price, listing.currency))}</strong>
          ${dossierSummary({ ...listing, analysis }, search)}
          <dl class="deal-finder-specs"><div><dt>Марка</dt><dd>${escapeHtml(listing.brand || "—")}</dd></div><div><dt>Модель</dt><dd>${escapeHtml(listing.model || "—")}</dd></div><div><dt>Вариант</dt><dd>${escapeHtml(listing.variant || "—")}</dd></div><div><dt>Год</dt><dd>${listing.year || "—"}</dd></div><div><dt>Пробег</dt><dd>${listing.mileage ? `${Number(listing.mileage).toLocaleString("ru-RU")} км` : "—"}</dd></div><div><dt>Топливо</dt><dd>${escapeHtml(listing.fuel_type || "—")}</dd></div><div><dt>Коробка</dt><dd>${escapeHtml(listing.transmission || "—")}</dd></div><div><dt>Мощность</dt><dd>${listing.power_kw ? `${listing.power_kw} кВт` : "—"}</dd></div><div><dt>Город</dt><dd>${escapeHtml(listing.city || "—")}</dd></div><div><dt>Обнаружено</dt><dd>${escapeHtml(formatDealFinderDate(listing.first_seen_at))}</dd></div><div><dt>Опубликовано</dt><dd>${escapeHtml(formatDealFinderDate(listing.published_at))}</dd></div><div><dt>Проверено</dt><dd>${escapeHtml(formatDealFinderDate(listing.last_checked_at))}</dd></div></dl>
          <section class="deal-finder-description"><h2>Описание</h2><p>${escapeDisplayText(listing.description || "Описание не предоставлено источником.")}</p></section>
          ${renderDealFinderAnalysis(analysis, allowed_actions.reanalyze)}
          ${workspaceMarkup(workspace)}
          ${actionButtons(listing, false)}<p class="deal-finder-action-status" role="status" aria-live="polite"></p>
          <p class="deal-finder-notice">Источник: Kleinanzeigen. Это закрытый внутренний аналитический инструмент. Проверяйте данные и актуальность в оригинальном объявлении.</p>
        </div>
      </article>`;
      installImageFallbacks(root);
      trackProductEvent("deal_finder_detail_loaded", { listing_id: listing.id, status: analysis?.status || "not_started" });
    } catch (error) {
      renderApiError(root, error);
    }
  };
  installActions(root, render);
  installComparisonControls(root);
  await render();
}

function comparisonHeader(listing: DealFinderListing) {
  const image = getDealFinderImageUrl(listing.source_image_url);
  return `<article class="deal-finder-comparison-car"><img src="${escapeHtml(image)}" alt="${escapeDisplayText(listing.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-deal-finder-image data-placeholder="${DEAL_FINDER_PLACEHOLDER}"><div><span>${escapeDisplayText([listing.brand, listing.model].filter(Boolean).join(" · ") || "Марка не определена")}</span><strong>${escapeDisplayText(listing.title)}</strong><a href="${detailUrl(listing.id)}">Открыть досье</a></div><button type="button" aria-label="Убрать ${escapeDisplayText(listing.title)} из сравнения" data-compare-remove="${listing.id}">×</button></article>`;
}

function comparisonNotes(listings: DealFinderListing[]) {
  return listings.map((listing) => {
    const record = readWorkspaceRecord(window.localStorage, listing.id);
    const text = record.note || decisionLabels[record.decision];
    return `<div class="${record.note ? "" : "is-missing"}">${escapeHtml(text || "Нет заметки")}</div>`;
  }).join("");
}

export async function mountDealFinderComparison(root: HTMLElement) {
  if (!(await requireAccess(root))) return;
  const render = async () => {
    const ids = readComparisonIds(window.localStorage);
    root.setAttribute("aria-busy", "true");
    if (!ids.length) {
      root.setAttribute("aria-busy", "false");
      root.innerHTML = `<section class="deal-finder-state"><strong>Список сравнения пуст</strong><p>Добавьте от двух до четырёх автомобилей из ленты или досье.</p><a class="button button-primary" href="/dashboard/deal-finder/">Перейти к предложениям</a></section>`;
      return;
    }
    try {
      const results = await Promise.allSettled(ids.map((listingId) => getDealFinderListing(listingId)));
      const listings = results.flatMap((result) => result.status === "fulfilled" ? [result.value.listing] : []);
      const missingCount = ids.length - listings.length;
      root.setAttribute("aria-busy", "false");
      root.innerHTML = `<div class="deal-finder-comparison-heading"><div><span class="eyebrow">${listings.length} ИЗ ${DEAL_FINDER_COMPARISON_MAX}</span><h2>${listings.length >= DEAL_FINDER_COMPARISON_MIN ? "Сравнение предложений" : "Добавьте ещё один автомобиль"}</h2><p>Лучшее числовое значение отмечено зелёным. Отсутствующие сведения не заменяются догадками.</p></div><button class="button button-dark" type="button" data-compare-clear>Очистить</button></div>
        ${missingCount ? `<p class="deal-finder-inline-error">${missingCount} предложений больше недоступно и не включено в таблицу.</p>` : ""}
        <div class="deal-finder-comparison-scroll"><div class="deal-finder-comparison-table" style="--comparison-count:${Math.max(1, listings.length)}"><div class="deal-finder-comparison-label">Автомобиль</div>${listings.map(comparisonHeader).join("")}<div class="deal-finder-comparison-label">Рабочая заметка</div>${comparisonNotes(listings)}${buildComparisonRows(listings).map((row) => `<div class="deal-finder-comparison-label">${escapeHtml(row.label)}</div>${row.cells.map((cell) => `<div class="deal-finder-comparison-cell ${cell.missing ? "is-missing" : ""} ${cell.best ? "is-best" : ""}">${escapeHtml(cell.value)}</div>`).join("")}`).join("")}</div></div>`;
      installImageFallbacks(root);
      trackProductEvent("deal_finder_comparison_opened", { count: listings.length });
    } catch (error) {
      renderApiError(root, error);
    }
  };
  root.addEventListener("click", (event) => {
    const remove = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-compare-remove]");
    const clear = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-compare-clear]");
    if (remove) toggleComparisonId(window.localStorage, Number(remove.dataset.compareRemove));
    if (clear) writeComparisonIds(window.localStorage, []);
    if (remove || clear) render();
  });
  await render();
}

const notificationEventLabels: Record<DealFinderNotificationEvent, string> = {
  hot_deal: "Горячее предложение",
  new_match: "Новое совпадение",
  price_change: "Изменилась цена",
  next_action: "Наступил следующий шаг",
};

function notificationHistoryMarkup(deliveries: DealFinderNotificationDelivery[]) {
  if (!deliveries.length) return `<p class="deal-finder-meta">Тестовых и отправленных событий пока нет.</p>`;
  return `<div class="deal-finder-notification-history">${deliveries.slice(0, 8).map((delivery) => `<div><span>${escapeHtml(notificationEventLabels[delivery.event])}</span><strong>${delivery.channel === "email" ? "Email" : "Web Push"}</strong><time>${escapeHtml(formatDealFinderDate(delivery.created_at))}</time></div>`).join("")}</div>`;
}

function notificationSettingsMarkup(preferences: DealFinderNotificationPreferences) {
  const checked = (value: boolean) => value ? "checked" : "";
  const eventToggle = (event: DealFinderNotificationEvent) => `<label><input type="checkbox" name="events" value="${event}" ${checked(preferences.events.includes(event))}><span>${escapeHtml(notificationEventLabels[event])}</span></label>`;
  return `<div class="deal-finder-notification-layout"><form class="deal-finder-notification-form" data-notification-form><section><span class="eyebrow">КАНАЛЫ</span><h2>Куда отправлять</h2><label class="deal-finder-toggle-row"><span><strong>Email</strong><small>Адрес подтверждённого аккаунта</small></span><input type="checkbox" name="email_enabled" ${checked(preferences.email_enabled)}></label><label class="deal-finder-toggle-row"><span><strong>Web Push</strong><small>После подключения Worker и разрешения браузера</small></span><input type="checkbox" name="web_push_enabled" ${checked(preferences.web_push_enabled)}></label></section><section><span class="eyebrow">СОБЫТИЯ</span><h2>Что важно</h2><div class="deal-finder-notification-events">${eventToggle("hot_deal")}${eventToggle("new_match")}${eventToggle("price_change")}${eventToggle("next_action")}</div><label>Минимальный Deal score<input type="number" name="minimum_score" min="0" max="100" value="${preferences.minimum_score}"></label></section><section><span class="eyebrow">РЕЖИМ</span><h2>Когда сообщать</h2><label>Частота<select name="frequency"><option value="instant" ${preferences.frequency === "instant" ? "selected" : ""}>Сразу</option><option value="daily" ${preferences.frequency === "daily" ? "selected" : ""}>Ежедневная сводка</option><option value="weekly" ${preferences.frequency === "weekly" ? "selected" : ""}>Еженедельная сводка</option></select></label><label class="deal-finder-toggle-row"><span><strong>Тихие часы</strong><small>${escapeHtml(preferences.timezone)}</small></span><input type="checkbox" name="quiet_hours_enabled" ${checked(preferences.quiet_hours_enabled)}></label><div class="deal-finder-quiet-hours"><label>С<input type="time" name="quiet_start" value="${escapeHtml(preferences.quiet_start)}"></label><label>До<input type="time" name="quiet_end" value="${escapeHtml(preferences.quiet_end)}"></label></div></section><footer><button class="button button-primary" type="submit">Сохранить настройки</button><button class="button button-dark" type="button" data-notification-test>Проверить дедупликацию</button><p role="status" aria-live="polite" data-notification-status>${preferences.updated_at ? `Сохранено ${escapeHtml(formatDealFinderDate(preferences.updated_at))}` : "Каналы выключены до подключения серверной доставки"}</p></footer></form><aside class="deal-finder-notification-side"><div><span class="eyebrow">ДОСТАВКА</span><h2>Как это будет работать</h2><p>Одно событие для одного объявления и канала получает уникальный ключ. Повтор с тем же ключом не отправляется.</p><ul><li>Email и Web Push можно отключить отдельно.</li><li>Тихие часы переносят доставку до разрешённого времени.</li><li>Сводка объединяет несколько событий в одно сообщение.</li><li>Просмотр ленты и страницы не создаёт уведомлений.</li></ul></div><div><span class="eyebrow">ЖУРНАЛ НА УСТРОЙСТВЕ</span><div data-notification-history>${notificationHistoryMarkup(readNotificationDeliveries(window.localStorage))}</div></div></aside></div>`;
}

export async function mountDealFinderNotifications(root: HTMLElement) {
  if (!(await requireAccess(root))) return;
  let preferences = readNotificationPreferences(window.localStorage);
  root.setAttribute("aria-busy", "false");
  root.innerHTML = notificationSettingsMarkup(preferences);
  root.addEventListener("submit", (event) => {
    const form = (event.target as Element | null)?.closest<HTMLFormElement>("[data-notification-form]");
    if (!form) return;
    event.preventDefault();
    const data = new FormData(form);
    preferences = writeNotificationPreferences(window.localStorage, {
      ...preferences,
      email_enabled: data.get("email_enabled") === "on",
      web_push_enabled: data.get("web_push_enabled") === "on",
      frequency: String(data.get("frequency") || "daily") as DealFinderNotificationPreferences["frequency"],
      quiet_hours_enabled: data.get("quiet_hours_enabled") === "on",
      quiet_start: String(data.get("quiet_start") || "22:00"),
      quiet_end: String(data.get("quiet_end") || "07:00"),
      minimum_score: Number(data.get("minimum_score") || 0),
      events: data.getAll("events") as DealFinderNotificationEvent[],
    });
    const status = form.querySelector<HTMLElement>("[data-notification-status]");
    if (status) status.textContent = `Сохранено ${formatDealFinderDate(preferences.updated_at)}. Серверная доставка включится после публикации Xano-контракта.`;
    trackProductEvent("deal_finder_notification_preferences_saved", { frequency: preferences.frequency, channel_email_enabled: preferences.email_enabled, channel_push_enabled: preferences.web_push_enabled });
  });
  root.addEventListener("click", (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-notification-test]");
    if (!button) return;
    const channel = preferences.email_enabled ? "email" : "web_push";
    const createdAt = new Date().toISOString();
    const delivery: DealFinderNotificationDelivery = { dedupe_key: notificationDedupeKey({ userId: 1, listingId: 1002, event: "hot_deal", version: "stage-3-test" }), listing_id: 1002, event: "hot_deal", channel, status: "preview", created_at: createdAt };
    const result = registerNotificationDelivery(window.localStorage, delivery);
    const status = root.querySelector<HTMLElement>("[data-notification-status]");
    if (status) status.textContent = result.accepted ? "Тестовое событие добавлено. Повторный клик будет остановлен как дубль." : "Повтор остановлен: такое событие уже есть в журнале доставки.";
    const history = root.querySelector<HTMLElement>("[data-notification-history]");
    if (history) history.innerHTML = notificationHistoryMarkup(result.deliveries);
  });
}
