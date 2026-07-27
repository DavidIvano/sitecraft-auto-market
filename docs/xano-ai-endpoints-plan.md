# Xano AI Endpoints Integration Plan

This plan describes the backend endpoints needed to replace current frontend AI fallbacks with real Xano endpoints. It is based on the current frontend contract in:

- `src/pages/dashboard/new.astro`
- `src/pages/cars/index.astro`
- `src/pages/cars/[slug].astro`
- `src/pages/admin/moderation.astro`
- `src/lib/apiRoutes.ts`
- `src/lib/ai/types.ts`
- `src/lib/types.ts`
- `docs/ai-product-roadmap.md`
- `docs/xano-ai-moderation.md`

Do not change frontend contracts until these endpoints are live and tested.

## Global Rules

- Base API group is `PUBLIC_XANO_API_URL`.
- JSON endpoints must return `Content-Type: application/json`.
- Auth uses `Authorization: Bearer <token>`.
- Seller AI endpoints should be protected by user auth.
- Admin moderation AI endpoint must be protected by admin auth.
- Buyer AI search and listing-view analytics can be public, but should be rate-limited.
- 404 currently triggers frontend fallback for most AI endpoints. After implementing endpoints, do not return 404 for valid routes.
- Error response shape should be consistent:

```json
{
  "message": "Human readable error",
  "code": "VALIDATION_ERROR",
  "details": {}
}
```

## Frontend Route Map

From `src/lib/apiRoutes.ts`:

| Frontend key | Method | Path |
| --- | --- | --- |
| `aiGenerateDescription` | POST | `/ai/listing/generate-description` |
| `aiQualityScore` | POST | `/ai/listing/quality-score` |
| `aiSearchIntent` | POST | `/ai/search/intent` |
| `aiModerationCheck` | POST | `/ai/moderation/check-listing` |
| `listingViewAnalytics` | POST | `/analytics/listing-view` |
| `savedSearches` | POST | `/saved-searches` |
| `listingsCreateDraft` | POST | `/listings/create-draft` |
| `listingsSubmitModeration` | POST | `/listings/submit-moderation` |

## Score Field Naming Risks

The frontend accepts several names for score fields:

- Listing score: `score`, `listing_quality_score`, `listing_score`
- Photo score: `photo_score`, `photo_quality_score`
- Trust score: `trust_score`

Recommended backend response:

```json
{
  "score": 84,
  "listing_quality_score": 84,
  "photo_score": 76,
  "photo_quality_score": 76,
  "trust_score": 81
}
```

This keeps current frontend and future frontend compatible.

## JSON Versus JSON String Fields

These six endpoints use ordinary JSON request bodies.

Important exception outside this plan: `/ai/listing/analyze-photos` and draft/listing creation use `FormData`, and `r2_images`, `image_urls`, `image_keys`, `ai_analysis`, `accepted_ai_suggestions` are sent as JSON strings inside FormData.

For the endpoints in this document:

- `fields`, `analysis`, `images`, `filters_json`, `user_context`, `listing`, `issues` should be real JSON objects/arrays.
- Xano table columns that store these values should use JSON type where possible.
- If an existing Xano table column is text, store `JSON.stringify(...)` only at the final DB write step, not in the response.

## Seller Draft Persistence - implemented

Implementation status as of 2026-07-13:

| Endpoint | ID | Auth | Body |
| --- | ---: | --- | --- |
| `POST /listings/create-draft` | 3982637 | `automarket_users` (table 861779) | `FormData`; JSON values are encoded strings |
| `POST /listings/submit-moderation` | 3982675 | `automarket_users` (table 861779) | JSON `{draft_id, listing_id}` |

### Confirmed frontend contract

`src/pages/dashboard/new.astro` sends create-draft as `FormData`. The following are JSON strings and are decoded with guarded `try_catch` blocks:

- `r2_images`
- `image_urls`
- `image_keys`
- `ai_analysis`
- `accepted_ai_suggestions`

All other confirmed fields are text/bool FormData values. The frontend accepts several legacy ID aliases, but both new endpoints return unambiguous top-level `draft_id` and `listing_id`.

Submit-moderation uses `Content-Type: application/json` and sends:

```json
{
  "draft_id": 123,
  "listing_id": null
}
```

At least one ID is required. Backend data is the source of truth.

### Existing schema mapping

No table was created. The implementation uses:

- `car_drafts` (863714)
- `car_draft_images` (863715)
- `car_listings` (861468)
- `car_listing_images` (861469)
- `automarket_users` (861779)

`car_drafts` contains core vehicle fields but does not contain dedicated country, currency, VIN, doors, seats, seller-contact, accepted-suggestion, or score columns. Those auxiliary values are retained in the existing `ai_payload` JSON. Required seller identity at submit is resolved safely from the owned draft payload and falls back to the authenticated `automarket_users` record; country/currency use the existing project defaults.

### Persistence and status rules

