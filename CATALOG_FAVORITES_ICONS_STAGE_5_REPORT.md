# Catalog, Favorites and Icons Stage 5 Report

Date: 2026-07-29
Production: https://automarket.sitecraft.agency
Cloudflare Pages project: `sitecraft-auto-market`

## Executive summary

Stage 5 is deployed. The home page, catalog, filtered cards and favorites now use the common `renderPublicCarCardMarkup()` renderer. The legacy 548 px card stretch is removed, every card prints an exact non-negative `views_total` with a Lucide `Eye`, and favorites use one authenticated, optimistic, response-confirmed client flow. Dashboard actions use a shared Lucide registry.

The public production QA is complete across desktop, tablet and mobile widths. The final authenticated click-through in the user's existing Chrome profile could not be completed because the Chrome extension connection repeatedly stopped while attaching to or reading the authorized tab. No existing favorite was changed during those interrupted attempts. Backend contracts, static regression coverage, unauthenticated redirect behavior, Xano endpoint compilation and public production rendering were verified independently.

## Root causes

1. Two late legacy CSS rules forced catalog cards to `min-height: 548px`; `flex: 1` and auto margins then amplified the empty area.
2. Card views used a presentation threshold and replaced low values with `Новое`, so the UI did not display the source of truth.
3. Lucide initialization was fragmented and did not reliably rerun after client rendering.
4. Favorite state initialization and mutations could race session restoration, duplicate status requests, or leave UI state out of sync after an error.
5. Favorites, related cars and seller listings did not consistently return `views_total`.

## Frontend changes

- Added `src/lib/appIcons.ts`: one Lucide registry and one `refreshAppIcons()` entry point.
- Updated `src/lib/publicCarCard.ts`: shared compact markup, stable footer, exact views, `Eye`, `MapPin` and independent `Heart` button.
- Updated `src/lib/publicCarCardsClient.ts`: one guarded listener, one queued batch status request, fresh-token reads, bounded status retry, optimistic mutation with rollback, synchronized duplicate buttons and `car-favorite-changed` events.
- Updated `src/lib/favorites.ts`: consistent accessible save/remove labels.
- Updated `src/pages/dashboard/favorites.astro`: common card renderer, server total, bounded retry, in-place removal and empty state.
- Updated `src/pages/dashboard/index.astro` and `src/pages/dashboard/listings.astro`: live favorite summary and unified action icons.
- Updated `src/layouts/BaseLayout.astro` and `src/components/Header.astro`: shared icon initialization and SVG `Plus` actions.
- Added SVG `Plus` to the existing add/sell actions in `src/pages/index.astro`, `src/pages/cars/index.astro`, `src/pages/dashboard/new.astro`, `src/pages/sell.astro`, `src/pages/auth/check.astro` and `src/pages/admin/moderation.astro` without adding duplicate CTAs.
- Updated `src/styles/global.css`: removed both 548 px rules, stopped tile stretching, preserved desktop list mode and made the compact footer safe at narrow widths.

## Card and responsive QA

Production catalog results after deployment:

| Width | Columns | Observed card height | Page/footer overflow |
| --- | ---: | ---: | --- |
| 1440 | 3 | 427 px | none |
| 1280 | 3 | 484 px | none |
| 1024 | 3 | 443 px | none |
| 768 | 2 | 467 px | none |
| 390 | 1 | 460 px | none |
| 360 | 1 | 441 px | none |

At 1440 px the catalog rendered 11 cards, 11 `Eye` SVGs, 11 `Heart` SVGs, zero remaining Lucide placeholders and zero `Новое` view substitutions. The home page rendered 8 cards with the same renderer and icon behavior. Desktop list mode remains image-left/content-right and measured 360 px high without overflow.

Screenshots:

- `artifacts/catalog-favorites-icons-stage-5/home-desktop.png`
- `artifacts/catalog-favorites-icons-stage-5/catalog-desktop.png`
- `artifacts/catalog-favorites-icons-stage-5/catalog-390.png`

## Views

`views_total` is normalized with `Math.max(0, Number(value) || 0)` and is always displayed, including 0, 1 and values below 5. There is no per-card views request and no new counter or table.

The following existing Xano documents were patched so secondary card collections receive numeric `views_total` without N+1 queries:

