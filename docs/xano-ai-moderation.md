# Xano AI Moderation

## Endpoint

`POST /ai/moderation/check-listing`

Implementation status: **implemented and live in Xano**.

- Endpoint id: `3981578`
- API group: `sitecraft-auto-market`
- Auth table: `automarket_users` (`861779`)
- Audit table: `ai_listing_checks` (`866229`), `type = moderation_check`
- Model: `$env.OPENAI_MODERATION_MODEL`, then `$env.OPENAI_DEFAULT_MODEL`, fallback `gpt-5.6-luna`
- Rate limit: 100 checks per admin per hour

AI moderation helps the moderator review listing data faster. It does not verify the technical condition of the vehicle and does not replace the final moderator decision.

The endpoint is read-only with respect to listings. It never approves, rejects, blocks, deletes, archives, publishes, or submits a listing. `recommendation` and `suggested_action` are advisory values for a human moderator.

## Authorization

Authentication is required. Xano loads the authenticated user from `automarket_users` by `$auth.id`; it does not read `$auth.role` and does not trust role, user id, or an admin flag from the request body.

Access is allowed when the database user has `role = admin` or the database email is in the configured two-address admin allowlist. Other authenticated users receive `403 Admin access required`; unauthenticated requests receive `401`.

Admin email addresses are not returned or written to `ai_listing_checks`.

## Request

`listing_id` is required. `listing` and `images` are accepted to preserve the frontend contract, but they are not sources of truth. Xano reloads the listing from `car_listings` and active images from `car_listing_images` (`is_deleted != true`).

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
    "description": "..."
  },
  "images": [
    {
      "url": "https://...",
      "id": 123,
      "isMain": true
    }
  ]
}
```

## Response

```json
{
  "success": true,
  "fallback": false,
  "listing_id": 55,
  "risk_level": "medium",
  "trust_score": 72,
  "issues": [
    {
      "field": "price",
      "severity": "warning",
      "message": "Цена выглядит ниже ожидаемой для такого года."
    }
  ],
  "warnings": ["Проверьте цену объявления."],
  "recommendation": "needs_fix",
  "suggested_action": "send_to_fix",
  "summary": "Объявление содержит основные данные, но требует уточнений.",
  "suggested_rejection_reason": "Пожалуйста, уточните данные и добавьте фотографии салона.",
  "moderator_notes": [],
  "model": "gpt-5.6-luna"
}
```

Allowed values:

- `risk_level`: `low`, `medium`, `high`
- `issues[].severity`: `info`, `warning`, `critical`
- `recommendation`: `approve`, `needs_fix`, `reject`, `block`, `manual_review`

## Deterministic Decision Engine

Xano rules calculate all critical issues, warnings, information issues, `trust_score`, `risk_level`, `recommendation`, and `suggested_action`. The score starts at 100 and applies the documented critical/warning/info deductions, explicit photo/contact/status deductions, and bounded completeness bonuses. The result is clamped to 0-100.

OpenAI receives only the already calculated result and a safe subset of listing facts. It may improve `summary`, `moderator_notes`, `suggested_rejection_reason`, and `user_facing_issues`. It cannot replace the deterministic issue list and its output cannot change score, risk, recommendation, or action.

Administrative or final statuses are never presented as automatically approvable. Deleted, blocked, and archived listings receive `manual_review`.

## Fallback

Provider errors, empty output, and invalid JSON return HTTP 200 with the deterministic result, `fallback = true`, and `model = local-rules`. OpenAI failure does not produce a 500 response.

The frontend still has its own local fallback for endpoint `404`, non-OK responses, and network errors.

## Audit Table

`ai_listing_checks`, table id `866229`.

| Field | Type | Notes |
| --- | --- | --- |
| `user_id` | integer | Admin who ran the check |
| `draft_id` | integer nullable | Draft reference when present |
| `car_id` | integer | Listing reference |
| `type` | text | `moderation_check` |
| `score` | integer | Trust-score alias |
| `listing_quality_score` | integer | Trust-score alias for table compatibility |
| `photo_quality_score` | integer | Deterministic photo completeness score |
| `trust_score` | integer | 0-100 |
| `risk_level` | text | `low`, `medium`, `high` |
| `warnings` | json | Warning messages |
| `recommendations` | json | User-facing explanation items |
| `issues` | json | Structured critical/warning/info issues |
| `next_best_actions` | json | Advisory recommendation/action pair |
| `summary` | text | Moderator explanation |
| `model` | text | OpenAI model or `local-rules` |
| `status` | text | `success`, `fallback`, or `error` |
| `error_message` | text | Compact provider/parse error only |
| `raw_ai_payload` | json | Always null for moderation checks |
| `metadata` | json | Statuses, image count, recommendation, action, rules version, fallback |

The log excludes seller name, phone, email, full VIN, raw images, IP, Google profile, OpenAI secrets, and the full raw OpenAI response.

## Errors

- `400` invalid or missing `listing_id`
- `401` authentication required
- `403` admin access required
- `404` listing not found
- `429` more than 100 moderation checks by the same admin in one hour

## Verified Xano Run Scenarios

- Good pending-review fixture: `low`, trust `100`, `approve`, no critical issues or warnings.
- Medium fixture with one image and missing fields: `medium`, trust `73`, `needs_fix`, four warnings.
- Weak existing listing: `high`, several critical issues; administrative status keeps the action at `manual_review`.
- Deleted/blocked listing: `manual_review`, never automatic approve.
- Normal authenticated user: HTTP `403`.
- No auth: HTTP `401`.
- Unknown listing: HTTP `404`.
- Invalid model: HTTP `200`, `fallback = true`, `model = local-rules`.
- Spoofed frontend listing JSON: result matched the backend record; submitted price/city/user data did not affect scoring.

Temporary token/fixture endpoints and fixture rows were deleted after testing.

## Honesty Rules

- AI checks data completeness, consistency, and obvious contradictions.
- AI does not inspect or guarantee the mechanical condition of the car.
- AI does not prove accident history, service history, legal status, or roadworthiness.
- The moderator makes the final decision.
- Public labels should say “AI quality of listing data” or “AI checked data completeness”, not “technically verified”.

Full implementation: `docs/xano-endpoint-post-ai-moderation-check-listing.xs`.
