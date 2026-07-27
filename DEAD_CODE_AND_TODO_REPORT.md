# SiteCraft Auto Market: Dead Code and TODO Report

Audit date: 2026-07-23. This report identifies cleanup candidates only; no product code was removed or changed.

## Confirmed Unreferenced Components

Repository-wide symbol searches found declarations but no imports/usages outside their own files.

| File | Status | Recommendation |
| --- | --- | --- |
| `src/components/mac/MacBadge.astro` | DEAD_CODE | delete after one final template/string search, or add a documented consumer |
| `src/components/mac/MacCard.astro` | DEAD_CODE | same |
| `src/components/mac/MacWindow.astro` | DEAD_CODE | same |
| `src/components/deal-finder/DealFinderCard.astro` | DEAD_CODE | current cards are rendered by `src/lib/deal-finder/client.ts`; choose one rendering system |
| `src/components/deal-finder/DealFinderImage.astro` | DEAD_CODE | image formatting is currently performed in client/detail helpers |
| `src/components/deal-finder/DealFinderEmptyState.astro` | DEAD_CODE | no import found |
| `src/components/deal-finder/DealFinderErrorState.astro` | DEAD_CODE | no import found |

Deletion should happen in a separate cleanup PR with `npm run check`, `npm test`, build, and route screenshots. Some may be planned design-system components rather than accidental code; if retained, mark ownership and intended adoption milestone.

## Confirmed Unreferenced Modules/Exports

| Symbol/file | Status | Evidence and action |
| --- | --- | --- |
| `src/lib/mockCars.ts:3` `mockCars` | DEAD_CODE | no consumer found; remove test/demo fixture from production source or move to test fixtures |
| `src/lib/server/r2.ts:39` `uploadImageToR2` | DEAD_CODE | production upload uses Pages Function directly; no caller found |
| `src/lib/server/r2.ts:80` `deleteImageFromR2` | DEAD_CODE | no caller; deletion lifecycle itself remains missing |
| `src/lib/server/r2.ts:88` `deleteImagesFromR2` | DEAD_CODE | only calls the preceding unused helper |
| `src/lib/deal-finder/constants.ts:10` `DEAL_FINDER_STAGE3_API_ENABLED` | DEAD_CODE | defined from `PUBLIC_DEAL_FINDER_STAGE3_API_ENABLED` but never read |

The unused R2 helpers should not be mistaken for implemented image deletion. Either wire a role/owner-authorized deletion workflow with references/audit, or remove helpers until the feature is designed.

## Dead or Superseded Routes

| Route/file | Status | Reason |
| --- | --- | --- |
| `src/pages/dashboard/cars/[id]/promote.astro` | DEAD_CODE | `functions/dashboard/cars/[id]/promote.ts:1-16` redirects the same route to `/dashboard/cars/promote?id=...`; embedded legacy purchase implementation is unreachable |
| `src/pages/cars/detail.astro` | PARTIAL/DEPRECATED | duplicates canonical `/cars/[slug]` detail behavior and increases drift/SEO ambiguity |
| payment success/apply path | BROKEN | caller remains but `/purchases/apply` is missing; not dead until UI is removed or commerce is built |

Before deleting route files, check production analytics, backlinks, bookmarks, and generated links. Replace legacy public routes with explicit permanent redirects where needed.

## Stale Backend TODO Registry

`src/lib/apiRoutes.ts:80-102` exports `BACKEND_ROUTES_REQUIRING_XANO_WORK`. It is no longer a trustworthy source of backend readiness:

- It labels several AI, analytics, saved-search, draft, moderation, and admin-block routes as unfinished although real Xano endpoints now exist.
- It omits current gaps such as commerce, dealer profile/admin, Deal Finder search writes/translation/workspace/delivery, moderation images, and archive/restore.
- Tests that assert this constant can preserve stale documentation rather than validate the live contract.

Recommendation: replace the handwritten TODO list with a versioned endpoint manifest generated/exported from Xano metadata and checked against frontend route constants in CI.

## UI-Only/Fallback Code That Looks Implemented

These are not necessarily dead code, but they create false readiness and should be either completed, feature-gated, or visibly disabled.

| Area | Status | Evidence |
| --- | --- | --- |
| Dealer dashboard/profile | UI_ONLY | `src/pages/dashboard/dealer.astro` calls missing profile endpoints and renders fallback state |
| Admin dealers | UI_ONLY | `src/pages/admin/dealers.astro`; no matching Xano route/table |
| Admin paid products | UI_ONLY | `src/pages/admin/paid-products.astro`; explicit 404/fallback behavior |
| Admin purchases | UI_ONLY | `src/pages/admin/purchases.astro`; no purchase endpoints |
| Pricing checkout | UI_ONLY/BROKEN | `src/pages/pricing.astro:5-93`; links to pages without checkout |
| Deal Finder comparison | UI_ONLY | localStorage model in `src/lib/deal-finder/comparison.ts:1-109` |
| Deal Finder notifications | UI_ONLY | local preview/dedupe in `src/lib/deal-finder/notifications.ts:1-165` |
| Deal Finder inbox | UI_ONLY | `src/lib/deal-finder/api.ts:348-351` returns `[]` |
| Deal Finder workspace | UI_ONLY | local fallback in `src/lib/deal-finder/api.ts:316-339` |
| Moderation archive/images | BROKEN/MISSING | controls call nonexistent/mismatched endpoints in `src/pages/admin/moderation.astro:890-973` |

