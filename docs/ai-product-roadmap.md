# SiteCraft Auto Market AI Product Roadmap

## Product Position

SiteCraft Auto Market uses AI as a practical assistant for sellers, buyers, and moderators. AI should make listings faster to create, easier to understand, and safer to publish, while the seller remains responsible for the final data.

Core promise:

- Sellers create a stronger listing from photos.
- Buyers search in natural language and see clearer listing quality.
- Moderators get structured checks instead of reading everything manually.
- SEO content is generated from real listing data, with safe fallbacks.

## Current Foundation

- AI draft flow can create and improve a listing from uploaded photos.
- Listing quality score is shown as a percentage and is based on data completeness, not mechanical condition.
- AI Generated badge is shown only when listing data marks the listing as AI-created.
- AI trust and moderation signals are visible in catalog and detail pages when data exists.
- Detail pages can use SEO title, SEO description, image alt texts, and AI highlights with fallbacks.

## Seller AI Roadmap

### Phase 1: Faster Listing Creation

- Upload 1-8 photos.
- AI extracts brand, model, body type, color, fuel, transmission, and visible condition cues.
- Seller confirms the fields before publishing.
- AI credits are consumed only when generation succeeds.

### Phase 2: Listing Quality Assistant

- Show filled fields, fields that need confirmation, and missing fields.
- Suggest better title and description text.
- Explain why the score is below 100 percent.
- Warn when photos or data look inconsistent.

### Phase 3: Seller Performance

- Show which listings have weak photos, missing specs, or low buyer interest.
- Recommend adding photos, lowering price, or improving description.
- Provide one-click improvements that still require seller approval.

## Buyer AI Roadmap

### Phase 1: Natural Search

- Buyer writes: "family diesel under 5000 in Berlin".
- AI converts text into filters.
- Buyer can see and edit applied filters.

### Phase 2: Smart Match

- Explain why a car is recommended.
- Highlight practical reasons: similar budget, same city, low mileage, family body type.
- Avoid saying that AI verified technical condition unless a real inspection exists.

### Phase 3: Buyer Shortlist

- Save compared cars.
- Summarize differences between selected cars.
- Warn about missing details before contacting seller.

## Moderation AI Roadmap

### Phase 1: Structured Review

- Show risk level, warnings, missing fields, and suggested rejection text.
- Keep dangerous actions separated from normal approve/reject actions.
- Never auto-approve based only on AI.

### Phase 2: Consistency Checks

- Compare title, photos, price, mileage, year, fuel, and description.
- Flag suspicious mismatch between declared data and visible evidence.
- Track moderation reasons for future quality scoring.

## SEO AI Roadmap

### Phase 1: Safe Metadata

- Use `seo_title` and `seo_description` from Xano when present.
- Fallback to brand, model, year, city, mileage, price, fuel, and transmission.
- Use image alt text from data when present.

### Phase 2: Search Enrichment

- Store `search_keywords` for brand/model/body/fuel/city combinations.
- Generate useful, non-spammy page snippets.
- Keep descriptions readable and based on verified listing data.

## Suggested Data Fields

### `car_listings`

- `is_ai_generated`
- `ai_payload`
- `ai_highlights`
- `ai_listing_score`
- `listing_quality_score`
- `photo_quality_score`
- `trust_score`
- `ai_recommendations`
- `ai_warnings`
- `ai_missing_fields`
- `seo_title`
- `seo_description`
- `image_alt_texts`
- `search_keywords`

### `ai_usage_logs`

- `user_id`
- `car_listing_id`
- `draft_id`
- `action`
- `credits_before`
- `credits_after`
- `status`
- `error_message`
- `created_at`

## Endpoint Principles

- AI generation should return normalized fields and confidence.
- Credit deduction should happen server-side after successful AI generation.
- Failed generation should not consume credits.
- Public endpoints should never expose private AI prompts or seller-sensitive data.
- Moderation endpoints should require admin access.

## Xano Endpoints Needed

- `POST /ai/listing/analyze-photos`
- `POST /ai/listing/generate-description`
- `POST /ai/listing/quality-score`
- `POST /ai/search/intent`
- `POST /analytics/listing-view`
- `POST /saved-searches`
- `POST /ai/moderation/check-listing`

## Suggested Xano Tables

- `ai_listing_checks`
- `listing_views`
- `saved_searches`
- `user_ai_preferences`
- `ai_suggestions`

## Honest AI Copy Rules

- Say "AI helps" instead of "AI guarantees".
- Say "quality of listing data" instead of "quality of car".
- Say "needs confirmation" when data comes from image recognition.
- Do not show empty AI panels.
- Do not show 100 percent unless listing completeness really supports it.

## Future Ideas

- AI price range based on similar approved listings.
- Duplicate listing detection.
- Buyer comparison summaries.
- Dealer inventory quality dashboard.
- Photo quality coaching before upload.
- Multilingual listing translation for German, Russian, Ukrainian, and English.
