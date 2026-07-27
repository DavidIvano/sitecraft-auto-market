# Xano API contract: Deal Finder

Frontend `/deal-finder/*` endpoints require the existing `automarket_users` auth. Xano must obtain the authenticated user from `$auth`, load `automarket_users`, and allow only `role == admin` or `role == deal_finder_admin`. Never trust `user_id`, `role`, ownership, or score supplied by the client.

Worker-only `/deal-finder/internal/*` endpoints do not use a browser session and must not require `automarket_users` auth. They accept only server-to-server calls with `X-Deal-Finder-Secret`, compare it against the server-side Xano secret, return generic authorization errors, and never expose the expected value.

The four Worker endpoints are physically present in API group `sitecraft-auto-market`:

| Endpoint | Xano endpoint ID |
| --- | ---: |
| `GET /deal-finder/internal/searches/active` | `3988244` |
| `POST /deal-finder/internal/listings/existing-ids` | `3988250` |
| `POST /deal-finder/internal/listings/ingest` | `3988251` |
| `POST /deal-finder/internal/listings/touch-seen` | `3988644` |

Xano currently has no configured environment-variable editor available through the Metadata token, so deployment injects the shared ASCII secret into the server-side endpoint code from the ignored `.dev.vars` file. Repository XanoScript keeps only `__DEAL_FINDER_SECRET_RAW__`. Missing/wrong headers receive the same generic 403 response. Xano has no documented timing-safe string comparator for this precondition; the Cloudflare Worker performs constant-time comparison at its own public boundary. Request limits (100 IDs/listings), deduplication, and disabled `sync_enabled` provide the additional first-run replay/bounds protection.

## Frontend endpoints

The first authenticated frontend slice is physically present in API group `sitecraft-auto-market`. Every endpoint uses `automarket_users` auth, reloads the current user from `$auth.id`, requires `admin` or `deal_finder_admin`, and then applies strict owner scope (`row.user_id == current_user.id`). Admin cross-owner reads are intentionally not enabled until an explicit policy exists.

| Method / path | ID | Result |
| --- | ---: | --- |
| `GET /deal-finder/stats` | `3988688` | Counts: active, new, saved, hidden, hot, analysis_pending, source_removed |
| `GET /deal-finder/listings` | `3988689` | Owner-scoped list with filters and pagination; default `active`, `is_hidden=false`, newest, 100 (max 100) |
| `GET /deal-finder/listings/{id}` | `3988690` | Listing, latest analysis, search and allowed actions; no raw source payload |
| `GET /deal-finder/searches` | `3988691` | Current owner's search profiles |
| `POST /deal-finder/listings/{id}/view` | `3988692` | Sets viewed/new flags without overwriting saved |
| `POST /deal-finder/listings/{id}/save` | `3988693` | Saves and unhides |
| `POST /deal-finder/listings/{id}/unsave` | `3988694` | Removes saved flag |
| `POST /deal-finder/listings/{id}/hide` | `3988695` | Hides and removes saved |
| `POST /deal-finder/listings/{id}/restore` | `3988696` | Restores a hidden record |
| `POST /deal-finder/listings/{id}/analyze` | `3990128` | Creates or reuses one owner-scoped pending analysis; never calls OpenAI |

### Description translation

`POST /deal-finder/listings/{id}/translate-description` is prepared as an installable Xano blueprint but is **not physically installed** and therefore has no endpoint ID yet. It performs a synchronous OpenAI Responses API call with the server-selected `gpt-5.6-luna` model, `store: false`, and strict structured output. The endpoint accepts only `source_language=de` and `target_language=ru`, derives the source text and SHA-256 hash from the owner-scoped listing, reuses a completed hash-matched result, and returns only the safe translation envelope. It never accepts `user_id`, role, model, source text, translated text, or a secret from the browser.

Repository sources:

- `docs/xano/deal-finder-translations.xs`
- `docs/xano/deal-finder-frontend-translate-description.xs`

Translation is included at zero credits and limited to ten owner requests per hour. Physical endpoint installation and the first real provider-backed translation require separate confirmation.

Runtime checks on 2026-07-17 confirmed: no auth returns 401; an authenticated non-admin returns 403; another owner's record returns 404; list/search/pagination use only current-owner records; save/view/hide/restore preserve unrelated flags. Test mutations on listing 1 were reverted to `new`, unseen, unsaved and visible.

The remaining frontend contracts below are not physically created in this stage:

| Method / path | Result |
| --- | --- |
| `POST /deal-finder/searches` | create owner scoped profile |
| `PATCH/DELETE /deal-finder/searches/{id}` | update / soft deactivate (`is_active=false`) |
| `GET /deal-finder/sync-logs` | admin/deal_finder_admin only |

## Worker-only internal endpoints

Each requires a server-side `X-Deal-Finder-Secret` check and the request schema below. Xano exposes the incoming header through `$env.$http_headers."X-Deal-Finder-Secret"`. Return generic 401/403, never the expected secret.

