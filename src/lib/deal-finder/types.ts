export type DealFinderPlatform = "kleinanzeigen";
export type DealFinderSourceType = "kleinanzeigen_agent" | "manual_json" | "mock" | "email";

export type DealFinderSourceStatus =
  | "active"
  | "source_removed"
  | "expired"
  | "unknown";

export type DealFinderUserStatus =
  | "new"
  | "viewed"
  | "saved"
  | "hidden"
  | "contacted"
  | "rejected";

export type DealFinderRecommendation =
  | "HOT_DEAL"
  | "CONTACT_NOW"
  | "REVIEW"
  | "WATCH"
  | "SKIP"
  | "INSUFFICIENT_DATA";

export type DealFinderAnalysisStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "superseded";

export type DealFinderEmailStatus = "pending" | "processing" | "processed" | "failed" | "ignored";
export type DealFinderImageStatus = "available" | "unavailable" | "unknown" | "placeholder";
export type DealFinderSort =
  | "newest"
  | "oldest"
  | "price_asc"
  | "price_desc"
  | "deal_score_desc"
  | "deal_score_asc"
  | "profit_desc"
  | "last_checked_asc";

export type DealFinderSearch = {
  id: number;
  user_id?: number;
  name: string;
  platform: DealFinderPlatform | string;
  source_type?: DealFinderSourceType | string;
  source_config?: Record<string, unknown> | null;
  email_subject_pattern?: string | null;
  search_url?: string | null;
  brand?: string | null;
  model?: string | null;
  price_min?: number | null;
  price_max?: number | null;
  year_min?: number | null;
  year_max?: number | null;
  mileage_max?: number | null;
  mileage_min?: number | null;
  fuel_types: string[];
  transmissions: string[];
  postal_code?: string | null;
  location_id?: string | null;
  location_name?: string | null;
  category_id?: string | null;
  radius_km?: number | null;
  required_keywords: string[];
  excluded_keywords: string[];
  minimum_deal_score: number;
  picture_required?: boolean;
  seller_types?: string[];
  sync_enabled?: boolean;
  sync_interval_minutes?: number | null;
  last_sync_at?: string | null;
  next_sync_at?: string | null;
  last_sync_status?: string | null;
  last_sync_error?: string | null;
  is_active: boolean;
  last_email_at?: string | null;
  last_listing_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type DealFinderEmail = {
  id: number;
  gmail_message_id: string;
  gmail_thread_id?: string | null;
  sender?: string | null;
  recipient?: string | null;
  subject?: string | null;
  received_at?: string | null;
  body_text?: string | null;
  processing_status: DealFinderEmailStatus;
  processing_error?: string | null;
  content_hash?: string | null;
  links_found: string[];
  images_found: string[];
  processed_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type DealFinderListing = {
  id: number;
  user_id?: number;
  search_id?: number | null;
  email_id?: number | null;
  platform: DealFinderPlatform | string;
  external_id: string;
  source_url: string;
  title: string;
  description?: string | null;
  price?: number | null;
  currency: string;
  brand?: string | null;
  model?: string | null;
  variant?: string | null;
  year?: number | null;
  mileage?: number | null;
  fuel_type?: string | null;
  transmission?: string | null;
  power_kw?: number | null;
  power_hp?: number | null;
  engine_volume?: number | null;
  body_type?: string | null;
  color?: string | null;
  city?: string | null;
  postal_code?: string | null;
  distance_km?: number | null;
  source_image_url?: string | null;
  source_images?: string[];
  image_status: DealFinderImageStatus;
  published_at?: string | null;
  first_seen_at: string;
  last_seen_at: string;
  last_checked_at?: string | null;
  source_status: DealFinderSourceStatus;
  user_status: DealFinderUserStatus;
  unavailable_checks: number;
  is_new: boolean;
  is_saved: boolean;
  is_viewed: boolean;
  is_hidden: boolean;
  content_hash?: string | null;
  raw_data?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  analysis?: DealFinderAnalysis | null;
};

export type DealFinderAnalysis = {
  id: number;
  listing_id: number;
  status: DealFinderAnalysisStatus;
  market_price_low?: number | null;
  market_price_average?: number | null;
  market_price_high?: number | null;
  repair_cost_low?: number | null;
  repair_cost_high?: number | null;
  potential_profit_low?: number | null;
  potential_profit_high?: number | null;
  discount_percent?: number | null;
  deal_score?: number | null;
  risk_score?: number | null;
  liquidity_score?: number | null;
  data_quality_score?: number | null;
  confidence_score?: number | null;
  positive_signals: string[];
  negative_signals: string[];
  missing_information: string[];
  known_defects: string[];
  recommended_questions: string[];
  recommendation?: DealFinderRecommendation | null;
  ai_summary?: string | null;
  analysis_status?: DealFinderAnalysisStatus;
  model?: string | null;
  model_used?: string | null;
  analysis_version?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  failed_at?: string | null;
  analyzed_at?: string | null;
  error_code?: string | null;
  retry_count?: number;
  created_at?: string;
  updated_at?: string;
};

export type DealFinderAnalyzeResponse = {
  analysis: Pick<DealFinderAnalysis, "id" | "listing_id" | "status" | "created_at"> & {
    reused: boolean;
  };
};

export type DealFinderListingDetails = {
  listing: DealFinderListing;
  analysis: DealFinderAnalysis | null;
  search: DealFinderSearch | null;
  email?: Pick<DealFinderEmail, "id" | "subject" | "received_at" | "processing_status"> | null;
  allowed_actions: {
    view: boolean;
    save: boolean;
    hide: boolean;
    reanalyze: boolean;
  };
};

export type DealFinderWorkspacePayload = {
  decision: "undecided" | "contact" | "watch" | "skip";
  contact_status: "not_contacted" | "planned" | "contacted" | "waiting" | "closed";
  contact_channel: "none" | "phone" | "email" | "message";
  next_action_at: string | null;
  note: string;
};

export type DealFinderListingState = Pick<
  DealFinderListing,
  "id" | "user_status" | "is_new" | "is_saved" | "is_viewed" | "is_hidden"
>;

export type DealFinderStats = {
  active: number;
  new: number;
  saved: number;
  hidden: number;
  hot: number;
  analysis_pending: number;
  source_removed: number;
  last_sync_at?: string | null;
};

export type DealFinderSyncLog = {
  id: number;
  job_type: "manual_seed" | "email_ingestion" | "email_parsing" | "source_check" | "ai_analysis" | "cleanup";
  status: "pending" | "running" | "completed" | "failed" | "partial";
  emails_found: number;
  emails_processed: number;
  listings_found: number;
  listings_created: number;
  listings_updated: number;
  duplicates_found: number;
  listings_removed: number;
  error_message?: string | null;
  metadata?: Record<string, unknown> | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at?: string;
};

export type DealFinderPagination = {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
};

export type DealFinderListResponse = {
  data: DealFinderListing[];
  pagination: DealFinderPagination;
};

export type DealFinderFilters = {
  page?: number;
  per_page?: number;
  search?: string;
  search_id?: number;
  brand?: string;
  model?: string;
  price_min?: number;
  price_max?: number;
  year_min?: number;
  year_max?: number;
  mileage_max?: number;
  fuel_type?: string;
  transmission?: string;
  source_status?: DealFinderSourceStatus;
  user_status?: DealFinderUserStatus;
  deal_score_min?: number;
  deal_score_max?: number;
  is_saved?: boolean;
  is_new?: boolean;
  is_hidden?: boolean;
  sort?: DealFinderSort;
};

export type DealFinderSearchInput = Omit<DealFinderSearch, "id" | "user_id" | "created_at" | "updated_at" | "last_email_at" | "last_listing_at">;

export class DealFinderApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "DealFinderApiError";
  }
}
