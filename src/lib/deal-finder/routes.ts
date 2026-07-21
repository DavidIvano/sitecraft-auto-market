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
