# Deal Finder setup

## Enable the closed UI

Keep these variables disabled by default:

```dotenv
PUBLIC_DEAL_FINDER_ENABLED=false
PUBLIC_DEAL_FINDER_USE_MOCK_DATA=false
DEAL_FINDER_SYNC_ENABLED=false
DEAL_FINDER_DRY_RUN=true
DEAL_FINDER_MANUAL_SYNC_ENABLED=false
DEAL_FINDER_MANUAL_AI_ENABLED=false
```

Set `PUBLIC_DEAL_FINDER_ENABLED=true` only when a signed-in user has `admin` or `deal_finder_admin`. Set `PUBLIC_DEAL_FINDER_USE_MOCK_DATA=true` for the six non-personal test records. Do not make any secret `PUBLIC_`.

Production was explicitly enabled on 2026-07-18 with real Xano mode. The Worker checks the AI queue every two minutes and performs one bounded source sync daily at `06:15 UTC`. The Free-plan source budget is one search over up to 100 candidates plus at most four detail requests per day, for a hard scheduled maximum of five Kleinanzeigen Agent credits. Manual source sync is disabled; the current limits are one search profile, four new detail records per daily sync and one AI task per queue run. The disabled values above remain the safe defaults for new environments and rollback.

Worker-only required secrets are `KLEINANZEIGEN_AGENT_API_KEY`, `XANO_API_BASE_URL`, `XANO_DEAL_FINDER_INGEST_SECRET`, `DEAL_FINDER_WORKER_TRIGGER_SECRET`, and `OPENAI_API_KEY`. They belong only in ignored local Worker vars or, after a separately approved Worker deployment, Cloudflare Worker Secrets. AI defaults are `DEAL_FINDER_OPENAI_MODEL=gpt-5.6-luna`, `DEAL_FINDER_MAX_AI_ANALYSES_PER_RUN=1`, `DEAL_FINDER_AI_ENABLED=false`, `DEAL_FINDER_AI_DRY_RUN=true`, and `DEAL_FINDER_AI_TIMEOUT_MS=30000`. Sync remains separately locked to zero AI analyses.

## Worker security boundary

Incoming manual routes (`/sync`, `/sync/dry-run`, `/analyze`, and `/analyze/dry-run`) authenticate only with `DEAL_FINDER_WORKER_TRIGGER_SECRET`. Outbound Worker requests to Xano use only `XANO_DEAL_FINDER_INGEST_SECRET`. Neither secret can substitute for the other, and the trigger secret is never forwarded to Xano.

Manual execution has an additional fail-closed gate. `DEAL_FINDER_MANUAL_SYNC_ENABLED=false` returns `SYNC_DISABLED` before provider or Xano access, and `DEAL_FINDER_MANUAL_AI_ENABLED=false` returns `AI_DISABLED` before pending lookup, claim, or OpenAI access. The automatic/internal flags remain independently disabled.

`GET /health` returns only fixed service metadata and configuration booleans. It does not return endpoints, secret names or values, key fragments, account data, model configuration, usage, or billing information.

## Xano and Worker setup

1. Review [deal-finder-schema.md](xano/deal-finder-schema.md). Five tables, eight Worker-only endpoints and ten authenticated frontend endpoints are physically present.
2. Configure a server-side comparison for `X-Deal-Finder-Secret`; do not put it in JSON and do not return it in errors.
3. Validate ownership/role on every endpoint. `deal_finder_listings` are never public `car_listings`.
4. Install Worker secrets interactively only in the intended Cloudflare environment:

```sh
cd workers/deal-finder-sync
wrangler dev
wrangler secret put KLEINANZEIGEN_AGENT_API_KEY
wrangler secret put XANO_API_BASE_URL
wrangler secret put XANO_DEAL_FINDER_INGEST_SECRET
wrangler secret put DEAL_FINDER_WORKER_TRIGGER_SECRET
wrangler secret put OPENAI_API_KEY
```

Production Cron is declared in `wrangler.toml` as AI queue polling every two minutes and source sync once daily. Keep manual source sync disabled when operating against the Kleinanzeigen Agent Free plan.

## AI dry-run

