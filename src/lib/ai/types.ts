export type AiDraftState =
  | "idle"
  | "uploading"
  | "analyzing"
  | "review"
  | "confirmed"
  | "submitting"
  | "submitted"
  | "error";

export type AiNormalizedFields = Partial<{
  title: string;
  brand: string;
  model: string;
  year: number | string;
  color: string;
  body_type: string;
  vehicle_type: string;
  fuel_type: string;
  transmission: string;
  drivetrain: string;
  doors: number | string;
  seats: number | string;
  engine_volume: string;
  owners_count: number | string;
  first_registration: string;
  vehicle_condition: string;
  seller_type: string;
  seller_name: string;
  seller_phone: string;
  seller_email: string;
  vin: string;
  has_valid_tuv: boolean | "true" | "false" | null;
  tuv_valid_until: string | null;
  mileage: number | string;
  price: number | string;
  currency: string;
  city: string;
  country: string;
  description: string;
}>;

export type AiFieldName = keyof AiNormalizedFields | string;

export type AiFieldConfidence = Partial<Record<AiFieldName, number>>;

export type AiAutoFillAllowed = Partial<Record<AiFieldName, boolean>>;

export type AiFieldSources = Partial<Record<AiFieldName, "photo" | "ocr" | "user" | "xano" | "derived" | string>>;

export type AiSuggestion = {
  type?: string;
  field?: AiFieldName;
  target?: AiFieldName | "message_template";
  text?: string;
  value?: string | number | boolean | null;
  label?: string;
  reason?: string;
  confidence?: number;
  source?: string;
};

export type AiQualityScore = {
  score?: number;
  listing_score?: number;
  listing_quality_score?: number;
  photo_score?: number;
  photo_quality_score?: number;
  trust_score?: number;
  missing_fields?: string[];
  warnings?: string[];
  recommendations?: string[];
  next_best_actions?: AiNextBestAction[];
};

export type AiQualityScoreResponse = AiQualityScore;

export type AiDescriptionMode = "sales" | "short" | "technical" | "de" | "kleinanzeigen" | "whatsapp";

export type AiGeneratedDescriptionResponse = {
  description?: string;
  suggested_description?: string;
  title?: string;
  mode?: AiDescriptionMode;
  warnings?: string[];
  recommendations?: string[];
};

export type AiNextBestAction = {
  label: string;
  impact?: string;
  action?: string;
  field?: string;
  explanation?: string;
};

export type AcceptedAiSuggestion = {
  type: string;
  label: string;
  target: string;
  text: string;
  accepted_at: string;
};

export type AiSearchFilters = {
  brand?: string | null;
  model?: string | null;
  body_type?: string | null;
  fuel_type?: string | null;
  transmission?: string | null;
  price_min?: number | null;
  price_max?: number | null;
  year_min?: number | null;
  year_max?: number | null;
  mileage_max?: number | null;
  city?: string | null;
};

export type AiBuyerUserContext = {
  recent_views?: Array<Record<string, unknown>>;
  preferred_brands?: string[];
  preferred_body_types?: string[];
  preferred_fuel_types?: string[];
  price_min?: number | null;
  price_max?: number | null;
  preferred_cities?: string[];
};

export type AiSearchIntentRequest = {
  query: string;
  current_filters?: Record<string, unknown>;
  user_context?: AiBuyerUserContext;
};

export type AiSearchIntentResponse = {
  filters: AiSearchFilters;
  explanation?: string;
  confidence?: number;
  suggestions?: string[];
};

export type AiModerationRiskLevel = "low" | "medium" | "high";

export type AiModerationIssue = {
  field?: string;
  severity: "info" | "warning" | "critical";
  message: string;
};

export type AiModerationCheckResponse = {
  risk_level?: AiModerationRiskLevel;
  trust_score?: number;
  issues?: AiModerationIssue[];
  recommendation?: "approve" | "needs_fix" | "reject" | "block" | "manual_review";
  suggested_action?: string;
  suggested_rejection_reason?: string;
  warnings?: string[];
  raw?: unknown;
};

export type AiModerationState = {
  loading: boolean;
  error?: string;
  result?: AiModerationCheckResponse;
};

export type AiUploadedImage = {
  url: string;
  key: string;
  contentType: string;
  size: number;
};

export type AiAnalyzePhotosResponse = {
  success: boolean;
  draft_id?: number;
  draft?: Record<string, unknown>;
  images?: AiUploadedImage[];
  ai_credits?: number;
  normalized_fields?: AiNormalizedFields;
  field_confidence?: AiFieldConfidence;
  auto_fill_allowed?: AiAutoFillAllowed;
  field_sources?: AiFieldSources;
  missing_fields?: string[];
  warnings?: string[];
  recommendations?: string[];
  insert_suggestions?: AiSuggestion[];
  photo_quality_score?: number;
  listing_score?: number;
  trust_score?: number;
  ai_notes?: string;
  [key: string]: unknown;
};