- Create-draft creates or updates only an owned `car_drafts` record and its URL-based `car_draft_images` rows.
- A new confirmed draft has status `draft`; it does not create `car_listings`.
- Draft update keeps the same ID and never changes `user_id`.
- Submit performs strict validation before any listing insert.
- Submit creates or updates one owned listing per `draft_id`, sets `status=pending_review` and `moderation_status=pending_review`, then links the draft using `car_id`.
- Repeated draft or listing submission returns the existing listing with `already_submitted=true`.
- Listing images are copied by public HTTPS URL and de-duplicated by listing ID plus URL.
- Neither endpoint modifies `user_credits` or `credit_transactions`.
- Neither endpoint calls legacy `/ai/generate-listing`, admin routes, approve, or publish logic.

The older `POST /dashboard/drafts/{id}/publish` endpoint was inspected but not reused or modified. Its existing implementation is not idempotent and references an obsolete listing-image field, so the new submit endpoint owns the safe moderation transition.

### Live verification

- Guest create and submit: 401.
- Authenticated create: 200, `draft_id` returned, `listing_id=null`, status `draft`, image row saved.
- Update: 200, same draft ID, no duplicate draft.
- Cross-user update and submit: 403.
- Invalid `r2_images`: 400 with `Invalid r2_images JSON`.
- Incomplete draft submit: 400 with six structured field errors; no partial listing.
- Valid submit: 200, one listing and one image, both listing statuses `pending_review`.
- Repeated draft submit and listing-only retry: 200, same listing ID, `already_submitted=true`.
- Public catalog excludes the test listing; direct public slug returns 404.
- Credits remained 10 before/after create and submit.
- Disposable users and all related database rows were deleted after testing.

Full XanoScript:

- `docs/xano-endpoint-post-listings-create-draft.xs`
- `docs/xano-endpoint-post-listings-submit-moderation.xs`

## Tables To Create

### `ai_listing_checks` - implemented

Stores quality-score and moderation checks.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | integer | Primary key |
| `created_at` | timestamp | Xano now |
| `updated_at` | timestamp | Xano now |
| `user_id` | integer | Current auth user |
| `car_id` | integer nullable | Published listing id when available |
| `draft_id` | integer nullable | Draft id when available |
| `type` | text | `quality_score`, `moderation_check` |
| `score` | integer | 0-100 listing score alias |
| `listing_quality_score` | integer | 0-100 |
| `photo_quality_score` | integer | 0-100 |
| `trust_score` | integer | 0-100 |
| `risk_level` | text nullable | `low`, `medium`, `high` |
| `warnings` | json nullable | Array |
| `recommendations` | json nullable | Array |
| `next_best_actions` | json nullable | Array |
| `issues` | json nullable | Critical issues array |
| `summary` | text nullable | Seller-facing summary |
| `model` | text nullable | Explanation model |
| `status` | text | `success`, `fallback`, or `error` |
| `error_message` | text nullable | Compact provider/parse error |
| `raw_ai_payload` | json nullable | Structured explanation response only |
| `metadata` | json nullable | Photo count, scoring version, fallback flag |

Xano table id: `866229`.

Privacy: the table does not store email, phone, Google profile, raw IP, image bytes, or base64 photos.

### `listing_views`

Stores public listing-view analytics. This table is ready for `POST /analytics/listing-view`.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | integer | Primary key |
| `created_at` | timestamp | Xano now |
| `updated_at` | timestamp | Xano now |
| `car_id` | integer nullable | Listing id |
| `slug` | text | Required by endpoint |
| `session_id` | text | Required by endpoint, browser-generated |
| `user_id` | integer nullable | Optional if token exists later |
| `source` | text nullable | Referrer |
| `search_params` | text nullable | URL query string |
| `viewed_at` | timestamp | Client timestamp |
| `user_agent` | text nullable | Optional, do not store if not needed |
| `ip_hash` | text nullable | Optional hashed IP only, no raw IP |
| `metadata` | json nullable | Optional sanitized metadata |

Privacy notes:

- Do not store email, phone, Google profile, or real name.
- This table is only for on-site behavior analytics.
- For the first implementation, leave `user_agent` and `ip_hash` empty unless there is a clear need.
- Dedupe rule: do not create a new row if the same `slug` and `session_id` already exist in the last 10 minutes.

### `saved_searches`

Stores buyer saved searches.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | integer | Primary key |
| `user_id` | integer | Required |
| `query_text` | text | Natural language query |
| `filters_json` | json | Applied filters |
| `ai_summary` | text nullable | AI explanation |
| `notify_enabled` | boolean | Default false |
| `created_at` | timestamp | Xano now |
| `updated_at` | timestamp | Xano now |

### `ai_suggestions`

Stores generated seller suggestions when useful for audit or future learning.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | integer | Primary key |
| `user_id` | integer nullable | Current user |
| `car_id` | integer nullable | Listing id |
| `draft_id` | integer nullable | Draft id |
| `type` | text | `description`, `next_best_action`, etc. |
| `target` | text | `description`, `title`, field name |
| `label` | text | UI label |
| `text` | text | Suggested text |
| `accepted` | boolean | Optional |
| `created_at` | timestamp | Xano now |

### `user_ai_preferences`

Optional table for future personalization. Do not infer from Google account data.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | integer | Primary key |
| `user_id` | integer | Required |
| `preferred_brands` | json | Array |
| `preferred_body_types` | json | Array |
| `preferred_fuel_types` | json | Array |
| `preferred_cities` | json | Array |
| `updated_at` | timestamp | Xano now |

### `ai_search_logs` - implemented

