export type {
  AiAnalyzePhotosResponse,
  AiAutoFillAllowed,
  AcceptedAiSuggestion,
  AiDescriptionMode,
  AiDraftState,
  AiFieldConfidence,
  AiFieldSources,
  AiGeneratedDescriptionResponse,
  AiModerationCheckResponse,
  AiModerationIssue,
  AiModerationRiskLevel,
  AiModerationState,
  AiNextBestAction,
  AiNormalizedFields,
  AiQualityScore,
  AiQualityScoreResponse,
  AiBuyerUserContext,
  AiSearchFilters,
  AiSearchIntentRequest,
  AiSearchIntentResponse,
  AiSuggestion,
  AiUploadedImage,
} from "./ai/types";

export type CarListingStatus =
  | "draft"
  | "ai_draft"
  | "ready_for_review"
  | "pending_review"
  | "approved"
  | "published"
  | "rejected"
  | "needs_fix"
  | "archived"
  | "blocked"
  | "deleted"
  | "sold";

export type ListingTranslationStatus = "completed" | "processing" | "failed" | "missing" | "stale";

export type ListingTranslatableContent = {
  title?: string;
  description?: string | null;
  city?: string;
  seo_title?: string;
  seo_description?: string;
  image_alt_texts?: string[];
  ai_highlights?: string[];
  ai_recommendations?: string[];
  ai_warnings?: string[];
};

export type CarListingTranslation = ListingTranslatableContent & {
  id?: number;
  locale: string;
  requested_locale?: string;
  resolved_locale?: string;
  source_locale?: string;
  source_hash?: string;
  resolved_source_hash?: string;
  status: ListingTranslationStatus;
  translation_status?: "source" | "translated" | "unavailable" | "stale" | "pending" | "failed";
  readiness?: "ready";
  translation_version?: number;
  is_fallback?: boolean;
  updated_at?: string | number;
};

export type ListingTranslationMeta = {
  requested_locale: string;
  content_locale: string;
  source_locale: string;
  fallback_locale?: string;
  status: ListingTranslationStatus;
  used_fallback: boolean;
};

export type ListingLifecycleStatus = CarListingStatus | "unknown";

export type ModerationStatus =
  | "pending_review"
  | "needs_fix"
  | "approved"
  | "rejected"
  | "blocked"
  | null
  | "unknown";

export type ModerationQueueGroup =
  | "all"
  | "pending"
  | "needs_fix"
  | "approved"
  | "rejected"
  | "blocked"
  | "conflict"
  | "archived"
  | "sold";

export type TranslationResolution = {
  requested_locale: string;
  resolved_locale: string;
  source_locale: string;
  is_fallback: boolean;
  status: "original" | "machine_translated" | "reviewed" | "missing" | "outdated" | "pending" | "failed";
  translation_status?: "source" | "translated" | "unavailable" | "stale" | "pending" | "failed";
  translation_version?: number;
  source_hash?: string;
  resolved_source_hash?: string;
  updated_at?: string | number;
};

export type ListingTranslation = {
  locale_code: string;
  title: string;
  description: string;
  seo_title?: string;
  seo_description?: string;
  translation_status: string;
  source_hash: string;
};