- GET `/favorites`, endpoint ID `3997836`.
- GET `/cars/{slug}/related`, endpoint ID `3999920`.
- GET `/cars/{slug}/seller-listings`, endpoint ID `3985671`.

All three documents compiled and the transactional push reported three updated documents. A live public related-cars response returned HTTP 200 with numeric `views_total`. Seller listings returned HTTP 200 for the tested car. GET `/favorites` without authorization returned the expected HTTP 401.

## Favorites

Existing routes remain in use:

- GET `/favorites` (`3997836`).
- POST `/favorites/status` (`3997835`).
- POST `/favorites/{listing_id}` (`3997834`).
- DELETE `/favorites/{listing_id}` (`3997833`).

The existing unique compound index `(user_id, car_listing_id)` in `car_listing_favorites` was confirmed and not duplicated. Existing endpoint behavior is scoped to the authenticated `automarket_users` user, checks the public listing, is idempotent, and deletes only the current user's record.

Client behavior now includes:

- full current path preserved on guest redirect;
- no optimistic active state for a confirmed guest;
- one batch status request for up to 100 listing IDs;
- direct `car.id` use;
- per-button pending state;
- response-confirmed state and rollback;
- no logout on ordinary network errors;
- `401`, `403`, `404`, `409`, `422` and 5xx separated;
- all buttons for the same car synchronized;
- favorites card removed without a full page reload;
- dashboard total refreshed from the server rather than inferred from current DOM.

The guest scenario was verified locally: clicking a heart redirected to `/login/?returnTo=%2F` and did not activate the heart. Parameterized regression tests cover add/remove, batch status, rollback, session timing, duplicate listener prevention, favorites rendering and empty state. These tests are contract/integration tests, not a substitute for the interrupted authorized Chrome E2E.

## Icons

The single application registry includes `Eye`, `Heart`, `Plus`, `CarFront`, `MapPin`, `Calendar`, `Gauge`, `Fuel`, `Settings2`, `ArrowUp`, `BadgeCheck`, `Sparkles`, `Trash2`, `Pencil`, `MoreHorizontal`, `Coins` and the remaining icons already used by the shell. Initialization runs after SSR startup and after dynamic card, favorites and dashboard rendering. Icon-only actions have accessible labels and titles.

## Backups and rollback

Repository pre-change copies:

`.backups/catalog-favorites-icons-stage-5/`

External Xano live copies before the push:

`/Users/david/.codex/audits/sitecraft-auto-market/catalog-favorites-icons-stage-5-live-before-2026-07-29-01`

External Xano live copies after the push:

`/Users/david/.codex/audits/sitecraft-auto-market/catalog-favorites-icons-stage-5-live-after-2026-07-29-01`

Transactional push staging:

`/Users/david/.codex/audits/sitecraft-auto-market/catalog-favorites-icons-stage-5-push-2026-07-29-01`

Rollback is performed by restoring the repository copies for the listed files, restoring the three live Xano documents from the external before folder, rebuilding `dist/client`, and redeploying that build to the existing Pages project. No secrets are stored in the repository backup.

## Verification

- `npm run check`: passed, 0 errors, 0 warnings, one non-blocking Astro hint.
- `npm test`: passed, 308/308 tests.
- `npm run build`: passed; Cloudflare Advanced Mode worker prepared in `dist/client/_worker.js`.
- Legacy `min-height: 548px`: zero remaining matches.
- Production public console: no errors in the completed QA session.
- Production responsive QA: passed at 1440, 1280, 1024, 768, 390 and 360 px.
- Authorized Chrome E2E: blocked by repeated browser-extension control interruption before DOM inspection; no favorite mutation was made.

## Deployment

Cloudflare Pages deployment ID:

`cebe9472-a0a0-4043-bc5b-b1464e73ebfa`

Deployment URL:

`https://cebe9472.sitecraft-auto-market.pages.dev`

The same build is active on `https://automarket.sitecraft.agency`.

## Remaining action

Run one short authorized production smoke when stable Chrome control is available: add one currently unsaved car, reload and confirm the filled heart, verify it in `/dashboard/favorites/`, remove it there, and confirm the dashboard server total. This is the only uncompleted verification item; implementation, Xano push, automated tests, build, deployment and public visual QA are complete.
