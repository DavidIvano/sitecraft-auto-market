import type { CarListing, CarListingImage } from "./types";

function normalizeUrl(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const url = value.trim();

  if (!url) {
    return "";
  }

  return url.startsWith("http") || url.startsWith("/") ? url : "";
}

function getMetadataUrl(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "";
  }

  const metadata = value as Record<string, unknown>;
  const optimized = metadata.optimized && typeof metadata.optimized === "object"
    ? (metadata.optimized as Record<string, unknown>)
    : {};
  const variants = metadata.variants && typeof metadata.variants === "object"
    ? (metadata.variants as Record<string, unknown>)
    : {};
  const detail = variants.detail && typeof variants.detail === "object" ? (variants.detail as Record<string, unknown>) : {};
  const candidates = [
    detail.url,
    optimized.url,
    metadata.url,
    metadata.public_url,
    metadata.image_url,
    metadata.src,
    metadata.path,
  ];
  const url = candidates.find((candidate) => typeof candidate === "string" && candidate.length > 0);

  return normalizeUrl(url);
}

function getMetadataVariantUrl(value: unknown, variant: "thumb" | "card" | "detail"): string {
  if (!value || typeof value !== "object") {
    return "";
  }

  const metadata = value as Record<string, unknown>;
  const variants = metadata.variants && typeof metadata.variants === "object"
    ? (metadata.variants as Record<string, unknown>)
    : {};
  const variantData = variants[variant] && typeof variants[variant] === "object"
    ? (variants[variant] as Record<string, unknown>)
    : {};
  const optimized = metadata.optimized && typeof metadata.optimized === "object"
    ? (metadata.optimized as Record<string, unknown>)
    : {};

  return normalizeUrl(variantData.url) || normalizeUrl(optimized.url) || getMetadataUrl(value);
}

function readPositiveNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function getMetadataDimensions(value: unknown) {
  if (!value || typeof value !== "object") return { width: 0, height: 0 };
  const metadata = value as Record<string, unknown>;
  const optimized = metadata.optimized && typeof metadata.optimized === "object"
    ? metadata.optimized as Record<string, unknown>
    : {};
  return {
    width: readPositiveNumber(optimized.width || metadata.width),
    height: readPositiveNumber(optimized.height || metadata.height),
  };
}

function buildManagedVariantUrl(value: string, width: 320 | 480 | 640 | 800 | 1280 | 1600, quality: 60 | 68 | 72 | 78) {
  const source = normalizeUrl(value);
  if (!source || !source.includes("/api/r2-images/")) return source;
  const relative = source.startsWith("/");
  const url = new URL(source, "https://sitecraft.invalid");
  url.searchParams.set("width", String(width));
  url.searchParams.set("quality", String(quality));
  return relative ? `${url.pathname}${url.search}` : url.toString();
}

export type ResponsiveImagePresentation = {
  src: string;
  srcset: string;
  sizes: string;
  width: number;
  height: number;
};

function makeResponsivePresentation(
  source: string,
  dimensions: { width: number; height: number },
  variant: "thumb" | "card" | "detail",
): ResponsiveImagePresentation {
  const fallback = normalizeUrl(source);
  const candidates = variant === "thumb"
    ? ([320, 480] as const).map((width) => [buildManagedVariantUrl(fallback, width, width === 320 ? 60 : 68), width] as const)
    : variant === "card"
      ? ([480, 800] as const).map((width) => [buildManagedVariantUrl(fallback, width, width === 480 ? 68 : 72), width] as const)
      : ([640, 1280, 1600] as const).map((width) => [buildManagedVariantUrl(fallback, width, width === 640 ? 68 : width === 1280 ? 72 : 78), width] as const);
  const srcset = candidates
    .filter(([url]) => Boolean(url) && url !== fallback)
    .map(([url, width]) => `${url} ${width}w`)
    .join(", ");
  const ratio = dimensions.width > 0 && dimensions.height > 0 ? dimensions.width / dimensions.height : 8 / 5;
  const width = variant === "thumb" ? 480 : variant === "card" ? 800 : 1600;
  return {
    src: variant === "thumb"
      ? buildManagedVariantUrl(fallback, 480, 68)
      : variant === "card"
        ? buildManagedVariantUrl(fallback, 800, 72)
        : buildManagedVariantUrl(fallback, 1600, 78),
    srcset,
    sizes: variant === "thumb"
      ? "96px"
      : variant === "card"
        ? "(max-width: 640px) calc(100vw - 32px), (max-width: 1100px) calc(50vw - 32px), 400px"
        : "(max-width: 760px) calc(100vw - 24px), (max-width: 1200px) 60vw, 760px",
    width,
    height: Math.max(1, Math.round(width / ratio)),
  };
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parseStringArray(parsed);
    } catch {
      return normalizeUrl(value) ? [normalizeUrl(value)] : [];
    }
  }

  return [];
}