export type CarListing = {
  id: number;
  user_id?: number;
  slug: string;
  title: string;
  locale?: string;
  source_locale?: string;
  translation_version?: number;
  translations_ready?: boolean;
  available_locales?: string[];
  translation?: TranslationResolution | CarListingTranslation | null;
  brand: string;
  model: string;
  vehicle_type?: string;
  body_type?: string;
  color?: string;
  condition?: string;
  vehicle_condition?: string;
  year: number;
  mileage: number;
  fuel_type: string;
  engine_volume?: string;
  transmission: string;
  seats?: number | string;
  doors?: number | string;
  drivetrain?: string;
  owner_count?: string;
  owners_count?: string | number;
  first_registration?: string;
  first_registration_date?: string;
  tuv_hu?: string;
  tuv_until?: string;
  hu_until?: string;
  has_valid_tuv?: boolean | null;
  tuv_valid_until?: string | null;
  vin?: string;
  vin_masked?: string;
  price: number;
  currency: string;
  city: string;
  country: string;
  seller_name?: string;
  seller_phone?: string;
  seller_email?: string;
  description?: string | null;
  status: CarListingStatus;
  moderation_status?:
    | "draft"
    | "ai_draft"
    | "ready_for_review"
    | "pending_review"
    | "approved"
    | "published"
    | "rejected"
    | "needs_fix"
    | "archived"
    | "blocked"
    | "deleted"
    | "sold";
  sold_at?: string | number;
  deleted_at?: string | number;
  moderator_approved?: boolean;
  validation_status?: string;
  critical_errors?: string[] | string;
  can_submit_to_review?: boolean;
  price_status?: string;
  boosted_at?: string | number | null;
  boosted_until?: string | number | null;
  featured_at?: string | number | null;
  featured_until?: string | number | null;
  homepage_at?: string | number | null;
  homepage_until?: string | number | null;
  last_promoted_at?: string | number | null;
  views_total?: number;
  views_unique?: number;
  views_7d?: number;
  last_viewed_at?: string | number | null;
  published_at?: string | number;
  promotion_status?: "pending" | "active" | "expired" | "cancelled" | "refunded" | "failed";
  promotion_type?: "premium" | "featured" | "boost" | string;
  promotion_placement?: "catalog" | "homepage" | "catalog_and_homepage" | string;
  promotion_priority?: number;
  promotion_started_at?: string | number;
  promotion_ends_at?: string | number;
  promotion?: Partial<Pick<import("./promotions/model").ListingPromotion, "id" | "plan_code" | "promotion_type" | "placement" | "status" | "priority" | "starts_at" | "ends_at">>;
  seller_type?: "private" | "dealer";
  seller?: PublicSellerSummary;
  seller_listings?: CarListing[];
  is_saved?: boolean;
  saved_at?: string | number | null;
  dealer_profile_id?: number;
  dealer_plan?: "none" | "basic" | "pro" | "business";
  dealer_verified?: boolean;
  is_ai_generated?: boolean;
  ai_analysis?: unknown;
  ai_payload?: unknown;
  ai_highlights?: string[] | string;
  ai_listing_score?: number | string;
  ai_recommendations?: string[] | string;
  ai_warnings?: string[] | string;
  ai_missing_fields?: string[] | string;
  ai_confidence?: Record<string, number> | string;
  ai_status?: string;
  ai_scan_status?: string;
  ai_scan_score?: number | string;
  ai_scan_badges?: string[] | string;
  ai_scan_errors_json?: unknown;
  ai_scan_warnings_json?: unknown;
  ai_scan_recommendations_json?: unknown;
  ai_scan_last_checked_at?: string | number;
  ai_scan_recommendation?: string;
  listing_quality_score?: number | string;
  photo_quality_score?: number | string;
  trust_score?: number | string;
  seo_title?: string;
  seo_description?: string;
  image_alt_texts?: string[] | string;
  search_keywords?: string[] | string;
  translation_meta?: ListingTranslationMeta;
  original_content?: ListingTranslatableContent;
  seller_rating?: number | string;
  user_rating?: number | string;
  main_image_url?: string;
  thumbnail_url?: string;
  primary_image_url?: string;
  image_url?: string;
  cover_image_url?: string;
  image_urls?: string[] | string;
  image_keys?: string[] | string;
  images?: CarListingImage[];
  created_at?: string | number;
  updated_at?: string | number;
};

export type PublicSellerSummary = {
  name: string;
  type: "private" | "dealer";
  city?: string;
  active_listings_count: number;
  contact: PublicSellerContact | null;
};

export type PublicSellerContact = {
  phone?: string | null;
  phone_href?: string | null;
  email?: string | null;
  email_href?: string | null;
  preferred_method?: "phone" | "email" | null;
  // Legacy public DTO retained while the Xano endpoint is migrated.
  type?: "phone" | "email";
  href?: string;
};

