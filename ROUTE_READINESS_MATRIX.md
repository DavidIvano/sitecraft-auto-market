# SiteCraft Auto Market: Route Readiness Matrix

Audit date: 2026-07-23. Production smoke checks were non-destructive. A `200` on a protected Astro route means its shell is reachable; authorization and mutations were evaluated separately from source/Xano contracts.

## Public Routes

| Route | Page responsibility | Status | Production/readiness note |
| --- | --- | --- | --- |
| `/` | marketplace home | WORKING | 200; public inventory client fetch implemented |
| `/cars/` | catalog, filters, AI search | PARTIAL | 200; normal catalog works, public AI intent endpoint is unmetered |
| `/cars/[slug]/` | canonical vehicle detail | WORKING | 200 on real slug; dynamic detail, contact, JSON-LD |
| `/cars/detail/` | legacy query-string detail | PARTIAL | duplicate legacy implementation; removal/redirect candidate |
| `/sell/` | seller entry page | WORKING | 200; routes users into listing workflow |
| `/pricing/` | pricing/product offers | BROKEN | renders offers but no complete checkout/fulfilment; SKU model drift |
| `/support/` | support | WORKING | 200 |
| `/privacy/` | privacy policy | WORKING | 200 and sitemap entry |
| `/impressum/` | legal imprint | PARTIAL | 200, linked globally, omitted from static sitemap list |
| `/login/` | email/Google login | PARTIAL | 200; functional API, missing rate-limit/OAuth hardening |
| `/register/` | account creation | BROKEN | 200; backend OAuth-only account takeover risk |
| `/auth/google/callback/` | OAuth callback | PARTIAL | client continuation; state/PKCE not demonstrated |
| `/auth/check/` | session helper | PARTIAL | utility route; client-token model remains XSS-sensitive |
| `/payment/success/` | purchase fulfilment return | BROKEN | calls missing purchase-apply contract |
| `/payment/cancel/` | cancelled payment state | UI_ONLY | no complete checkout can reach it reliably |
| `/service-unavailable/` | graceful failure | WORKING | static fallback |
| `/404/` | not found | WORKING | build route present |
| `/robots.txt` | crawler policy | WORKING | 200; private routes disallowed |
| `/sitemap.xml` | public URL feed | PARTIAL | 200; dynamic approved cars, noisy static `lastmod` |

## Seller Dashboard

| Route | Page responsibility | Status | Backend/UX note |
| --- | --- | --- | --- |
| `/dashboard/` | account summary | WORKING | client-auth shell; real `/dashboard/summary` |
| `/dashboard/listings/` | seller inventory | WORKING | real list/edit/delete/promote paths |
| `/dashboard/listings/edit/?id=` | listing edit/review | WORKING | GET/PATCH listing and submit flow |
| `/dashboard/new/` | manual + AI creation | PARTIAL | complete core flow; 3,389-line monolith and inconsistent AI charging |
| `/dashboard/billing/` | balance/history | PARTIAL | wallet/history real; cannot buy credits |
| `/dashboard/cars/promote/?id=` | canonical promotion UI | WORKING | transactional/idempotent Xano mutation |
| `/dashboard/cars/[id]/promote/` | legacy promotion route | PARTIAL | Pages Function redirects to canonical route; Astro implementation is dead |
| `/dashboard/dealer/` | dealer profile/plan | UI_ONLY | expected dealer endpoints/tables missing |

## Administration

| Route | Page responsibility | Status | Backend/UX note |
| --- | --- | --- | --- |
| `/admin/moderation/` | queue and listing decisions | PARTIAL | core actions work; archive/restore/image actions missing |
| `/admin/dealers/` | dealer management | UI_ONLY | no `/admin/dealers` API |
| `/admin/paid-products/` | product management | UI_ONLY | explicit fallback; no CRUD contract |
| `/admin/purchases/` | purchase operations | UI_ONLY | no purchase API/state machine |

## Deal Finder

| Route | Page responsibility | Status | Backend/UX note |
| --- | --- | --- | --- |
| `/dashboard/deal-finder/` | today/feed/stats/filtering | PARTIAL | real auth list/stats; N+1 backend analysis lookups |
| `/dashboard/deal-finder/listing/?id=` | detail and actions | PARTIAL | real detail/actions/analyze; translation endpoint missing |
| `/dashboard/deal-finder/watchlist/` | saved proposals | WORKING | server filter/action contracts exist |
| `/dashboard/deal-finder/hidden/` | hidden and restore | WORKING | server filter/restore exists |
| `/dashboard/deal-finder/searches/` | search profiles | PARTIAL | GET exists; create/update/delete are missing |
| `/dashboard/deal-finder/compare/` | compare shortlist | UI_ONLY | localStorage state, no server collaboration |
| `/dashboard/deal-finder/notifications/` | notification rules | UI_ONLY | local preview/preferences only, no delivery API |
| `/dashboard/deal-finder/inbox/` | source email inbox | UI_ONLY | API helper returns empty array |

## Function Routes

| Route | Handler | Status | Note |
| --- | --- | --- | --- |
| `/api/upload-listing-images` | `functions/api/upload-listing-images.ts:24-320` | WORKING | auth/origin/MIME/size enforced, R2 upload |
| `/api/r2-images/*` | `functions/api/r2-images/[[key]].ts:1-42` | WORKING | public immutable object delivery |
| `/dashboard/cars/[id]/promote` | `functions/dashboard/cars/[id]/promote.ts:1-16` | WORKING | redirect only |
| `/dashboard/drafts/[id]` | `functions/dashboard/drafts/[id].ts` | PARTIAL | dynamic draft wrapper; user cache key differs from shared auth key |

`public/_routes.json:1-18` includes `/cars/*`, `/sitemap.xml`, promotion, drafts, and `/api/*`, so these paths reach Advanced Mode as intended.

## Route-Level UX Findings

1. **Protected shell flash:** dashboard/admin/Deal Finder pages render static shells before client auth resolves. Use a consistent authenticated loading state and never show a forbidden verdict until `/auth/me` has definitively returned 401/403.
2. **Catalog density:** `src/pages/cars/index.astro` combines AI prompt, filters, sorting, results, and duplicated client rendering in 1,038 lines. On mobile, collapse secondary filters and keep result count/sort sticky.
3. **Listing creation:** `src/pages/dashboard/new.astro` should become a route-level state machine with isolated manual/AI steps, autosave visibility, retry states, and a final review screen.
4. **Moderation:** hide missing archive/image commands or label them disabled; fallback AI verdicts must be visually distinguished from provider verdicts.
5. **Billing/pricing:** never route a buy CTA to a history-only page. Disable paid CTAs until checkout exists, or clearly label a waitlist/contact flow.
6. **Deal Finder mobile:** primary tabs should remain horizontally scrollable, cards should use one column at narrow widths, and metadata/actions should not use equal narrow columns that split city names and button labels.
7. **Admin placeholders:** remove UI-only admin routes from production navigation until permissions and API contracts exist.

## Route Definition of Done

- [ ] Direct navigation and refresh preserve authenticated state without a false forbidden screen.
- [ ] Loading, empty, unavailable, unauthenticated, forbidden, validation, and retry states are distinct.
- [ ] Every visible action has an implemented authorized endpoint and success/error confirmation.
- [ ] Keyboard navigation, labels, focus states, and 44px-equivalent touch targets are verified.
- [ ] Layout passes 360px phone, 768px tablet, 1024px narrow desktop, and 1440px desktop screenshots.
- [ ] Protected content is not indexed and public canonical URLs are stable.
- [ ] Route analytics and error reporting identify failed business actions, not only page views.
