import assert from "node:assert/strict";
import { test } from "node:test";
import { getStoredAiScores, hasStoredAiAnalysis, parseOptionalScore } from "../src/lib/aiScores.ts";

test("missing AI scores stay absent instead of becoming a false 0 percent", () => {
  assert.equal(parseOptionalScore(null, "", undefined), null);
  assert.deepEqual(getStoredAiScores({}), {
    listingQualityScore: null,
    photoQualityScore: null,
    trustScore: null,
  });
  assert.equal(hasStoredAiAnalysis({}), false);
});

test("stored canonical scores win over legacy aliases and are constrained to 0-100", () => {
  const scores = getStoredAiScores({
    listing_quality_score: "92",
    ai_listing_score: "17",
    photo_quality_score: 88.4,
    trust_score: 104,
  });

  assert.deepEqual(scores, {
    listingQualityScore: 92,
    photoQualityScore: 88,
    trustScore: 100,
  });
});

test("legacy AI payload scores are accepted only when they are actually present", () => {
  const scores = getStoredAiScores({
    ai_payload: JSON.stringify({
      listing_score: 79,
      photo_score: "81",
      trust_score: "85",
    }),
  });

  assert.deepEqual(scores, {
    listingQualityScore: 79,
    photoQualityScore: 81,
    trustScore: 85,
  });
  assert.equal(hasStoredAiAnalysis({ ai_payload: JSON.stringify({ score: 79 }) }), true);
});