export type SellerContactProfile = {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  show_phone: boolean;
  show_email: boolean;
  preferred_contact_method: "phone" | "email" | null;
};

export type SellerContactSubmission = {
  display_name: string;
  contact_phone: string;
  contact_email: string;
  show_phone: boolean;
  show_email: boolean;
  preferred_contact_method: "phone" | "email" | null;
};

export type XanoFileMetadata = {
  name?: string;
  path?: string;
  size?: number;
  type?: string;
  mime?: string;
  url?: string;
  key?: string;
  provider?: string;
  meta?: {
    width?: number;
    height?: number;
  };
};

export type CarListingImage = {
  id: number;
  car_listing_id: number;
  image?: XanoFileMetadata;
  image_url?: string;
  image_key?: string;
  mime_type?: string;
  original_filename?: string;
  size_bytes?: number;
  image_metadata?: XanoFileMetadata | Record<string, unknown>;
  sort_order: number;
  is_main: boolean;
  is_primary?: boolean;
  is_deleted?: boolean;
  created_at?: string | number;
};

export type CarDraft = Partial<CarListing> & {
  id: number;
  user_id?: number;
  status?: "draft" | "ai_draft" | "ready_for_review" | "published" | "pending_review" | "archived";
  confidence?: number;
  ai_notes?: string;
  raw_ai_response?: unknown;
  images?: CarListingImage[];
};

export type PaidProductType = "one_time" | "subscription" | "credits";

export type PaidProduct = {
  id?: number;
  slug: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  type: PaidProductType;
  duration_days?: number;
  credits_amount?: number;
  active_listing_limit?: number;
  monthly_ai_credits?: number;
  dealer_priority?: number;
  is_active?: boolean;
  sort_order?: number;
};

export type PurchaseStatus =
  | "pending"
  | "paid"
  | "active"
  | "expired"
  | "cancelled"
  | "failed"
  | "refunded";

export type UserPurchase = {
  id: number;
  user_id?: number;
  product_id?: number;
  product_slug?: string;
  product?: PaidProduct;
  car_id?: number;
  status: PurchaseStatus;
  amount_cents?: number;
  currency?: string;
  payment_provider?: string;
  payment_session_id?: string;
  payment_order_id?: string;
  starts_at?: string | number;
  expires_at?: string | number;
  created_at?: string | number;
  updated_at?: string | number;
};

export type CreditTransaction = {
  id: number;
  type: "purchase" | "usage" | "monthly_subscription_grant" | "refund" | "admin_adjustment" | "free_grant" | "spend" | "promotion_purchase";
  amount: number;
  balance_before?: number;
  balance_after?: number;
  listing_id?: number;
  promotion_id?: number;
  idempotency_key?: string;
  status?: "pending" | "completed" | "failed";
  description?: string;
  related_purchase_id?: number;
  related_car_id?: number;
  notes?: string;
  created_at?: string | number;
};

export type UserCredits = {
  ai_credits: number;
  free_ai_credits?: number;
  paid_ai_credits?: number;
  ai_credits_total?: number;
  free_ai_credits_granted?: boolean;
  free_ai_credits_granted_at?: string | number;
  ai_credits_used_total?: number;
  ai_daily_generations?: number;
  ai_monthly_generations?: number;
  ai_daily_reset_date?: string;
  ai_monthly_reset_date?: string;
  last_monthly_reset_at?: string | number;
  transactions?: CreditTransaction[];
};

export type DealerProfile = {
  id?: number;
  user_id?: number;
  company_name?: string;
  logo_url?: string;
  website_url?: string;
  phone?: string;
  whatsapp?: string;
  city?: string;
  address?: string;
  description?: string;
  dealer_plan?: "none" | "basic" | "pro" | "business";
  plan_expires_at?: string | number;
  is_verified?: boolean;
  status?: "draft" | "active" | "suspended";
  created_at?: string | number;
  updated_at?: string | number;
};