Stores public AI buyer-search requests and their normalized catalog filters.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | integer | Primary key |
| `created_at` | timestamp | Xano now |
| `updated_at` | timestamp | Xano now |
| `query_text` | text | Search text entered on the marketplace |
| `filters_json` | json nullable | Normalized frontend-compatible filters |
| `current_filters` | json nullable | Filters already active in the catalog |
| `user_context` | json nullable | On-site preferences supplied by frontend only |
| `explanation` | text nullable | Buyer-facing AI explanation |
| `confidence` | decimal nullable | Value from 0 to 1 |
| `suggestions` | json nullable | Array of 2-4 short follow-up suggestions |
| `model` | text nullable | OpenAI model used for the request |
| `status` | text | `success`, `fallback`, or `error` |
| `error_message` | text nullable | Compact provider or parse error |
| `metadata` | json nullable | `fallback`, `parse_status`, and model only |

Xano table id: `866224`.

Privacy: do not store email, phone, Google profile, real name, or raw IP in this table.

### `ai_description_generations` - implemented

Stores seller description generations separately from full AI draft generation and credit events.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | integer | Primary key |
| `created_at` | timestamp | Xano now |
| `updated_at` | timestamp | Xano now |
| `user_id` | integer | Authenticated seller |
| `draft_id` | integer nullable | Draft id when provided |
| `car_id` | integer nullable | Listing id when provided |
| `mode` | text | One of six supported modes |
| `language` | text nullable | `ru` or `de` |
| `input_fields` | json | Sanitized normalized vehicle facts |
| `analysis_summary` | json nullable | Missing fields, warnings, recommendations |
| `image_count` | integer | Number of safe HTTPS images sent, max 4 |
| `output_title` | text nullable | Generated/suggested title |
| `output_description` | text | Final description |
| `warnings` | json nullable | Array |
| `recommendations` | json nullable | Array |
| `facts_used` | json nullable | Human-readable fact labels |
| `omitted_fields` | json nullable | Omitted/unconfirmed areas |
| `model` | text nullable | Provider model or `local-template` |
| `status` | text | `success`, `fallback`, or `error` |
| `fallback` | boolean | Local template flag |
| `error_message` | text nullable | Compact provider/parse error |
| `metadata` | json nullable | Counts and generation version only |

Xano table id: `866234`.

Privacy: no email, phone, Google profile, raw IP, full VIN, image bytes/base64, auth headers, or secrets are stored.

## 1. POST `/ai/listing/generate-description`

### Implementation Status

Implemented and live in Xano on 2026-07-11.

- Xano endpoint id: `3981498`
- Xano table: `ai_description_generations`, id `866234`
- API group: `sitecraft-auto-market` (`jAAj839u`)
- Auth: `automarket_users` (`861779`)
- Provider: OpenAI Responses API with strict JSON Schema
- Model: `$env.OPENAI_LISTING_MODEL`, then `$env.OPENAI_DEFAULT_MODEL`, fallback `gpt-5.6-luna`
- Local fallback model label: `local-template`
- Full XanoScript artifact: `docs/xano-endpoint-post-ai-listing-generate-description.xs`

### Auth

Required user auth.

### Frontend Request

Sent from `/dashboard/new/` when the seller clicks AI description actions.

```json
{
  "fields": {
    "title": "BMW 320d Touring",
    "brand": "BMW",
    "model": "320d Touring",
    "year": "2006",
    "mileage": "160000",
    "price": "4000",
    "city": "Ilsede",
    "country": "Германия",
    "vehicle_type": "Легковой автомобиль",
    "body_type": "Универсал",
    "color": "Серебристый",
    "fuel_type": "Дизель",
    "engine_volume": "2.0",
    "transmission": "Автомат",
    "doors": "5",
    "seats": "5",
    "vin": "",
    "description": ""
  },
  "analysis": {
    "detected_fields": {},
    "confidence": {},
    "missing_fields": [],
    "warnings": [],
    "recommendations": []
  },
  "r2_images": [
    {
      "url": "https://...",
      "key": "listing-images/user-1/a.webp",
      "contentType": "image/webp",
      "size": 812345
    }
  ],
  "mode": "sales"
}
```

Allowed `mode` values from frontend:

- `sales`
- `short`
- `technical`
- `de`
- `kleinanzeigen`
- `whatsapp`

### Expected Response

```json
{
  "description": "BMW 320d Touring в продаже. 2006 год, дизель, автомат, пробег 160 000 км...",
  "suggested_description": "BMW 320d Touring в продаже. 2006 год...",
  "title": "BMW 320d Touring 2006",
  "mode": "sales",
  "warnings": [],
  "recommendations": [
    "Добавьте фото салона и приборной панели."
  ]
}
```

Frontend uses:

- `description` first
- fallback to `suggested_description`
- `mode`
- `warnings`
- `recommendations`

### Xano Tables

- Uses dedicated `ai_description_generations` rather than the older `ai_generation_logs` table.
- The older table is tied to full draft generation, raw provider payloads, and credit balances; mixing these events would make billing and audit data ambiguous.
- Logs normalized facts, compact analysis, safe image count, output, model, status, and fallback state.

### Errors

