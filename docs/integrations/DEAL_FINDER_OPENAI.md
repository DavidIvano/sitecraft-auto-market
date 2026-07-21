# Deal Finder OpenAI analysis

## Status

Prepared on 2026-07-17 and validated with controlled local runs on 2026-07-18. Listings 1-5 each have one completed `deal-finder-v1` analysis from `gpt-5.6-luna`. The Worker was not deployed; live AI and manual AI execution are disabled, dry-run is enabled, and Cron remains disabled. A frontend-only Cloudflare Pages branch preview was deployed first. After separate explicit approval, the verified frontend was also deployed to the primary Pages branch on 2026-07-18 without running AI or changing stored analyses.

```text
authenticated Deal Finder detail
  -> Xano pending analysis (idempotent input_hash)
  -> protected Worker POST /analyze
  -> atomic Xano claim
  -> OpenAI Responses API + strict Structured Outputs
  -> local schema validation and confidence cap
  -> Xano complete/fail
  -> safe owner-scoped frontend response
```

## Configuration

```dotenv
OPENAI_API_KEY=
DEAL_FINDER_OPENAI_MODEL=gpt-5.6-luna
DEAL_FINDER_MAX_AI_ANALYSES_PER_RUN=1
DEAL_FINDER_AI_ENABLED=false
DEAL_FINDER_AI_DRY_RUN=true
DEAL_FINDER_MANUAL_AI_ENABLED=false
DEAL_FINDER_AI_TIMEOUT_MS=30000
```

`OPENAI_API_KEY` belongs only in ignored `.dev.vars` and, after a separately approved deployment, in a Cloudflare Worker Secret. It is never sent to Xano or any `PUBLIC_` variable. Incoming manual Worker calls use only `DEAL_FINDER_WORKER_TRIGGER_SECRET`; outbound Worker-to-Xano calls use only `XANO_DEAL_FINDER_INGEST_SECRET`. Both are server-only, non-interchangeable, and omitted from `/health`.

## Input boundary and idempotency

The immutable snapshot contains only listing ID/content hash, title, description, price/currency, brand/model/variant, year, mileage, fuel/transmission, power, engine volume, body type, city/postal code, and discovery/publication timestamps. Seller data, contacts, address, images, cookies, provider raw data, tokens and secrets are excluded.

`input_hash` includes normalized listing data plus `analysis_version=deal-finder-v1`. An active job with the same hash is reused. A completed job with the same hash/version is reused unless an authorized caller explicitly sends `force=true`. Changed content creates a new historical row.

## Structured output

The Worker uses `POST https://api.openai.com/v1/responses` with `store=false`, `max_output_tokens=1500`, `reasoning.effort=low`, `text.format.type=json_schema`, `strict=true`, all properties required, and `additionalProperties=false`. Scores are integers 0-100; confidence is 0-1; arrays contain at most 20 plain strings; summary is plain text up to 2000 characters. Allowed recommendations are `HOT_DEAL`, `CONTACT_NOW`, `REVIEW`, `WATCH`, `SKIP`, and `INSUFFICIENT_DATA`.

The REST response is read from `output[].content[].type=output_text`, parsed and validated again locally. Without real market comparables, application code caps confidence at `0.70`; the model prompt alone is not trusted. Deal score is only a heuristic assessment of the supplied listing. It is not a verified discount, technical inspection, profit forecast, or purchase guarantee.

