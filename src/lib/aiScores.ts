export type StoredAiScores = {
  listingQualityScore: number | null;
  photoQualityScore: number | null;
  trustScore: number | null;
};

/**
 * Empty strings and null values mean that AI did not calculate a score. They are
 * intentionally not coerced with Number(), because Number(\"\") and Number(null)
 * both look like a real 0% score.
 */
export function parseOptionalScore(...values: unknown[]): number | null {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && !value.trim()) continue;

    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric)) continue;

    return Math.max(0, Math.min(100, Math.round(numeric)));
  }

  return null;
}

export function parseAiPayload(value: unknown): Record<string, unknown> {
  if (!value) return {};

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }

  return typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function getStoredAiScores(source: Record<string, unknown>): StoredAiScores {
  const analysis = parseAiPayload(source.ai_analysis ?? source.ai_payload);

  return {
    listingQualityScore: parseOptionalScore(
      source.listing_quality_score,
      source.ai_listing_score,
      source.ai_scan_score,
      analysis.listing_quality_score,
      analysis.listing_score,
      analysis.score,
    ),
    photoQualityScore: parseOptionalScore(
      source.photo_quality_score,
      analysis.photo_quality_score,
      analysis.photo_score,
    ),
    trustScore: parseOptionalScore(source.trust_score, analysis.trust_score),
  };
}

export function hasStoredAiAnalysis(source: Record<string, unknown>) {
  const scores = getStoredAiScores(source);
  const analysis = parseAiPayload(source.ai_analysis ?? source.ai_payload);

  return scores.listingQualityScore !== null
    || scores.photoQualityScore !== null
    || scores.trustScore !== null
    || Object.keys(analysis).length > 0
    || Boolean(source.ai_recommendations)
    || Boolean(source.ai_warnings)
    || Boolean(source.ai_missing_fields);
}
