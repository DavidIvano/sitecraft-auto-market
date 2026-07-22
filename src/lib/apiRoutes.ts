export const API_ROUTES = {
  authMe: "/auth/me",
  authLogin: "/auth/login",
  authRegister: "/auth/register",
  googleInit: "/oauth/google/init",
  googleContinue: "/oauth/google/continue",

  cars: "/cars",
  carBySlug: (slug: string) => `/cars/${encodeURIComponent(slug)}`,
  carSellerListings: (slug: string) => `/cars/${encodeURIComponent(slug)}/seller-listings`,
  carSubmit: (id: number | string) => `/cars/${id}/submit`,

  dashboardListings: "/dashboard/listings",
  dashboardListing: (id: number | string) => `/dashboard/listings/${id}`,
  dashboardListingDelete: (id: number | string) => `/dashboard/listings/${id}/delete`,
  dashboardListingPromote: (id: number | string) => `/dashboard/listings/${encodeURIComponent(String(id))}/promote`,
  dashboardSummary: "/dashboard/summary",
  dashboardCreditTransactions: "/dashboard/credits/transactions",

  dashboardDraft: (id: number | string) => `/dashboard/drafts/${id}`,
  dashboardDraftPublish: (id: number | string) => `/dashboard/drafts/${id}/publish`,

  credits: "/me/credits",
  purchases: "/me/purchases",
  purchaseCreate: "/purchases/create",
  purchaseApply: "/purchases/apply",

  aiGenerateListing: "/ai/generate-listing",
  aiAnalyzePhotos: "/ai/listing/analyze-photos",
  aiGenerateDescription: "/ai/listing/generate-description",
  aiQualityScore: "/ai/listing/quality-score",
  aiSearchIntent: "/ai/search/intent",
  aiModerationCheck: "/ai/moderation/check-listing",
  listingViewAnalytics: "/analytics/listing-view",
  savedSearches: "/saved-searches",
  listingsCreateDraft: "/listings/create-draft",
  listingsSubmitModeration: "/listings/submit-moderation",

  dealFinderStats: "/deal-finder/stats",
  dealFinderListings: "/deal-finder/listings",
  dealFinderListing: (id: number | string) => `/deal-finder/listings/${encodeURIComponent(String(id))}`,
  dealFinderListingView: (id: number | string) => `/deal-finder/listings/${encodeURIComponent(String(id))}/view`,
  dealFinderListingSave: (id: number | string) => `/deal-finder/listings/${encodeURIComponent(String(id))}/save`,
  dealFinderListingUnsave: (id: number | string) => `/deal-finder/listings/${encodeURIComponent(String(id))}/unsave`,
  dealFinderListingHide: (id: number | string) => `/deal-finder/listings/${encodeURIComponent(String(id))}/hide`,
  dealFinderListingRestore: (id: number | string) => `/deal-finder/listings/${encodeURIComponent(String(id))}/restore`,
  dealFinderListingAnalyze: (id: number | string) => `/deal-finder/listings/${encodeURIComponent(String(id))}/analyze`,
  dealFinderListingTranslateDescription: (id: number | string) => `/deal-finder/listings/${encodeURIComponent(String(id))}/translate-description`,
  dealFinderListingWorkspace: (id: number | string) => `/deal-finder/listings/${encodeURIComponent(String(id))}/workspace`,
  dealFinderComparison: "/deal-finder/comparison",
  dealFinderNotificationPreferences: "/deal-finder/notifications/preferences",
  dealFinderNotificationDeliveries: "/deal-finder/notifications/deliveries",
  dealFinderSearches: "/deal-finder/searches",
  dealFinderSearch: (id: number | string) => `/deal-finder/searches/${encodeURIComponent(String(id))}`,
  dealFinderSyncLogs: "/deal-finder/sync-logs",

  adminModeration: "/admin/moderation",
  adminCarApprove: (id: number | string) => `/admin/cars/${id}/approve`,
  adminCarReject: (id: number | string) => `/admin/cars/${id}/reject`,
  adminCarDelete: (id: number | string) => `/admin/cars/${id}/delete`,
  adminCarSold: (id: number | string) => `/admin/cars/${id}/sold`,
  adminCarArchive: (id: number | string) => `/admin/cars/${id}/archive`,
  adminCarBlock: (id: number | string) => `/admin/cars/${id}/block`,
  adminCarRestore: (id: number | string) => `/admin/cars/${id}/restore`,
  adminCarAssignOwner: (id: number | string) => `/admin/cars/${id}/assign-owner`,
  adminCarImageDelete: (carId: number | string, imageId: number | string) =>
    `/admin/cars/${carId}/images/${imageId}/delete`,
  adminCarImagePrimary: (carId: number | string, imageId: number | string) =>
    `/admin/cars/${carId}/images/${imageId}/primary`,

  dealerProfile: "/dealer-profile",
  dealerProfileUpdate: "/dealer-profile/update",
} as const;

export const LOCAL_ROUTES = {
  uploadListingImages: "/api/upload-listing-images",
  r2Image: (key: string) => `/api/r2-images/${key.replace(/^\/+/, "")}`,
} as const;

export const BACKEND_ROUTES_REQUIRING_XANO_WORK = [
  "POST /ai/listing/analyze-photos",
  "POST /ai/listing/generate-description",
  "POST /ai/listing/quality-score",
  "POST /ai/search/intent",
  "POST /ai/moderation/check-listing",
  "POST /analytics/listing-view",
  "POST /saved-searches",
  "POST /deal-finder/searches",
  "PATCH /deal-finder/searches/{id}",
  "DELETE /deal-finder/searches/{id}",
  "GET /deal-finder/sync-logs",
  "POST /listings/create-draft",
  "POST /listings/submit-moderation",
  "POST /purchases/create",
  "POST /purchases/apply",
  "GET /me/purchases",
  "PATCH /admin/cars/{id}/archive",
  "PATCH /admin/cars/{id}/block",
  "PATCH /admin/cars/{id}/restore",
  "PATCH /admin/cars/{id}/images/{imageId}/delete",
  "PATCH /admin/cars/{id}/images/{imageId}/primary",
] as const;

export function getXanoApiUrl() {
  return String(import.meta.env.PUBLIC_XANO_API_URL || "").replace(/\/+$/, "");
}

export function isXanoConfigured(apiUrl = getXanoApiUrl()) {
  return /^https?:\/\//.test(apiUrl);
}

export function buildApiUrl(path: string, apiUrl = getXanoApiUrl()) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  if (!isXanoConfigured(apiUrl)) {
    return cleanPath;
  }

  return `${apiUrl}${cleanPath}`;
}

export function getMissingEndpointMessage(route: string) {
  return `Endpoint ${route} ещё нужно добавить или проверить в Xano. Действие временно недоступно.`;
}