The physical queue endpoints are documented in [deal-finder-api.md](xano/deal-finder-api.md). With the Worker running locally, call protected `POST /analyze/dry-run`. It validates the safe snapshot/schema and returns `openai_called=false` and `state_changed=false`. Do not switch `DEAL_FINDER_AI_ENABLED` to true or `DEAL_FINDER_AI_DRY_RUN` to false without explicit approval. See [DEAL_FINDER_OPENAI.md](integrations/DEAL_FINDER_OPENAI.md).

## Controlled AI checkpoint

On 2026-07-18 listing 1 completed the first approved real analysis with 605 input, 800 output, and 1405 total tokens. A protected read-only preflight then passed for listings 2-5. They were enqueued and processed one at a time by the local Worker, producing exactly four new Responses requests and no retries. The new batch used 2652 input, 3108 output, and 5760 total tokens; cumulative usage for all five records was 3257 input, 3908 output, and 7165 total tokens.

The queue finished with five completed rows and no pending, processing, or failed rows. AI was restored to disabled with dry-run enabled and a per-run maximum of one; the local Worker was stopped. Cron, provider sync, production Worker/frontend deployment, and public `car_listings` writes were not used.

The batch runner is intentionally inert without explicit IDs and defaults to dry-run, sequential execution, no force, and stop-on-error. `--force` is accepted only when explicitly supplied with bounded IDs; active work is always reused, while a completed same-hash result is reused unless that explicit flag is present. Numeric Unix timestamps are normalized safely before analysis. Xano claim now keeps the pending check, lock, and state transition in one transaction so duplicate or terminal-state claims fail without partial mutation.

Later on 2026-07-18, one approved repeat QA run for listing 1 verified that explicit force creates a new immutable analysis row rather than returning the previous result. It completed with 605 input, 781 output, and 1386 total tokens, score 48 and recommendation `REVIEW`. The table then contained six completed rows and zero pending, processing, or failed rows; listing flags were unchanged, the local Worker was stopped, and all automatic/sync switches remained disabled.

## First manual dry-run

The Xano profile `Autos bis 5.000 EUR – Ilsede 100 km` exists for the current admin with `category_id=216`, `location_id=2677`, `sync_enabled=false`, and `is_active=true`. Those IDs were resolved through the provider's documented category/location endpoints.

On 2026-07-16 the Worker completed one real dry-run with five candidates, no detail calls, no AI calls, and no ingestion. At that checkpoint Xano `deal_finder_listings` and `deal_finder_sync_logs` were empty. The later first ingest required explicit approval and retained the five-record batch limit.

## First controlled ingest

On 2026-07-17 an explicitly approved local invocation of the protected Worker `/sync` route performed one provider search, five detail requests, and one production Xano ingest batch. It created listing IDs 1-5, rejected none, and created one completed `manual_seed` sync log. The profile remains `sync_enabled=false`; Cron, AI, R2, Gmail, and frontend endpoints remain disabled or absent. Public `car_listings` stayed at its pre-ingest count.

A write-free deduplication preflight submitted the five stored external IDs to `existing-ids` and received an exact 5/5 match without another provider search or detail request. A second live search was intentionally not run.

The repeat-sync merge policy was hardened on 2026-07-17 without provider calls. Worker search results are now split into new/existing candidates; details and full ingest apply only to new candidates, while existing IDs use Xano `POST /deal-finder/internal/listings/touch-seen` (endpoint ID `3988644`). Existing rows 1-5 were marked `data_level=detail` and `provider_detail_loaded=true`. A duplicate-ID touch verification changed only allowed discovery timestamps/state, preserved protected listing/user fields, created no sync log, and left public `car_listings` at 22 rows. Xano ingest also rejects new search-level rows and prevents search-level overwrite of existing detail content.

Batch logs contain `candidates_found`, `new_candidates`, `existing_candidates`, `details_fetched`, `detail_failures`, `created`, `updated`, `touched`, and `rejected`. A mixed/new batch logs through ingest; an all-existing batch sets `log_sync=true` on its single touch request so there is one consolidated log, never one log per car.

## Local frontend verification

The closed route was verified locally against the real Xano records on 2026-07-17 at 1280x720 and 375x812. The feed renders exactly five owner-scoped listings with external images, stats `active=5/new=5`, filters and 44px actions. The mobile viewport remained 375px wide with no horizontal overflow. Console errors were empty.