Official references: [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna), [Responses API](https://platform.openai.com/docs/api-reference/responses), and [Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs).

## Queue, failures and audit

Xano endpoint IDs: enqueue `3990128`, pending `3990129`, claim `3990130`, complete `3990131`, fail `3990132`. Claim uses a transaction and update lock. Complete accepts only a `processing` row and never edits the listing. Fail stores only an allowlisted code such as `OPENAI_TIMEOUT`, `OPENAI_RATE_LIMIT`, or `OPENAI_INVALID_OUTPUT`; raw upstream bodies are not stored.

Token counts and provider response ID are retained server-side for usage audit. `estimated_cost` stays null until an explicitly approved, versioned price source exists; the application does not invent a cost. Browser endpoints do not return these fields.

## Controlled local operation and rollback

`POST /analyze/dry-run` validates a pending safe snapshot or local fixture without calling OpenAI or changing Xano. `POST /analyze` returns `AI_DISABLED` while the feature flag is false. Cron remains commented out and sync remains disabled.

The explicit local runner is `npm run deal-finder:analyze -- --ids=2,3,4,5 --max=4 --stop-on-error`. It defaults to dry-run, one-at-a-time execution, no force, and stop-on-error; without `--ids` it performs no analysis. Before each live call, the protected preflight verifies ownership, detail-level source data, timestamp normalization, and absence of matching active work. A completed same-hash analysis blocks an ordinary run but may be repeated with an explicit bounded `--force`, which creates a new immutable row.

The first controlled analysis, listing 1, completed on 2026-07-18 with 605 input, 800 output, and 1405 total tokens. Listings 2-5 were then processed strictly in order with four enqueue operations, four claims, four Responses requests, four completes, and no retries. Their combined usage was 2652 input, 3108 output, and 5760 total tokens. Cumulative usage for listings 1-5 was 3257 input, 3908 output, and 7165 total tokens.

Numeric timestamps are normalized before snapshot validation: ISO values remain ISO, Unix seconds and milliseconds become ISO strings, invalid values are rejected, `published_at` may be null, and `first_seen_at` is required. The Xano claim contract performs its pending-state guard, row lock, and transition inside one transaction; a second claim or a claim of a completed/failed row is rejected without changing the listing or user flags.

Quality note for a future `deal-finder-v2`: some v1 outputs placed operational facts such as mileage or handover conditions in `known_defects`. Do not rerun or force-edit historical results; refine the next prompt/schema so confirmed mechanical defects remain separate from risks and neutral facts.

The current frontend handles this historical v1 limitation without mutating stored analyses. It shows `AI v1 · Beta`, presents `known_defects` under `Возможные замечания из текста объявления`, and adds a note that automatically extracted items may include neutral facts and do not confirm a technical fault. `known_defects`, `negative_signals`, and `missing_information` remain separate escaped-text sections. All analysis versions display the general disclaimer that the result is based only on listing data and is not a technical diagnosis, confirmed market valuation, or guarantee of benefit.

Rollback: set `DEAL_FINDER_AI_ENABLED=false`, keep dry-run true, and stop invoking `/analyze`. Pending/history rows can remain for audit; no `car_listings` rollback is needed because this pipeline never touches that table.

## Verification checkpoint

On 2026-07-18 the project passed 147 unit tests, Astro reported zero diagnostics, the Worker TypeScript check passed, and the static preview build completed. The built browser output contained no Worker/OpenAI secret names, `input_snapshot`, provider response ID, or raw OpenAI response. Every Deal Finder route remained `noindex` and absent from the sitemap.

The physical Xano auth layer returns `403 ERROR_CODE_ACCESS_DENIED` for an anonymous enqueue request before the endpoint stack runs. The internal routes also reject a missing Worker secret. After the controlled repeat QA, `deal_finder_analyses` contained six completed rows and zero pending, processing, or failed rows. Public `car_listings` remained isolated. No provider search/detail call, provider credit, sync, Cron, or Worker deployment was used during the repeat.

The frontend security preview is available at [deal-finder-security-preview.sitecraft-auto-market.pages.dev](https://deal-finder-security-preview.sitecraft-auto-market.pages.dev). Anonymous browser and direct API checks passed: no listings were exposed and Xano returned a safe `401`. The preview origin was not accepted by the existing Xano authentication configuration, so authenticated preview checks remain explicitly incomplete. The production frontend is now available at [sitecraft-auto-market.pages.dev](https://sitecraft-auto-market.pages.dev) after explicit approval. Publishing the Worker or enabling manual/automatic AI still requires separate approval.