### `GET /deal-finder/internal/searches/active`

Returns owner-bound active profiles with `source_type=kleinanzeigen_agent`. Manual dry-runs may use a profile with `sync_enabled=false`; the Worker itself excludes such profiles from real `/sync` and scheduled runs. The response shape is `{ "data": [search] }`.

### `POST /deal-finder/internal/listings/existing-ids`

```json
{ "platform": "kleinanzeigen", "search_id": 1, "external_ids": ["123", "456"] }
```

Returns `{ "existing_ids": ["123"] }`. The endpoint verifies the search owner and matches `user_id + platform + external_id`; limit incoming IDs to 100.

### `POST /deal-finder/internal/listings/ingest`

```json
{
  "source_type": "kleinanzeigen_agent",
  "search_id": 1,
  "fetched_at": "2026-07-16T08:00:00.000Z",
  "listings": [{ "platform": "kleinanzeigen", "external_id": "123", "source_url": "https://www.kleinanzeigen.de/s-anzeige/example", "title": "Example", "currency": "EUR", "source_images": [], "data_level": "detail", "provider_detail_loaded": true, "provider_detail_fetched_at": "2026-07-16T08:00:00.000Z" }]
}
```

Only successfully detail-enriched new records are sent here. Validate bounds and `https` URLs, deduplicate on `platform+external_id`, preserve `is_saved`, `is_hidden`, `is_viewed`, and log one `manual_seed` entry for the batch. `sync_metadata` may contain batch counters (`candidates_found`, `new_candidates`, `existing_candidates`, `details_fetched`, `detail_failures`, `touched`, `rejected`). Return `{created, updated, duplicates, rejected, created_listing_ids}`. It must not create `car_listings`, download images, call R2 or run AI.

Defense in depth: if an existing record receives `data_level=search`, Xano may update only `last_seen_at`, `source_status`, `unavailable_checks`, and safe timestamps. It cannot replace detail fields, images, `content_hash`, ownership, or user flags. New records require `data_level=detail` and `provider_detail_loaded=true`.

### `POST /deal-finder/internal/listings/touch-seen`

```json
{
  "platform": "kleinanzeigen",
  "search_id": 1,
  "seen_at": "2026-07-17T12:00:00.000Z",
  "external_ids": ["123", "456"]
}
```

The endpoint normalizes and deduplicates at most 100 non-empty IDs, verifies the search profile, scopes rows to the search owner, and returns `{touched, missing, missing_external_ids}`. It may update only `last_seen_at`, `last_checked_at`, `source_status=active`, and `unavailable_checks=0`. It does not accept listing content and never changes owner/user flags. Optional `log_sync=true` is used only for an all-existing batch so one consolidated sync log is created without one log per car.

Repository sources:

- `docs/xano/deal-finder-internal-active-searches.xs`
- `docs/xano/deal-finder-internal-existing-ids.xs`
- `docs/xano/deal-finder-internal-ingest.xs`
- `docs/xano/deal-finder-internal-touch-seen.xs`

## AI analysis queue

These endpoints are physically present. The browser endpoint requires `automarket_users`, reloads the user from `$auth`, permits only `admin`/`deal_finder_admin`, and returns 404 for another owner's listing. Worker endpoints have no browser auth and require the same server-only `X-Deal-Finder-Secret` boundary as ingestion.

| Method / path | ID | Purpose |
| --- | ---: | --- |
| `POST /deal-finder/listings/{id}/analyze` | `3990128` | Idempotent enqueue/reuse by normalized `input_hash` and `analysis_version` |
| `GET /deal-finder/internal/analyses/pending` | `3990129` | At most five pending jobs; Worker currently requests one |
| `POST /deal-finder/internal/analyses/{id}/claim` | `3990130` | Atomic transaction and update lock: `pending -> processing` |
| `POST /deal-finder/internal/analyses/{id}/complete` | `3990131` | Validated structured result: `processing -> completed` |
| `POST /deal-finder/internal/analyses/{id}/fail` | `3990132` | Safe error code only: `processing -> failed` |

`POST /analyze` exists on the protected production Worker and is also invoked internally by the two-minute queue schedule. Enqueue stores the server-selected model `gpt-5.6-luna`; the browser cannot override it. Xano never calls OpenAI. Complete does not modify listing provider fields or user flags. Browser list responses include only the latest completed score/recommendation; detail may include the latest safe state but never `input_snapshot`, provider response ID, token usage, raw provider data, or internal error messages.

### Optional future contracts

- `POST /deal-finder/internal/email-ingest`: storage-only optional future source; no parser or HTML rendering.
- `POST /deal-finder/internal/listings/{id}/check-source`: returns `{ "status": "not_implemented" }` until a real compliant status checker exists.
- `POST /deal-finder/internal/test-listing`: development/staging only, protected by the same secret and `DEAL_FINDER_TEST_ENDPOINT_ENABLED=false` in production.