Save/unsave and hide/restore were exercised through the local UI and the record was returned to its original `new`, visible, unsaved state. Watchlist and hidden views filtered correctly. Search profile ID 1 is visible with `sync_enabled=false`. Universal detail route `/dashboard/deal-finder/listing/?id=1` loads the real record and its 16 safe external image URLs; AI remains explicitly not started. Routes use `noindex, nofollow, noarchive` and remain absent from the sitemap.

The detail page is one static artifact and reads a validated positive integer from `URLSearchParams`. It does not use `getStaticPaths`, hardcoded Xano IDs or build-time listing data. Future ID 6+ therefore opens without rebuilding the site. Invalid IDs do not call Xano; unknown valid IDs render the safe not-found state returned by the authenticated endpoint. Clean dynamic URLs remain deferred until a future SSR/Cloudflare Workers migration.

This stage used a local frontend and a temporary local auth proxy only. It did not deploy the Worker or frontend, call the provider, spend provider credits, enable Cron, connect Gmail/Telegram, or use R2. The later controlled AI checkpoint used the local analysis route only.

## Frontend security preview

On 2026-07-18 a branch preview was deployed to [deal-finder-security-preview.sitecraft-auto-market.pages.dev](https://deal-finder-security-preview.sitecraft-auto-market.pages.dev) with `PUBLIC_DEAL_FINDER_ENABLED=true` and real authenticated Xano mode. This was a Pages preview only: the production branch, custom domain, DNS, production variables, Worker, Worker secrets, routes, service bindings, and Cron were not changed.

The anonymous preview check rendered the safe sign-in state with no listing data, `noindex, nofollow, noarchive`, no horizontal overflow, and no browser-visible server secret names. A direct anonymous request to the real Xano Deal Finder API returned the expected safe `401`. The generated sitemap excludes Deal Finder feed and detail routes, and the built output contains no input snapshot, provider response identifier, raw OpenAI response, or Worker secret names.

An authenticated preview session was not available during automated browser QA because the preview origin was not accepted by the existing Xano authentication configuration. Consequently, role enforcement, owner scoping, the five real detail pages, state-changing actions, and the full desktop/mobile visual matrix were not claimed as runtime-verified in preview. Their contracts and rendering logic remain covered by local tests, and the previously completed local authenticated QA remains documented above.

After explicit approval on 2026-07-18, the same verified frontend artifact was deployed to the primary Cloudflare Pages branch at [sitecraft-auto-market.pages.dev](https://sitecraft-auto-market.pages.dev). The production build enables Deal Finder with real Xano mode and uses the already allowed production origin. No Worker deployment, Cron, provider sync, AI execution, DNS change, or production environment-variable mutation accompanied this frontend deployment. Authenticated production runtime QA remains pending a manual browser sign-in/reload.

For `analysis_version=deal-finder-v1`, the frontend displays `AI v1 · Beta`, labels `known_defects` as `Возможные замечания из текста объявления`, and explains that automatically extracted items may include neutral facts and do not confirm a technical fault. Every version displays the general AI limitation notice. Stored v1 results remain unchanged, arrays stay separate, and all strings are rendered as escaped text.

## Development-only test contract

The future Xano endpoint must be disabled in production with `DEAL_FINDER_TEST_ENDPOINT_ENABLED=false`.

```sh
curl -X POST "$XANO_API_URL/deal-finder/internal/test-listing" \
  -H "Content-Type: application/json" \
  -H "X-Deal-Finder-Secret: $DEAL_FINDER_INTERNAL_SECRET" \
  -d '{
    "external_id": "test-001",
    "source_url": "https://www.kleinanzeigen.de/s-anzeige/test-001",
    "title": "Volkswagen Golf 6 1.6 TDI",
    "price": 2900,
    "currency": "EUR",
    "year": 2011,
    "mileage": 186000,
    "fuel_type": "Diesel",
    "city": "Braunschweig"
  }'
```

## Not implemented

Gmail API/OAuth, email parsing, Telegram, seller contact, CAPTCHA bypass and permanent image storage are not enabled. Production source sync and queued OpenAI automation are enabled only through the bounded Worker schedules documented in [DEAL_FINDER_OPERATIONS.md](DEAL_FINDER_OPERATIONS.md).
