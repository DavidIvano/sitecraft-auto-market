const LIGHTBOX_ID = "site-image-lightbox";
const PLACEHOLDER = "/deal-finder-placeholder.svg";
const MAX_SCALE = 3;
const MIN_SCALE = 1;

type LightboxItem = { src: string; alt: string };

function isSafeRasterUrl(value: unknown, allowBlob = false) {
  if (typeof value !== "string" || !value.trim()) return false;
  if (value === PLACEHOLDER) return true;
  if (allowBlob && value.startsWith("blob:")) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    return !/\.(?:svg|svgz)(?:$|[?#])/i.test(url.pathname);
  } catch {
    return false;
  }
}

function parseSources(trigger: HTMLElement) {
  const allowBlob = trigger.dataset.lightboxLocal === "true";
  const fallback = trigger.dataset.lightboxSrc
    || trigger.querySelector<HTMLImageElement>("img")?.currentSrc
    || trigger.querySelector<HTMLImageElement>("img")?.src
    || "";
  let sources: unknown[] = [];
  if (trigger.dataset.lightboxSources) {
    try {
      const parsed = JSON.parse(trigger.dataset.lightboxSources);
      if (Array.isArray(parsed)) sources = parsed;
    } catch {
      sources = [];
    }
  }
  if (!sources.length && fallback) sources = [fallback];
  return sources
    .filter((source): source is string => isSafeRasterUrl(source, allowBlob))
    .map((src) => ({ src, alt: trigger.dataset.lightboxAlt || trigger.querySelector<HTMLImageElement>("img")?.alt || "Фотография автомобиля" }));
}

function getGroupItems(trigger: HTMLElement) {
  const group = trigger.dataset.lightboxGroup;
  if (!group) return parseSources(trigger);
  const items = Array.from(document.querySelectorAll<HTMLElement>("[data-lightbox-item], [data-lightbox-trigger]"))
    .filter((item) => item.dataset.lightboxGroup === group)
    .flatMap(parseSources);
  return items.filter((item, index) => items.findIndex((candidate) => candidate.src === item.src) === index);
}

export function installImageLightbox() {
  const dialog = document.querySelector<HTMLDialogElement>(`#${LIGHTBOX_ID}`);
  if (!dialog || dialog.dataset.lightboxInstalled === "true") return;
  dialog.dataset.lightboxInstalled = "true";
  const image = dialog.querySelector<HTMLImageElement>("[data-lightbox-image]");
  const viewport = dialog.querySelector<HTMLElement>("[data-lightbox-viewport]");
  const count = dialog.querySelector<HTMLOutputElement>("[data-lightbox-count]");
  const zoomValue = dialog.querySelector<HTMLOutputElement>("[data-lightbox-zoom-value]");
  const thumbnails = dialog.querySelector<HTMLElement>("[data-lightbox-thumbnails]");
  const previousButton = dialog.querySelector<HTMLButtonElement>("[data-lightbox-prev]");
  const nextButton = dialog.querySelector<HTMLButtonElement>("[data-lightbox-next]");
  if (!image || !viewport || !count || !zoomValue || !thumbnails || !previousButton || !nextButton) return;

  let items: LightboxItem[] = [];
  let activeIndex = 0;
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let returnFocus: HTMLElement | null = null;
  let pointerStart: { x: number; y: number } | null = null;
  let panStart: { x: number; y: number; translateX: number; translateY: number } | null = null;
  const pointers = new Map<number, { x: number; y: number }>();
  let pinchDistance = 0;
  let pinchScale = 1;

  const applyTransform = () => {
    image.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
    zoomValue.value = `${Math.round(scale * 100)}%`;
    viewport.classList.toggle("is-zoomed", scale > 1);
  };

  const setScale = (nextScale: number) => {
    scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
    if (scale === 1) translateX = translateY = 0;
    applyTransform();
  };

  const resetZoom = () => {
    scale = 1;
    translateX = translateY = 0;
    applyTransform();
  };

  const preloadNeighbors = () => {
    if (items.length < 2) return;
    [items[(activeIndex - 1 + items.length) % items.length], items[(activeIndex + 1) % items.length]].forEach((item) => {
      const preload = new Image();
      preload.referrerPolicy = "no-referrer";
      preload.src = item.src;
    });
  };

  const renderThumbnails = () => {
    thumbnails.replaceChildren(...items.map((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "image-lightbox-thumbnail";
      button.dataset.lightboxIndex = String(index);
      button.setAttribute("aria-label", `Фотография ${index + 1}`);
      button.setAttribute("aria-pressed", String(index === activeIndex));
      const thumbnail = document.createElement("img");
      thumbnail.src = item.src;
      thumbnail.alt = "";
      thumbnail.loading = "lazy";
      thumbnail.decoding = "async";
      thumbnail.referrerPolicy = "no-referrer";
      button.append(thumbnail);
      return button;
    }));
    thumbnails.hidden = items.length < 2;
  };

  const showItem = (nextIndex: number) => {
    if (!items.length) return;
    activeIndex = (nextIndex + items.length) % items.length;
    resetZoom();
    image.src = items[activeIndex].src;
    image.alt = items[activeIndex].alt;
    count.value = `${activeIndex + 1} / ${items.length}`;
    previousButton.hidden = items.length < 2;
    nextButton.hidden = items.length < 2;
    thumbnails.querySelectorAll<HTMLElement>("[data-lightbox-index]").forEach((button) => {
      const selected = Number(button.dataset.lightboxIndex) === activeIndex;
      button.setAttribute("aria-pressed", String(selected));
      if (selected) button.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    });
    preloadNeighbors();
  };

  const close = () => {
    if (dialog.open) dialog.close();
  };

  const open = (trigger: HTMLElement) => {
    const nextItems = getGroupItems(trigger);
    if (!nextItems.length) return;
    items = nextItems;
    const requested = trigger.dataset.lightboxSrc || trigger.querySelector<HTMLImageElement>("img")?.currentSrc || "";
    activeIndex = Math.max(0, items.findIndex((item) => item.src === requested));
    returnFocus = trigger;
    renderThumbnails();
    showItem(activeIndex);
    document.documentElement.classList.add("image-lightbox-open");
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>("[data-lightbox-close]")?.focus();
  };

  document.addEventListener("click", (event) => {
    const trigger = (event.target as Element | null)?.closest<HTMLElement>("[data-lightbox-trigger]");
    if (trigger) {
      event.preventDefault();
      open(trigger);
    }
  });
  dialog.querySelector("[data-lightbox-close]")?.addEventListener("click", close);
  previousButton.addEventListener("click", () => showItem(activeIndex - 1));
  nextButton.addEventListener("click", () => showItem(activeIndex + 1));
  dialog.querySelector("[data-lightbox-zoom-in]")?.addEventListener("click", () => setScale(scale + 0.5));
  dialog.querySelector("[data-lightbox-zoom-out]")?.addEventListener("click", () => setScale(scale - 0.5));
  thumbnails.addEventListener("click", (event) => {
    const button = (event.target as Element | null)?.closest<HTMLElement>("[data-lightbox-index]");
    if (button) showItem(Number(button.dataset.lightboxIndex));
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener("close", () => {
    document.documentElement.classList.remove("image-lightbox-open");
    image.removeAttribute("src");
    resetZoom();
    returnFocus?.focus({ preventScroll: true });
    returnFocus = null;
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "ArrowLeft" && items.length > 1) showItem(activeIndex - 1);
    if (event.key === "ArrowRight" && items.length > 1) showItem(activeIndex + 1);
    if (event.key === "+" || event.key === "=") setScale(scale + 0.5);
    if (event.key === "-") setScale(scale - 0.5);
  });
  viewport.addEventListener("pointerdown", (event) => {
    viewport.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    pointerStart = { x: event.clientX, y: event.clientY };
    panStart = { x: event.clientX, y: event.clientY, translateX, translateY };
    if (pointers.size === 2) {
      const [first, second] = [...pointers.values()];
      pinchDistance = Math.hypot(second.x - first.x, second.y - first.y);
      pinchScale = scale;
    }
  });
  viewport.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const [first, second] = [...pointers.values()];
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      if (pinchDistance > 0) setScale(pinchScale * (distance / pinchDistance));
      return;
    }
    if (scale > 1 && panStart) {
      translateX = panStart.translateX + event.clientX - panStart.x;
      translateY = panStart.translateY + event.clientY - panStart.y;
      applyTransform();
    }
  });
  viewport.addEventListener("pointerup", (event) => {
    const start = pointerStart;
    pointers.delete(event.pointerId);
    pointerStart = null;
    panStart = null;
    if (scale === 1 && start && items.length > 1) {
      const deltaX = event.clientX - start.x;
      const deltaY = event.clientY - start.y;
      if (Math.abs(deltaX) > 48 && Math.abs(deltaX) > Math.abs(deltaY)) showItem(activeIndex + (deltaX < 0 ? 1 : -1));
    }
  });
  viewport.addEventListener("pointercancel", (event) => {
    pointers.delete(event.pointerId);
    pointerStart = null;
    panStart = null;
  });
}

export const isSafeLightboxImageUrl = isSafeRasterUrl;
