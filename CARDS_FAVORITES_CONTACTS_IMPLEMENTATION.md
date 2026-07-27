# Cards, Favorites, Contacts and Deal Finder Actions

## Summary

Work is prepared on `feat/favorites-cards-contacts`. No production deploy, Xano schema mutation, endpoint publication, or real user-data mutation was performed.

Completion update (26 July 2026): server-batch favorite status, real translation blueprint, Luna model consolidation, idempotent AI credit drafts, reloadable listing drafts, and the expanded browser matrix are now covered in `LOCAL_FEATURE_COMPLETION_REPORT.md`. This file remains the focused cards/favorites/contacts design record.

## Root cause

`renderPublicCarCardMarkup` rendered an `article` with `role="link"` and relied on a document click handler plus `window.location.assign`. The image was a lightbox button and the favorite control was another button in the same composite surface. Seller cards reused this renderer, so their navigation depended on JavaScript and overlapping interactive layers instead of a native destination. Favorites were stored only in `localStorage` under `sitecraft-public-car-favourites`, so they could not synchronize between pages or devices.

## Targeted audit

- Canonical card: `src/components/CarCard.astro` + `src/lib/publicCarCard.ts`.
- Home/catalog dynamic rendering: the same string renderer and `publicCarCardsClient.ts`.
- Seller cards: `/cars/[slug].astro`, already using `CarCard` but inheriting the broken interaction.
- Similar cards: a separate custom link; now normalized to `CarCard`.
- Auth: `authClient.ts`; legacy `next` accepted unchecked. It is now normalized to an internal `returnTo`.
- Production Xano read-only metadata confirmed `automarket_users` table `861779` and `car_listings` table `861468`.
- Current `automarket_users` has `name`, login `email`, OAuth fields and role, but no explicit public-contact consent fields.
- Deal Finder save/unsave remains a separate owner-scoped subsystem and was not mixed with public favorites.

## Frontend changes

- Native full-card `<a href="/cars/{slug}/">`; favorite button is a sibling overlay.
- Shared `FavoriteButton` renderer/component with optimistic states, 44px target, Lucide heart, rollback, toast, request locking, and cross-instance event.
- New `/dashboard/favorites/` and a separate saved-car summary card in `/dashboard/`.
- Shared `VehicleSpecItem`/`VehicleSpecsGrid` with Lucide icons for quick and full details.
- Seller contact modal uses only the public contact DTO, supports `tel:`/`mailto:`, backdrop/Escape close, and returns focus.
- Contact-profile form requires explicit phone/email visibility choices; Google/login email is never used as a public fallback.
- Deal Finder cards use shared semantic `ActionButton` markup with existing source/save/view/hide/restore/compare/analyze/detail actions.

## Xano draft batch

Files: `docs/xano/public-favorites-contacts/`.

Schema draft:

- `car_listing_favorites(id, created_at, user_id, car_listing_id)`.
- Unique index `(user_id, car_listing_id)`.
- Public-profile fields on `automarket_users`: first/last/display name, contact phone/email, visibility flags, preferred method.
- Cascade or reviewed server-side cleanup is required when users/listings are deleted.

Endpoint drafts:

- `GET /favorites`
- `POST /favorites/{listing_id}`
- `DELETE /favorites/{listing_id}`
- `GET /me/contact-profile`
- `PATCH /me/contact-profile`
- Response patches for `GET /cars`, `GET /cars/{slug}`, seller listings, and `GET /dashboard/listings`.

All mutations derive `user_id` from `$auth.id`. The public seller response projects only opted-in contact values. Optional-auth behavior for public `/cars` must be compiled in Xano; if unsupported, use one authenticated batch status endpoint rather than N+1 requests.

## Workflows

Favorite click updates every instance immediately, sends authenticated POST/DELETE, treats idempotent conflict/not-found safely, rolls back on failure, and redirects anonymous users to `/login/?returnTo={internal-path}`. The dashboard page removes an unsaved card without reload.

Seller profile values are edited only by the authenticated owner. Xano validates E.164 phone and visibility prerequisites. Public listing responses include only fields whose visibility flag is enabled. The modal cannot recover hidden values from listing legacy fields or auth state.

## Security

- No `user_id` is accepted from favorite/profile frontend payloads.
- Delete is scoped by both `$auth.id` and listing ID.
- `returnTo` rejects absolute URLs, protocol-relative URLs, and backslash paths.
- Contact metadata is not added to SEO or JSON-LD and is not sent to analytics.
- External Deal Finder source URLs continue through the existing URL validator.

## Verification

- `npm run check`: passed with 0 errors, 0 warnings and 0 hints.
- `npm test`: 251/251 tests passed.
- `npm run build`: passed; the Cloudflare Worker bundle was prepared locally.
- Browser QA passed for the public catalog and vehicle detail at 1280px and 390px. Both mobile pages reported `scrollWidth === innerWidth`, with no horizontal overflow or console errors.
- The mobile seller-contact dialog opened from the seller section and exposed only the opted-in `mailto:` action returned by the public DTO.
- A local Lucide `arrow-up` warning found during QA was fixed by registering `ArrowUp` in `publicCarCardsClient.ts`; a clean-tab repeat produced no warnings or errors.
- Anonymous `/dashboard/favorites/` correctly redirected to `/login?returnTo=%2Fdashboard%2Ffavorites%2F`.
- Authenticated favorites API behavior and Deal Finder mutations were not claimed as production E2E: the Xano batch remains an unpublished draft. The local Deal Finder UI flag is enabled, but protected backend actions still require a valid session and published Xano contracts.

Screenshots:

- `artifacts/qa/cars-desktop.png`
- `artifacts/qa/cars-mobile-top.png`
- `artifacts/qa/cars-mobile-cards.png`
- `artifacts/qa/car-detail-desktop.png`
- `artifacts/qa/car-detail-mobile.png`
- `artifacts/qa/contact-modal-mobile.png`

## Remaining production steps

1. Review and compile the Xano drafts in a non-production branch/workspace.
2. Confirm optional auth for public car endpoints or publish the batch status fallback.
3. Run authenticated API integration tests for ownership, idempotency, hidden contacts, and unavailable listings.
4. Publish Xano first, then frontend, because the new frontend routes depend on the new endpoints.