## Mock and Placeholder Inventory

- `src/lib/deal-finder/mock-data.ts` is **not dead**: `src/lib/deal-finder/api.ts:89-224` reads it when `PUBLIC_DEAL_FINDER_USE_MOCK_DATA=true`. It is `DISABLED` in the audited production CI configuration and should remain unavailable in production.
- `src/lib/deal-finder/types.ts:2` and Worker source type definitions include `mock`; this is a supported test/source mode, not proof of production mock results.
- Placeholder Xano URLs in login, register, catalog, callback, legacy detail, and moderation pages are defensive configuration sentinels. They are not live API destinations when `PUBLIC_XANO_API_URL` is configured.
- Image placeholders (`/deal-finder-placeholder.svg`, `/sitecraft-logo.png`) are intentional empty-image fallbacks.
- Repository search found no literal `TODO` or `FIXME` markers in `src`, `functions`, or Worker production code and no syntactically empty `catch {}` blocks. Product debt is represented primarily by fallback code, missing contracts, and stale documentation rather than TODO comments.

## Local Fallbacks Requiring Product Labels

AI description, quality score, moderation, and some Deal Finder behavior can fall back to deterministic/local logic. Fallbacks improve resilience, but they are dangerous when the UI labels the result as equivalent to a provider-backed AI result.

Required conventions:

- Include `source: provider | fallback | cached` and model/version in server/UI result types.
- Never deduct a provider credit for a fallback result unless policy explicitly prices local computation.
- Show operators when moderation advice is fallback-only.
- Log provider request ID, latency, cost estimate, and failure class without sensitive prompt/contact data.

## Monolith and Duplication Hotspots

| File | Lines | Status | Recommended extraction |
| --- | ---: | --- | --- |
| `src/pages/dashboard/new.astro` | 3,389 | MAINTENANCE_RISK | workflow state machine, validators, uploader, AI client, draft store, step components |
| `src/pages/admin/moderation.astro` | 1,096 | MAINTENANCE_RISK | queue data store, action service, image manager, detail panel |
| `src/pages/cars/index.astro` | 1,038 | MAINTENANCE_RISK | server query model, filter state, AI search adapter, result renderer |
| `src/lib/deal-finder/client.ts` | large client renderer | MAINTENANCE_RISK | typed stores and reusable card/action components |

Server and client catalog rendering duplicate filtering/presentation responsibilities. Deal Finder also has unused Astro components while runtime DOM is built in TypeScript. Pick a single component strategy to prevent two visual systems from drifting.

## Configuration and Operational TODOs

| Item | Status | Action |
| --- | --- | --- |
| `R2_PUBLIC_BASE_URL` uses old `pages.dev` host (`wrangler.toml:24-32`) | PARTIAL | migrate to custom host or intentional dedicated asset domain |
| Worker deploy absent from Pages GitHub workflow | PARTIAL | add coordinated release/version record and health verification |
| No `public/_headers` | MISSING | add CSP/HSTS/frame/permissions policy and test production headers |
| No R2 orphan/lifecycle collector | MISSING | reconcile object references and delete expired orphans safely |
| No endpoint contract generation | MISSING | automate frontend/Xano path-method-auth drift detection |
| No complete payment integration | MISSING | implement or hide purchase surfaces |

## Documentation Debt

- `docs/product/credits-policy.md:14-74` and `src/lib/credits/model.ts:1-55` describe daily free credits and separate concepts that Xano does not implement.
- `docs/product/stage-3-implementation-status.md:29` instructs enabling a flag that application code never consumes.
- Endpoint TODO documentation is behind deployed Xano metadata.
- Add a generated “current backend contract” and date/version every product policy that controls balances or entitlements.

## Cleanup Plan

### Safe First Pass

1. Remove or quarantine confirmed unused Mac and Deal Finder components.
2. Move `mockCars` to test fixtures or remove it.
3. Remove unused Stage 3 flag or wire it to completed functionality.
4. Replace stale backend TODO constant with generated contract evidence.

### Requires Product Decision

1. Retire or redirect `/cars/detail`.
2. Delete legacy promotion Astro page after confirming the Pages Function redirect and traffic.
3. Hide UI-only dealer, purchase, notification, inbox, and admin product screens, or commit to their backend milestones.
4. Choose Astro component rendering versus client-built HTML for Deal Finder cards.

### Requires Backend Design

1. Moderation image deletion/primary/add lifecycle.
2. R2 orphan reconciliation and retention.
3. Commerce and dealer contracts.
4. Deal Finder workspace/notification/inbox persistence.

## Cleanup Definition of Done

- [ ] No removed symbol has a static/dynamic consumer or production route dependency.
- [ ] Check, all tests, build, and responsive route screenshots pass.
- [ ] Public legacy URLs redirect intentionally and preserve canonical SEO behavior.
- [ ] Every feature flag has an active read site, owner, rollout condition, and removal date.
- [ ] Every fallback is labeled in result types and UI.
- [ ] TODO documentation is generated from or reconciled against deployed backend metadata.