- HTTP 401 without `automarket_users` auth.
- HTTP 400 when `fields` is missing/empty, mode is unsupported, or more than eight image records are submitted.
- HTTP 429 after 20 successful/fallback generations for the authenticated user within one hour.
- Provider, empty-output, schema/mode, and JSON parse errors return HTTP 200 with a useful local template and `fallback=true`.

### Current Frontend Fallback

- If `PUBLIC_USE_AI_LISTING_ENDPOINTS` is false: local description builder.
- If endpoint returns `404`: local description builder.
- If endpoint returns non-OK except 404: visible error message.

### Xano Run Test

Live tests passed with a normal `automarket_users` token:

1. `sales`: Russian honest sales description, `description=suggested_description`.
2. `short`: compact Russian description containing key facts only.
3. `technical`: neutral Russian description without technical promises.
4. `de`: German description with `language=de`.
5. `kleinanzeigen`: German marketplace text without phone/email, fake guarantees, or invented `Privatverkauf`.
6. `whatsapp`: short German message without personal data.
7. Unsupported mode and missing fields returned HTTP 400; missing auth returned HTTP 401.
8. `blob:` and `data:` images were excluded and reported in warnings while text generation continued.
9. A temporary invalid-model test returned HTTP 200, `fallback=true`, non-empty local description, and `model=local-template`.
10. A temporary forced-limit test returned HTTP 429. All temporary endpoints were deleted.

### Fact, Image, Fallback, And Credit Policies

- Only normalized vehicle fields, compact analysis, and safe photo context are sent to OpenAI. Seller contacts, auth profile, and full VIN are excluded.
- The prompt explicitly forbids invented service history, owners, TÜV/HU, accident history, technical condition, equipment, guarantees, market value, and legal claims.
- Only public `https://` image URLs are accepted; `blob:`, `data:`, localhost, and base64 are ignored. At most the first four safe images are sent.
- A deterministic per-mode description is built before the provider call. It remains the response if the provider fails, output is empty, JSON is invalid, description is empty, or returned mode does not match.
- Rate limit is database-backed by `user_id`: 20 successful/fallback generations per rolling hour. Raw IP is not used.
- The endpoint does not read or write `user_credits` or `credit_transactions`; text previews and translations do not spend credits.

Full implementation: `docs/xano-endpoint-post-ai-listing-generate-description.xs`.

## 2. POST `/ai/listing/quality-score`

### Implementation Status

Implemented and live in Xano on 2026-07-11.

- Xano endpoint id: `3981478`
- Xano table: `ai_listing_checks`, id `866229`
- API group: `sitecraft-auto-market` (`jAAj839u`)
- Auth: `automarket_users` (`861779`)
- Deterministic scoring version: `quality-v1`
- OpenAI model: `$env.OPENAI_LISTING_MODEL`, then `$env.OPENAI_DEFAULT_MODEL`, fallback `gpt-5.6-luna`
- Full XanoScript artifact: `docs/xano-endpoint-post-ai-listing-quality-score.xs`

### Auth

Required user auth.

### Frontend Request

```json
{
  "fields": {
    "title": "BMW 320d Touring",
    "brand": "BMW",
    "model": "320d Touring",
    "year": "2006",
    "mileage": "160000",
    "price": "4000",
    "city": "Ilsede",
    "fuel_type": "Дизель",
    "transmission": "Автомат",
    "body_type": "Универсал",
    "description": "..."
  },
  "analysis": {
    "missing_fields": [],
    "warnings": [],
    "recommendations": []
  },
  "photo_count": 3,
  "images": [
    {
      "url": "https://...",
      "key": "listing-images/user-1/a.webp",
      "contentType": "image/webp",
      "size": 812345
    }
  ]
}
```

### Expected Response

```json
{
  "score": 84,
  "listing_quality_score": 84,
  "photo_score": 76,
  "photo_quality_score": 76,
  "trust_score": 81,
  "missing_fields": [
    "seller_phone"
  ],
  "warnings": [
    "Добавьте больше фото салона."
  ],
  "recommendations": [
    "Уточните комплектацию и сервисную историю."
  ],
  "next_best_actions": [
    {
      "label": "Добавьте фото салона",
      "impact": "+12",
      "action": "upload_more_photos",
      "field": "photos",
      "explanation": "Фото салона повышают доверие покупателей."
    }
  ]
}
```

Frontend uses:

- `score` or `listing_quality_score`
- `photo_score` or `photo_quality_score`
- `trust_score`
- `warnings`
- `recommendations`
- `next_best_actions`

### Xano Tables

- Every successful or provider-fallback calculation is stored in `ai_listing_checks` with `type=quality_score`.
- Stores score aliases, photo score, trust score, critical issues, warnings, recommendations, next actions, summary, model, status, and compact metadata.
- `draft_id` and `car_id` are stored only when present in the supported payload paths.
- Images are not copied into this table; metadata stores only `photo_count`.

### Errors

- `401 Unauthorized - Authentication Required` without `automarket_users` auth.
- `400 fields is required` when `fields` is missing, empty, or not an object.
- `400` when `photo_count` is outside 0-8 or `images` contains more than 8 entries.
- OpenAI provider and JSON parse errors return HTTP 200 with deterministic scores and `fallback=true`.

### Current Frontend Fallback