function sortImageRows(images: CarListingImage[]) {
  return [...images]
    .filter((image) => !image.is_deleted)
    .sort((left, right) => {
      const leftPrimary = left.is_primary || left.is_main ? 0 : 1;
      const rightPrimary = right.is_primary || right.is_main ? 0 : 1;

      if (leftPrimary !== rightPrimary) {
        return leftPrimary - rightPrimary;
      }

      return Number(left.sort_order ?? 999) - Number(right.sort_order ?? 999);
    });
}

export function getListingImages(car: Partial<CarListing>) {
  return sortImageRows(car.images ?? [])
    .map((image) => ({
      ...image,
      image_url: normalizeUrl(image.image_url) || normalizeUrl(image.image?.url) || getMetadataUrl(image.image_metadata),
    }))
    .filter((image) => Boolean(image.image_url));
}

export function getCarImageUrls(car: Partial<CarListing>) {
  const fromImageUrls = parseStringArray(car.image_urls);
  const fromRows = getListingImages(car)
    .map((image) => image.image_url)
    .filter((value): value is string => Boolean(value));
  const candidates = [
    normalizeUrl(car.cover_image_url),
    normalizeUrl(car.main_image_url),
    ...fromImageUrls,
    ...fromRows,
  ].filter((value): value is string => Boolean(value));

  return [...new Set(candidates)];
}

export function getCarCoverImageUrl(car: Partial<CarListing>) {
  return getCarImageUrls(car)[0] || "";
}

export function getCarCardImageUrl(car: Partial<CarListing>) {
  const row = getListingImages(car)[0];
  const variantUrl = row ? getMetadataVariantUrl(row.image_metadata, "card") || getMetadataVariantUrl(row.image_metadata, "thumb") : "";

  return variantUrl || getCarCoverImageUrl(car);
}

export function getCarCardImagePresentation(car: Partial<CarListing>): ResponsiveImagePresentation {
  const row = getListingImages(car)[0];
  const source = getCarCardImageUrl(car);
  return makeResponsivePresentation(source, getMetadataDimensions(row?.image_metadata), "card");
}

export function getCarDetailImageUrls(car: Partial<CarListing>) {
  const rowUrls = getListingImages(car)
    .map((image) => getMetadataVariantUrl(image.image_metadata, "detail") || image.image_url)
    .filter((value): value is string => Boolean(value));
  const legacyUrls = getCarImageUrls(car);

  const seen = new Set<string>();
  return [...rowUrls, ...legacyUrls].filter((source) => {
    const key = source.includes("/api/r2-images/")
      ? source.replace(/[?#].*$/, "")
      : source;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getCarDetailImagePresentations(car: Partial<CarListing>) {
  const rows = getListingImages(car);
  return getCarDetailImageUrls(car).map((source, index) =>
    makeResponsivePresentation(source, getMetadataDimensions(rows[index]?.image_metadata), "detail")
  );
}

export function getCarThumbnailImagePresentations(car: Partial<CarListing>) {
  const rows = getListingImages(car);
  return getCarDetailImageUrls(car).map((source, index) =>
    makeResponsivePresentation(source, getMetadataDimensions(rows[index]?.image_metadata), "thumb")
  );
}

export const getMainListingImageUrl = getCarCoverImageUrl;
