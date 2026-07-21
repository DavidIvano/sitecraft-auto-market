export const DEAL_FINDER_ANALYSIS_VERSION = "deal-finder-v1";
export const DEAL_FINDER_CONFIDENCE_CAP_WITHOUT_COMPARABLES = 0.7;
export const DEAL_FINDER_RECOMMENDATIONS = [
  "HOT_DEAL",
  "CONTACT_NOW",
  "REVIEW",
  "WATCH",
  "SKIP",
  "INSUFFICIENT_DATA",
] as const;

export type DealFinderRecommendation = (typeof DEAL_FINDER_RECOMMENDATIONS)[number];
export type AnalysisStatus = "pending" | "processing" | "completed" | "failed" | "cancelled" | "superseded";
export type AnalysisSnapshot = {
  id: number;
  content_hash: string | null;
  title: string;
  description: string | null;
  price: number | null;
  currency: string;
  brand: string | null;
  model: string | null;
  variant: string | null;
  year: number | null;
  mileage: number | null;
  fuel_type: string | null;
  transmission: string | null;
  power_kw: number | null;
  power_hp: number | null;
  engine_volume: number | null;
  body_type: string | null;
  city: string | null;
  postal_code: string | null;
  published_at: string | null;
  first_seen_at: string;
};
export type PendingAnalysis = {
  id: number;
  listing_id: number;
  status: AnalysisStatus;
  analysis_version: string;
  model: string;
  input_hash: string;
  listing_content_hash: string | null;
  input_snapshot: AnalysisSnapshot;
};
export type StructuredAnalysis = {
  deal_score: number;
  risk_score: number;
  liquidity_score: number;
  data_quality_score: number;
  confidence_score: number;
  positive_signals: string[];
  negative_signals: string[];
  missing_information: string[];
  known_defects: string[];
  recommended_questions: string[];
  recommendation: DealFinderRecommendation;
  ai_summary: string;
};
export type AnalysisUsage = { input_tokens: number; output_tokens: number; total_tokens: number };

const SNAPSHOT_KEYS = [
  "id", "content_hash", "title", "description", "price", "currency", "brand", "model", "variant",
  "year", "mileage", "fuel_type", "transmission", "power_kw", "power_hp", "engine_volume", "body_type",
  "city", "postal_code", "published_at", "first_seen_at",
] as const;
const RESULT_KEYS = [
  "deal_score", "risk_score", "liquidity_score", "data_quality_score", "confidence_score", "positive_signals",
  "negative_signals", "missing_information", "known_defects", "recommended_questions", "recommendation", "ai_summary",
] as const;
const ARRAY_KEYS = ["positive_signals", "negative_signals", "missing_information", "known_defects", "recommended_questions"] as const;

const plainText = (value: unknown, maxLength: number) => typeof value === "string" && value.length <= maxLength && !/<[^>]+>/.test(value);
const nullableText = (value: unknown, maxLength: number) => value === null || plainText(value, maxLength);
const nullableNumber = (value: unknown) => value === null || (typeof value === "number" && Number.isFinite(value));
const timestampText = (value: unknown) => {
  if (plainText(value, 64)) return Number.isFinite(Date.parse(value as string)) ? value as string : null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  try {
    return new Date(value < 100_000_000_000 ? value * 1000 : value).toISOString();
  } catch {
    return null;
  }
};

export function sanitizeAnalysisSnapshot(value: unknown): AnalysisSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const firstSeenAt = timestampText(source.first_seen_at);
  const publishedAt = source.published_at === null ? null : timestampText(source.published_at);
  if (!Number.isInteger(source.id) || Number(source.id) <= 0 || !plainText(source.title, 300) || !plainText(source.currency, 8) || !firstSeenAt || (source.published_at !== null && !publishedAt)) return null;
  for (const key of ["content_hash", "description", "brand", "model", "variant", "fuel_type", "transmission", "body_type", "city", "postal_code"] as const) {
    if (!nullableText(source[key], key === "description" ? 6000 : 300)) return null;
  }
  for (const key of ["price", "year", "mileage", "power_kw", "power_hp", "engine_volume"] as const) if (!nullableNumber(source[key])) return null;
  const safe = {} as Record<string, unknown>;
  for (const key of SNAPSHOT_KEYS) safe[key] = source[key] ?? null;
  safe.published_at = publishedAt;
  safe.first_seen_at = firstSeenAt;
  return safe as AnalysisSnapshot;
}

