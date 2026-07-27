# Local feature completion report

Date: 26 July 2026  
Branch: `feat/favorites-cards-contacts`  
Scope: local project only; no GitHub, Xano production publication, Cloudflare deploy, or production data mutation.

## 1. What was incomplete

- Public favorites used browser storage and could not synchronize between devices.
- Car-card navigation depended on JavaScript and overlapped nested interactive controls.
- Seller contacts lacked an explicit consent-based public profile contract.
- The contact modal and dashboard favorites page were incomplete.
- AI feature flags and model variables were inconsistent; active drafts still referenced older models.
- AI search, listing analysis, and Deal Finder analysis did not share a clear post-success, idempotent credit contract.
- Deal Finder description translation was a placeholder/queue contract without a real provider call.
- AI draft state was not restored after reload.

## 2. Root causes

- Favorites had no installed owner-scoped Xano table/endpoints.
- Public listing responses did not have a dedicated safe seller-contact projection.
- Several AI paths grew independently and used different model variables and billing timing.
- The Deal Finder frontend existed before the translation provider workflow was completed.
- Protected local pages require a valid local browser session; source-level tests cannot substitute for authenticated production E2E.

## 3. Local files changed

Frontend and shared UI:

- `src/components/CarCard.astro`
- `src/components/ActionButton.astro`
- `src/components/ContactSellerModal.astro`
- `src/components/VehicleSpecItem.astro`
- `src/components/VehicleSpecsGrid.astro`
- `src/components/cars/*`
- `src/components/dashboard/*`
- `src/components/deal-finder/DealFinderCard.astro`
- `src/lib/apiRoutes.ts`
- `src/lib/authClient.ts`
- `src/lib/ai/idempotency.ts`
- `src/lib/deal-finder/*`
- `src/lib/favorites.ts`
- `src/lib/publicCar.ts`
- `src/lib/publicCarCard.ts`
- `src/lib/publicCarCardsClient.ts`
- `src/lib/returnTo.ts`
- `src/lib/toast.ts`
- `src/lib/types.ts`
- `src/pages/cars/[slug].astro`
- `src/pages/cars/index.astro`
- `src/pages/dashboard/favorites.astro`
- `src/pages/dashboard/index.astro`
- `src/pages/dashboard/new.astro`
- `src/pages/login.astro`
- `src/styles/global.css`

Xano/Worker/configuration:

- `.env.example`
- `workers/deal-finder-sync/src/env.ts`
- `workers/deal-finder-sync/wrangler.toml`
- `docs/xano/public-favorites-contacts/*`
- `docs/xano-endpoint-post-ai-search-intent.xs`
- `docs/xano-endpoint-post-ai-listing-generate-description.xs`
- `docs/xano-endpoint-post-ai-listing-quality-score.xs`
- `docs/xano-endpoint-post-ai-moderation-check-listing.xs`
- `docs/xano/admin-security-remediation/3974045.after.xs`
- `docs/xano/admin-security-remediation/3979609.after.xs`
- `docs/xano/admin-security-remediation/3981578.after.xs`
- `docs/xano/deal-finder-frontend-analyze.xs`
- `docs/xano/deal-finder-frontend-translate-description.xs`
- `docs/xano/deal-finder-internal-analysis-complete.xs`

Tests and focused documentation were updated alongside these files. Existing unrelated untracked reports were not edited.

## 4. Xano schema changes

Prepared, not published:

- New `car_listing_favorites`: `id`, `created_at`, `user_id`, `car_listing_id`.
- Unique index on `(user_id, car_listing_id)` and owner/date lookup index.
- Nullable contact fields on `automarket_users`: `first_name`, `last_name`, `display_name`, `contact_phone`, `contact_email`, `show_phone=false`, `show_email=false`, `preferred_contact_method`.
- Existing Deal Finder translation table remains separate and stores source hash, translated text, model, status, and timestamps.

## 5. Endpoint status and IDs

Prepared favorites/contact endpoints have no production IDs yet:

- `GET /favorites`
- `POST /favorites/status`
- `POST /favorites/{listing_id}`
- `DELETE /favorites/{listing_id}`
- `GET /me/contact-profile`
- `PATCH /me/contact-profile`

Known AI endpoint IDs:

- `3979609` - `POST /ai/listing/analyze-photos`, primary AI draft path.
- `3981498` - `POST /ai/listing/generate-description`.
- `3981478` - `POST /ai/listing/quality-score`.
- `3981451` - `POST /ai/search/intent`.
- `3981578` - `POST /ai/moderation/check-listing`.
- `3974045` - legacy `POST /ai/generate-listing`; model corrected, but frontend use remains deliberately disabled because this path also publishes/submits and still needs a separate workflow migration.

Known Deal Finder IDs:

- Frontend read/actions: `3988688`-`3988696`.
- Analysis enqueue/worker queue: `3990128`-`3990132`.
- Translation blueprint has no endpoint ID and is not published.

## 6. AI functions found

- Buyer search-intent parsing.
- Photo analysis and normalized field extraction.
- Listing title/description generation.
- Listing quality score and recommendations.
- Moderation explanation/check.
- Deal Finder opportunity/risk analysis.
- German-to-Russian Deal Finder description translation.

## 7. Features that were disabled

- Real listing endpoints were behind inconsistent feature flags.
- Deal Finder AI/translation had dry-run, mock, or unpublished backend dependencies.
- Legacy generate-listing remains disabled in the browser for a technical reason: it combines generation with later listing workflow side effects.

## 8. What was enabled locally