- If `PUBLIC_USE_AI_LISTING_ENDPOINTS` is false: local `calculateListingQualityScore`.
- If endpoint returns `404`: local `calculateListingQualityScore`.
- Non-OK except 404: visible error message.

### Xano Run Test

Live tests passed with a normal `automarket_users` token:

1. Complete BMW listing with four public WebP images: listing `88`, photo `78`, trust `99`, no critical issues.
2. Invalid listing with missing brand/model, future year, negative mileage, zero price, numeric city, and no photos: `0/0/0`, seven critical issues, six prioritized next actions.
3. Partial Volkswagen listing with one photo and short description: listing `58`, photo `50`, trust `40`, recommendations for more photos and description.
4. No auth returned HTTP 401; missing fields returned HTTP 400.
5. A temporary invalid-model test returned HTTP 200, `fallback=true`, and unchanged local scores. The temporary endpoint was deleted.

### Scoring And OpenAI Roles

- Listing quality is calculated from deterministic field, description, image, VIN, and critical-issue rules, then clamped to 0-100.
- Photo quality is calculated locally from count, public URLs, image content types, modern formats, and a 70/30 blend with an optional analysis signal.
- Trust measures completeness and consistency only. It applies deterministic deductions for issues, warnings, missing fields, confidence, disallowed auto-fill, and missing content.
- OpenAI receives the completed numeric scores and cannot change them. It only rewrites recommendations, summary, and action explanations using strict JSON Schema.
- Provider errors, empty output, and invalid JSON retain local recommendations/actions and return `fallback=true`.
- This endpoint does not read or write `user_credits`; repeated quality checks do not spend AI credits.

Full implementation: `docs/xano-endpoint-post-ai-listing-quality-score.xs`.

## 3. POST `/ai/search/intent`

### Implementation Status

Implemented and live in Xano on 2026-07-11.

- Xano endpoint id: `3981451`
- Xano table: `ai_search_logs`, id `866224`
- API group: `sitecraft-auto-market` (`jAAj839u`)
- Auth: public (`false`)
- Provider: OpenAI Responses API
- Model: `$env.OPENAI_MODERATION_MODEL`, then `$env.OPENAI_DEFAULT_MODEL`, fallback `gpt-5.6-luna`
- Full XanoScript artifact: `docs/xano-endpoint-post-ai-search-intent.xs`

### Auth

Public endpoint. Optional auth can be added later, but current frontend sends no token.

### Frontend Request

```json
{
  "query": "семейный дизель до 7000 € рядом с Braunschweig",
  "current_filters": {
    "brand": "BMW",
    "price_max": "7000"
  },
  "user_context": {
    "recent_views": [
      {
        "car_id": 55,
        "slug": "bmw-7-series-2012-1783382162",
        "title": "BMW 7 Series",
        "brand": "BMW",
        "model": "7 Series",
        "body_type": "Седан",
        "fuel_type": "Дизель",
        "price": 4000,
        "city": "Ilsede",
        "viewed_at": "2026-07-11T02:00:00.000Z"
      }
    ],
    "preferred_brands": [
      "BMW"
    ],
    "preferred_body_types": [
      "Седан"
    ],
    "preferred_fuel_types": [
      "Дизель"
    ],
    "preferred_cities": [
      "Ilsede"
    ]
  }
}
```

### Expected Response

```json
{
  "filters": {
    "brand": "BMW",
    "model": null,
    "body_type": "Универсал",
    "fuel_type": "Дизель",
    "transmission": null,
    "price_min": null,
    "price_max": 7000,
    "year_min": null,
    "year_max": null,
    "mileage_max": null,
    "city": "Braunschweig"
  },
  "explanation": "Показаны дизельные семейные автомобили до 7000 € рядом с Braunschweig.",
  "confidence": 0.82,
  "suggestions": [
    "семейный дизель до 7000 €",
    "универсал автомат до 9000 €"
  ]
}
```

Frontend uses:

- `filters`
- `explanation`
- `confidence`
- `suggestions`

### Xano Tables

- Every accepted request is written to `ai_search_logs`.
- Validation failures are also written with `status=error` before Xano returns HTTP 400.
- Stored fields: query, normalized filters, current filters, on-site user context, explanation, confidence, suggestions, model, status, compact error, and compact metadata.
- No auth user id is stored in the first version.
- Do not store email, phone, Google profile, real name, raw IP, or hidden account profiling.

### Errors

- `400 query is required` if query is empty.
- `400 query must contain at least 3 characters` if query is too short.
- `400 query is too long` if query exceeds 500 characters.
- OpenAI provider and JSON parse errors return HTTP 200 with `success: true`, `fallback: true`; they do not surface a provider 500 to the buyer.

### Current Frontend Fallback

- If no API URL, endpoint fails, endpoint returns 404, or network fails: local `parseCarSearchIntent`.
- Frontend still applies filters from fallback.

### Xano Run Test

Live tests passed without an Authorization header:

1. `Ищу дизельный универсал до 7000 евро рядом с Braunschweig` returned `fuel_type=Дизель`, `body_type=Универсал`, `price_max=7000`, `city=Braunschweig`.
2. `BMW автомат до 10000 евро` returned `brand=BMW`, `transmission=Автомат`, `price_max=10000`.
3. `семейный минивэн на бензине до 9000` returned `body_type=Минивэн`, `fuel_type=Бензин`, `price_max=9000`.
4. Empty, 2-character, and 501-character queries returned HTTP 400.
5. A temporary invalid-model test returned HTTP 200 with `fallback=true`, confidence `0.45`, and compatible null filters. The temporary test endpoint was deleted.