export function validateStructuredAnalysis(value: unknown): value is StructuredAnalysis {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const output = value as Record<string, unknown>;
  if (Object.keys(output).length !== RESULT_KEYS.length || Object.keys(output).some((key) => !RESULT_KEYS.includes(key as typeof RESULT_KEYS[number]))) return false;
  for (const key of ["deal_score", "risk_score", "liquidity_score", "data_quality_score"] as const) {
    if (!Number.isInteger(output[key]) || Number(output[key]) < 0 || Number(output[key]) > 100) return false;
  }
  if (typeof output.confidence_score !== "number" || !Number.isFinite(output.confidence_score) || output.confidence_score < 0 || output.confidence_score > 1) return false;
  for (const key of ARRAY_KEYS) {
    const items = output[key];
    if (!Array.isArray(items) || items.length > 20 || items.some((item) => !plainText(item, 300))) return false;
  }
  return DEAL_FINDER_RECOMMENDATIONS.includes(output.recommendation as DealFinderRecommendation) && plainText(output.ai_summary, 2000);
}

export function enforceNoComparablesPolicy(value: StructuredAnalysis): StructuredAnalysis {
  return { ...value, confidence_score: Math.min(value.confidence_score, DEAL_FINDER_CONFIDENCE_CAP_WITHOUT_COMPARABLES) };
}

const stringArraySchema = { type: "array", maxItems: 20, items: { type: "string", maxLength: 300 } } as const;
export const DEAL_FINDER_STRUCTURED_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [...RESULT_KEYS],
  properties: {
    deal_score: { type: "integer", minimum: 0, maximum: 100 },
    risk_score: { type: "integer", minimum: 0, maximum: 100 },
    liquidity_score: { type: "integer", minimum: 0, maximum: 100 },
    data_quality_score: { type: "integer", minimum: 0, maximum: 100 },
    confidence_score: { type: "number", minimum: 0, maximum: 1 },
    positive_signals: stringArraySchema,
    negative_signals: stringArraySchema,
    missing_information: stringArraySchema,
    known_defects: stringArraySchema,
    recommended_questions: stringArraySchema,
    recommendation: { type: "string", enum: [...DEAL_FINDER_RECOMMENDATIONS] },
    ai_summary: { type: "string", maxLength: 2000 },
  },
} as const;

export const DEAL_FINDER_DEVELOPER_INSTRUCTION = [
  "Ты анализируешь только предоставленные сохранённые данные объявления автомобиля.",
  "Не выдумывай характеристики, дефекты, рыночную цену, скидку или прибыль.",
  "Без реальных сравнительных объявлений confidence_score не должен превышать 0.70.",
  "Не используй HOT_DEAL при низкой уверенности; при критической нехватке данных используй INSUFFICIENT_DATA.",
  "Отделяй известные дефекты от предположительных рисков. Подозрение не является доказанным дефектом.",
  "Пиши пользовательские строки по-русски и верни только JSON, соответствующий переданной схеме.",
].join(" ");

export function buildOpenAiRequest(model: string, snapshot: AnalysisSnapshot) {
  return {
    model,
    store: false,
    max_output_tokens: 1500,
    reasoning: { effort: "low" },
    input: [
      { role: "developer", content: [{ type: "input_text", text: DEAL_FINDER_DEVELOPER_INSTRUCTION }] },
      { role: "user", content: [{ type: "input_text", text: JSON.stringify(snapshot) }] },
    ],
    text: { format: { type: "json_schema", name: "deal_finder_analysis", strict: true, schema: DEAL_FINDER_STRUCTURED_OUTPUT_SCHEMA } },
  };
}

export function extractResponseOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const response = payload as Record<string, unknown>;
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as Record<string, unknown>).content) ? (item as Record<string, unknown>).content as unknown[] : [];
    for (const part of content) if (part && typeof part === "object" && (part as Record<string, unknown>).type === "output_text" && typeof (part as Record<string, unknown>).text === "string") return (part as Record<string, unknown>).text as string;
  }
  return null;
}

export function safeUsage(value: unknown): AnalysisUsage {
  const usage = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const token = (key: string) => Number.isInteger(usage[key]) && Number(usage[key]) >= 0 ? Number(usage[key]) : 0;
  return { input_tokens: token("input_tokens"), output_tokens: token("output_tokens"), total_tokens: token("total_tokens") };
}
