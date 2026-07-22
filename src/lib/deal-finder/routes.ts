const DEAL_FINDER_DETAIL_PATH = "/dashboard/deal-finder/listing/";

export function normalizeDealFinderListingId(value?: string | null) {
  if (!value || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? String(id) : null;
}

export function detailUrl(id: number | string) {
  const normalizedId = normalizeDealFinderListingId(String(id));
  return normalizedId
    ? `${DEAL_FINDER_DETAIL_PATH}?id=${encodeURIComponent(normalizedId)}`
    : DEAL_FINDER_DETAIL_PATH;
}

export const DEAL_FINDER_RETURN_URL_KEY = "deal-finder:return-url";

export function isSafeDealFinderReturnUrl(value?: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value, "https://automarket.sitecraft.agency");
    return url.pathname.startsWith("/dashboard/deal-finder/")
      && !url.pathname.startsWith("/dashboard/deal-finder/listing/");
  } catch {
    return false;
  }
}

export function normalizeDealFinderReturnUrl(value?: string | null) {
  if (!isSafeDealFinderReturnUrl(value)) return "/dashboard/deal-finder/";
  const url = new URL(value!, "https://automarket.sitecraft.agency");
  return `${url.pathname}${url.search}${url.hash}`;
}