### XanoScript Blueprint

The endpoint sends `query`, `current_filters`, and `user_context` to the OpenAI Responses API with strict JSON Schema. Brand, body type, fuel type, transmission, numeric bounds, confidence, and suggestion count are constrained by the schema before parsing.

`output_text` is read first from `response.result.output[0].content[0].text`, with `response.result.output_text` as a secondary location. JSON decoding runs inside `try_catch`. Provider errors, empty output, and JSON decoding errors retain the prebuilt frontend-compatible fallback response and are logged with compact `parse_status` metadata.

Full implementation: `docs/xano-endpoint-post-ai-search-intent.xs`.

## 4. POST `/ai/moderation/check-listing` - implemented

Implementation status as of 2026-07-11:

- Xano endpoint id: `3981578`.
- API group: `sitecraft-auto-market`.
- Auth: `automarket_users` (`861779`), admin-only.
- Audit table: `ai_listing_checks` (`866229`), `type = moderation_check`.
- Active model: `$env.OPENAI_DEFAULT_MODEL`, currently `gpt-5.6-luna`.
- Xano rules own score, risk, issues, recommendation, and action.
- OpenAI only improves human-readable explanation fields.
- Provider failure returns HTTP 200 deterministic fallback.
- No listing status mutation or admin action is called.

### Auth

Required `automarket_users` auth. Xano loads the database user by `$auth.id`; `$auth.role` is not used. Access requires database `role = admin` or a configured admin-email allowlist match.

### Frontend Request

```json
{
  "listing_id": 55,
  "listing": {
    "id": 55,
    "title": "BMW 7 Series",
    "brand": "BMW",
    "model": "7 Series",
    "year": 2012,
    "price": 4000,
    "mileage": 300000,
    "city": "ilsede",
    "fuel_type": "Дизель",
    "transmission": "Автомат",
    "description": "BMW 7 Series в продаже..."
  },
  "images": [
    {
      "id": 123,
      "url": "https://...",
      "isMain": true,
      "sortOrder": 0
    }
  ]
}
```

### Expected Response

```json
{
  "risk_level": "medium",
  "trust_score": 72,
  "issues": [
    {
      "field": "price",
      "severity": "warning",
      "message": "Цена выглядит ниже ожидаемой. Проверьте данные вручную."
    }
  ],
  "recommendation": "needs_fix",
  "suggested_action": "send_to_fix",
  "suggested_rejection_reason": "Пожалуйста, уточните пробег, город и добавьте фото салона.",
  "warnings": [
    "Нет фото салона."
  ]
}
```

Allowed values:

- `risk_level`: `low`, `medium`, `high`
- `issues[].severity`: `info`, `warning`, `critical`
- `recommendation`: `approve`, `needs_fix`, `reject`, `block`, `manual_review`

### Xano Tables

- `car_listings`: backend source of truth for the listing.
- `car_listing_images`: backend source of active images.
- `automarket_users`: admin lookup by `$auth.id`.
- `ai_listing_checks` (`866229`): audit log with `type = moderation_check`.

### Errors

- `400` invalid or missing `listing_id`
- `401` authentication required
- `403` admin access required
- `404` listing not found
- `429` 100 checks per admin per hour exceeded

OpenAI errors do not return 500; they return HTTP 200 with `fallback = true` and deterministic moderation fields.

### Current Frontend Fallback

- If endpoint returns `404`: local `runModerationFallback`.
- If endpoint throws/network fails: local `runModerationFallback`.
- If non-OK non-404: catch also runs local fallback and shows an endpoint unavailable note.

### Xano Run Test

Verified on endpoint `3981578`:

1. Good pending-review fixture: `low`, trust `100`, `approve`, no critical issues.
2. Medium fixture: `medium`, trust `73`, `needs_fix`, `send_to_fix`.
3. Weak listing: `high`, several critical issues.
4. Blocked/deleted listing: `manual_review`.
5. Normal authenticated user: HTTP `403`.
6. No auth: HTTP `401`.
7. Missing listing: HTTP `404`.
8. Invalid model: HTTP `200`, `fallback = true`, `model = local-rules`.
9. Spoofed `listing` JSON: backend data won; the result matched the unspoofed request.

Test fixtures and temporary helper endpoints were deleted.

### XanoScript Blueprint

The implementation loads `automarket_users`, `car_listings`, and `car_listing_images` from Xano; applies deterministic critical/warning/info checks; calculates bounded trust, risk, recommendation, and action; optionally calls the Responses API with strict JSON Schema; falls back locally; and writes a privacy-reduced audit row.

Full XanoScript: `docs/xano-endpoint-post-ai-moderation-check-listing.xs`.

## 5. POST `/analytics/listing-view` - ready for Xano

Implementation status as of 2026-07-11:

- Implemented in Xano.
- Xano table: `listing_views`, id `866168`.
- Xano endpoint: `POST /analytics/listing-view`, id `3981281`.
- Endpoint is public (`auth: false`) and lives in API group `sitecraft-auto-market`.
- Live API test passed: first request returns `tracked: true`, immediate repeated request returns `deduped: true`.
- No frontend change or production deploy was needed for this endpoint.

### Auth

Public endpoint. Current frontend sends no `Authorization` header.

### Frontend Request

Sent from `/cars/[slug]/`.

```json
{
  "car_id": 55,
  "slug": "bmw-7-series-2012-1783382162",
  "session_id": "scam_abc123",
  "source": "https://sitecraft-auto-market.pages.dev/cars/",
  "search_params": "?brand=BMW",
  "viewed_at": "2026-07-11T02:00:00.000Z",
  "metadata": {
    "test": true
  }
}
```

Fields currently sent by frontend:

- `car_id`
- `slug`
- `session_id`
- `source`
- `search_params`
- `viewed_at`

`metadata` is supported by the Xano endpoint plan for future use, but the current frontend does not send it.

### Expected Response

Frontend does not use the response body, but the backend should always return normal JSON.

Tracked response:

```json
{
  "success": true,
  "tracked": true,
  "deduped": false,
  "view_id": 1001
}
```

Dedupe response:

```json
{
  "success": true,
  "deduped": true,
  "tracked": false,
  "message": "View already tracked recently"
}
```

Validation error:

```json
{
  "success": false,
  "message": "slug and session_id are required"
}
```

### Xano Tables

- `listing_views`

Required fields:

- `slug`
- `session_id`
- `created_at`

Nullable fields:

- `car_id`
- `user_id`
- `source`
- `search_params`
- `viewed_at`
- `user_agent`
- `ip_hash`
- `metadata`

Privacy:

- Do not store email, phone, Google profile, or real name.
- Do not store raw IP on the first implementation.
- If IP is used later, store only a salted hash.

### Errors

- `400 VALIDATION_ERROR` when `slug` or `session_id` is empty
- `429 RATE_LIMITED`
- `500 SERVER_ERROR`

### Current Frontend Fallback

- View is always saved in browser `localStorage` first.
- If endpoint is missing, returns 404, or fails, frontend only logs a warning.
- No visible user error.

### Dedupe Rule

Before inserting, query `listing_views` for a row where:

- `slug == input.slug`
- `session_id == input.session_id`
- `created_at >= now - 10 minutes`

If a row exists, return:

```json
{
  "success": true,
  "deduped": true,
  "tracked": false,
  "message": "View already tracked recently"
}
```

Do not insert a second row.

### Xano Run Test

1. No Authorization header required.
2. Send this request JSON:

```json
{
  "car_id": 55,
  "slug": "bmw-3-series-2012-test",
  "session_id": "test-session-123",
  "source": "https://sitecraft-auto-market.pages.dev/cars",
  "search_params": "?fuel_type=Дизель&price_max=7000",
  "viewed_at": "2026-07-11T12:00:00.000Z",
  "metadata": {
    "test": true
  }
}
```

3. Verify row appears in `listing_views`.
4. Run the same request immediately again.
5. Verify the second response returns `deduped: true` and does not create another row.

### XanoScript Blueprint

```text
body = request.body
slug = trim(body.slug)
session_id = trim(body.session_id)
if slug == "" return 400 { success: false, message: "slug and session_id are required" }
if session_id == "" return 400 { success: false, message: "slug and session_id are required" }
recent = query listing_views where slug == slug and session_id == session_id and created_at >= now - 10 minutes limit 1
if recent exists return { success: true, deduped: true, tracked: false, message: "View already tracked recently" }
insert listing_views {
  car_id,
  slug,
  session_id,
  source,
  search_params,
  viewed_at,
  metadata,
  created_at: now,
  updated_at: now
}
return { success: true, tracked: true, deduped: false, view_id }
```

Full XanoScript artifact:

- `docs/xano-endpoint-post-analytics-listing-view.xs`

## 6. POST `/saved-searches`

Implementation status as of 2026-07-11:

- Implemented in Xano.
- Xano table: `saved_searches`, id `866178`.
- Xano endpoint: `POST /saved-searches`, id `3981320`.
- Endpoint requires `automarket_users` auth.
- `filters_json` is saved as a JSON object, not a JSON string.
- Duplicate/update rule: same `user_id + query_text + is_active=true` updates the existing row.
- `filters_hash` column exists for a future duplicate rule based on normalized filters.
- Live API tests passed: unauthenticated request returns 401, first authenticated request creates a row, repeated authenticated request updates it.
- No frontend change or production deploy was needed for this endpoint.

### Auth

Required user auth.

### Frontend Request

```json
{
  "query_text": "семейный дизель до 7000 €",
  "filters_json": {
    "brand": "BMW",
    "fuel_type": "Дизель",
    "price_max": "7000",
    "city": "Braunschweig"
  },
  "ai_summary": "Показаны дизельные семейные автомобили до 7000 €.",
  "notify_enabled": false
}
```

### Expected Response

Frontend only checks `response.ok`, but the backend returns useful JSON.

Create response:

```json
{
  "success": true,
  "saved": true,
  "updated": false,
  "saved_search_id": 1,
  "message": "Search saved"
}
```

Duplicate/update response:

```json
{
  "success": true,
  "saved": true,
  "updated": true,
  "saved_search_id": 1,
  "message": "Saved search updated"
}
```

### Xano Tables

- `saved_searches`

Fields:

- `user_id`
- `query_text`
- `filters_json`
- `ai_summary`
- `notify_enabled`
- `is_active`
- `last_checked_at`
- `last_notified_at`
- `matches_count`
- `filters_hash`
- `metadata`

Privacy:

- Do not store email, phone, Google profile, or raw IP.

### Errors

- `401 AUTH_REQUIRED`
- `400 VALIDATION_ERROR`
- `409 DUPLICATE_SEARCH` optional
- `429 RATE_LIMITED`
- `500 SERVER_ERROR`

### Current Frontend Fallback

- If user is not logged in: frontend asks user to log in.
- If no API URL: frontend says saved searches are coming soon.
- If endpoint returns `404` or request fails: frontend says saved searches are coming soon.

### Xano Run Test

1. Without Authorization header, endpoint returns 401.
2. Add Authorization header for an `automarket_users` user.
3. Send request JSON.
4. Verify first response returns `saved: true`, `updated: false`.
5. Repeat the same request.
6. Verify repeated response returns `saved: true`, `updated: true` and the same `saved_search_id`.
7. Verify row is attached to auth user id.
8. Verify `filters_json` remains JSON, not a broken string.

### XanoScript Blueprint

```text
auth = require automarket_users
query_text = trim(body.query_text || "")
filters_json = body.filters_json
if filters_json is missing return 400
notify_enabled = body.notify_enabled == true
existing = query saved_searches where user_id == auth.id and is_active == true and query_text != "" and query_text == query_text limit 1
if existing:
  update existing with filters_json, ai_summary, notify_enabled, updated_at
  return { success: true, saved: true, updated: true, saved_search_id: existing.id, message: "Saved search updated" }
insert saved_searches with user_id, query_text, filters_json, ai_summary, notify_enabled, is_active=true
return { success: true, saved: true, updated: false, saved_search_id: saved.id, message: "Search saved" }
```

Full XanoScript artifact:

- `docs/xano-endpoint-post-saved-searches.xs`

## Implementation Priority

1. `/analytics/listing-view`
   - Simple, public, enables buyer personalization data.
2. `/ai/search/intent`
   - Implemented: endpoint `3981451`, table `ai_search_logs` (`866224`).
3. `/saved-searches`
   - Converts AI search into user retention; requires auth.
4. `/ai/listing/quality-score`
   - Implemented: endpoint `3981478`, table `ai_listing_checks` (`866229`).
5. `/ai/listing/generate-description`
   - Implemented: endpoint `3981498`, table `ai_description_generations` (`866234`).
6. `/ai/moderation/check-listing`
   - Implemented: endpoint `3981578`, admin-only, deterministic decision engine, OpenAI explanation layer, fallback, rate limit, and privacy-reduced logging.

## Main Integration Risks

- Score aliases: return both `score` and `listing_quality_score`, plus both `photo_score` and `photo_quality_score`.
- `filters_json` must remain JSON in Xano, not a double-encoded string.
- `/ai/search/intent` is public in frontend; do not require auth unless frontend is changed.
- `/analytics/listing-view` is public; rate-limit by IP/session.
- `/ai/moderation/check-listing` requires a database admin/allowlist check after auth; request-body role/user fields are ignored.
- Do not claim technical vehicle verification in AI text.
- AI provider failures return deterministic HTTP 200 fallback for moderation, quality score, search intent, and description generation.
- If Xano returns 404 during rollout, frontend will keep using fallback, which can hide backend configuration mistakes.

## Protected Versus Public Summary

| Endpoint | Auth |
| --- | --- |
| `POST /ai/listing/generate-description` | User auth required |
| `POST /ai/listing/quality-score` | User auth required |
| `POST /ai/search/intent` | Public, rate-limited |
| `POST /ai/moderation/check-listing` | Admin auth required |
| `POST /analytics/listing-view` | Public, rate-limited |
| `POST /saved-searches` | User auth required |

## Canonical listing and TÜV/HU integration (2026-07-14)

The frontend and Xano now use one normalized listing contract. Canonical fields include `drivetrain`, `owners_count`, `first_registration`, `vehicle_condition`, seller type/contact fields, VIN, `has_valid_tuv`, and `tuv_valid_until`. Legacy aliases are accepted only at the normalization boundary.

- `POST /ai/listing/analyze-photos` (`3979609`) returns the complete normalized field object plus confidence and field-source maps. Unknown sensitive/document values are null with `manual_required`.
- `POST /listings/create-draft` (`3982637`) stores the canonical fields without requiring a complete listing.
- `POST /listings/submit-moderation` (`3982675`) validates and copies the same fields into `car_listings`.
- `POST /ai/listing/quality-score` (`3981478`) applies deterministic TÜV/HU consistency rules; OpenAI cannot change the numeric scores.
- `POST /ai/listing/generate-description` (`3981498`) may mention TÜV/HU only when structured confirmed values are supplied.

TÜV/HU uses nullable `has_valid_tuv` and nullable `YYYY-MM` `tuv_valid_until`. AI inference from vehicle appearance, age, registration plate, or general model data is forbidden. Even document-photo suggestions require explicit user confirmation.