- Real listing endpoint flags and Deal Finder UI flags in the local environment.
- Server-backed favorite synchronization through one batch status request, with no favorites `localStorage` fallback.
- Native card links and independent heart controls.
- Consent-based seller contact modal with `tel:`/`mailto:`, backdrop, explicit cancel handling, and focus return.
- Draft restore by `draft_id` after reload.
- Real Deal Finder translation blueprint and real AI analysis Worker configuration.

## 9. Model migration

Active local Xano/Worker implementation files were scanned for `gpt-5.4-mini`, `gpt-5.4`, `gpt-5-mini`, `gpt-4o-mini`, and `OPENAI_CAR_AI_MODEL`; no active matches remain. Server-side model variables now resolve to `gpt-5.6-luna`. Responses API calls use `store: false`; structured JSON paths request strict schemas. The frontend does not select the model or expose the OpenAI key.

## 10. Generation result

The primary photo-analysis draft contract (`3979609`) is locally prepared with Luna, strict output validation, persisted draft metadata, and post-success idempotent billing. The page sends a stable idempotency key and restores a saved draft after reload. A real provider generation was not executed because the changed XanoScript is not published from this local-only task.

## 11. Deal Finder AI result

The Worker selects Luna and retains the protected claim/complete/fail queue. A reused completed analysis costs zero; a new successful analysis costs one credit, charged atomically once on completion with `deal-finder-analysis-v1-{analysis_id}`. Internal endpoints remain secret-protected. A new live analysis was not submitted during local QA.

## 12. Translation result

The blueprint now performs a real synchronous OpenAI Responses API call using Luna, `store: false`, and strict JSON. Xano obtains the German source from the owner-scoped listing, preserves facts/defects/numbers/URLs/VIN/paragraphs, caches by SHA-256 source hash, and rate-limits the owner to ten requests/hour. Translation is zero credits. No production translation was generated because the endpoint is not installed.

## 13. Credit verification

| Operation | Cost | Charge point | Idempotency |
| --- | ---: | --- | --- |
| AI search intent | 1 | after valid provider result | client key + ledger lookup |
| AI listing/photo draft | 1 | after valid persisted result | client key + draft/ledger replay |
| New Deal Finder analysis | 1 | successful completion | analysis-derived ledger key |
| Reused Deal Finder analysis | 0 | no charge | existing result reused |
| Description helper / quality score | 0 | included in draft workflow | no independent debit |
| de -> ru translation | 0 | cached/included | source-hash cache |

Costs are server-selected. OpenAI/network failures do not debit. Atomic wallet locking and ledger entries are present in the prepared paid workflows. No admin/email bypass was added.

## 14. Local verification

- `npm ci`: passed; npm audit reports 11 dependency findings (4 moderate, 7 high), not auto-fixed.
- `npm run check`: passed, 183 files, 0 errors, 0 warnings, 0 hints.
- `npm test`: passed, 251/251 after correcting one stale contract assertion.
- `npm run build`: passed; Astro and the Cloudflare advanced-mode Worker bundle compiled.
- `git diff --check`: passed.

## 15. Browser QA

- `/cars/` passed at 320, 375, 390, 768, 1024, and 1440 px with no horizontal overflow.
- Representative detail, favorites/login state, and Deal Finder pages passed another 18 width checks with no horizontal overflow.
- All three requested vehicle URLs returned HTTP 200 after restarting the dev server. The first 500 was stale Vite optimized-dependency state after `npm ci`, fixed by a clean dev-server restart.
- Native catalog card navigation opened the expected detail URL.
- Anonymous heart click did not open the card; it redirected to `/login` with a safe internal `returnTo`.
- Contact modal exposed only the available opted-in email action for the tested seller; open, close, and focus return passed. Explicit `cancel` handling covers Escape.
- Dashboard/favorites/new redirected an unauthenticated local browser to login with the correct `returnTo`.
- Deal Finder showed the authenticated-session requirement rather than a disabled-module message.
- Final checked page had no browser console warnings or errors.

Authenticated favorite mutations, AI charging, Deal Finder mutations, and translation were not represented as production E2E because the new Xano batch is unpublished and the local browser did not have a stable authenticated Xano session.

## 16. Manual Xano and Cloudflare actions

Apply in a Xano non-production branch/workspace:

1. Compare existing user/listing/translation fields; create only missing fields.
2. Create `car_listing_favorites` and indexes from `docs/xano/public-favorites-contacts/schema.xs`.
3. Compile/publish favorites and contact-profile endpoints from `endpoints.xs`; record their IDs.
4. Patch public car responses with the documented safe projection and batch favorite status.
5. Configure all server model variables to `gpt-5.6-luna`.
6. Apply and compile AI IDs `3979609`, `3981498`, `3981478`, `3981451`, and `3981578` in staging.
7. Install the Deal Finder translation endpoint and apply analysis billing completion logic.
8. Run authenticated owner/non-owner, duplicate/retry, insufficient-credit, provider-failure, hidden-contact, and translation-cache tests.
9. Publish Xano first. Deploy Worker/frontend to Cloudflare only after the backend contracts pass.

Rollback consists of restoring the previous endpoint scripts, disabling the local feature flags, and leaving new nullable profile fields/table in place until favorite rows are safely exported or removed. No production rollback action is needed from this local-only work.

## 17. Remaining risks

- XanoScript syntax and database locks cannot be compiled/verified without Xano access.
- Favorites/contact/translation endpoint IDs are not assigned.
- The legacy endpoint `3974045` still needs a separate workflow/billing migration before it can be safely re-enabled.
- Full authenticated and provider-backed E2E remains mandatory before production publication.
- Dependency audit findings need a separate controlled upgrade task.

