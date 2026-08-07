# SiteCraft Auto Market: Stage 7 Design System Report

Date: 2026-07-29

## Executive summary

Stage 7 separates the public marketplace, workspace, auth and legal surfaces while keeping one `BaseLayout` with an explicit route-owned `variant`. The UI now uses one token layer, one button geometry, bounded action grids, one Lucide registry, common states and the existing shared public car-card renderer. Public routes no longer receive the workspace sidebar; workspace routes no longer render the public navigation or duplicate sell CTA.

The work is frontend-only. Xano schemas, endpoints, production data, credits and business rules were not changed.

## Route audit

| Route | Type | Variant | Main UI | CTA / action rows after | Result |
|---|---|---|---|---:|---|
| `/` | Marketplace | public | Hero, search, AI benefits, shared cards | 2 / 1 | Two hero CTAs; core filters first; extras collapsed |
| `/cars/` | Catalog | public | AI search, filters, toolbar, shared cards | 4 / 2 | Grid/list icons and bounded action grid |
| `/cars/[slug]/` | Vehicle | public | Gallery, summary, specs, seller, related | 3 / 2 | 60/40 desktop composition and touch-safe gallery controls |
| `/cars/brand/[brand]/` | SEO catalog | public | Facet heading and shared cards | 1 / 1 | Same public shell and card system |
| `/cars/brand/[brand]/[model]/` | SEO catalog | public | Model heading and shared cards | 1 / 1 | Same public shell and card system |
| `/cars/detail/` | Legacy vehicle | public | Legacy detail compatibility | 2 / 1 | Public shell and Lucide navigation |
| `/sell/` | Seller entry | public | Four-step explanation and upload entry | 1 / 1 | Canonical `Продать авто` terminology |
| `/pricing/` | Commerce | public | Pricing plans | 1 per plan | 3/2/1 responsive grid, content height |
| `/login/` | Auth | auth | Login and product benefits | sequential | Content-sized form, Google asset, Eye icon |
| `/register/` | Auth | auth | Registration and product benefits | sequential | Content-sized form and consistent controls |
| `/privacy/` | Legal | legal | Narrow policy content | 0 | 800 px reading measure; no sidebar |
| `/impressum/` | Legal | legal | Narrow legal content | 0 | 800 px reading measure; no sidebar |
| `/support/` | Legal/support | legal | Contact and help content | 2 / 1 | Narrow layout and common controls |
| `/dashboard/` | Workspace | workspace | Overview, summaries, contacts | up to 4 / 2 | One workspace navigation system |
| `/dashboard/new/` | Workspace | workspace | Listing workflow and AI helper | 2 / 1-2 | One creation workflow and bounded actions |
| `/dashboard/listings/` | Workspace | workspace | Owner listing management | up to 4 / 2 | Primary actions plus overflow menu |
| `/dashboard/listings/edit/` | Workspace | workspace | Listing editor and contact profile | 2 / 1 | Responsive form sections |
| `/dashboard/favorites/` | Workspace | workspace | Shared saved-car cards | 1 / 1 | Catalog renderer and common empty state |
| `/dashboard/billing/` | Workspace | workspace | Credits and purchases | 1 / 1 | Compact workspace shell |
| `/dashboard/dealer/` | Workspace | workspace | Dealer tools | contextual | Compact workspace shell |
| `/dashboard/cars/[id]/promote/` | Workspace | workspace | Promotion checkout | 2 / 1 | Unified controls |
| `/dashboard/cars/promote/` | Workspace | workspace | Promotion compatibility | 2 / 1 | Unified controls |
| `/dashboard/deal-finder/` | Workspace | workspace | Today, filters and operational cards | 2 / 1-2 | Compact nav and responsive filter grid |
| `/dashboard/deal-finder/listing/` | Workspace | workspace | Internal listing detail | up to 4 / 2 | Shared action geometry and Lucide icons |
| `/dashboard/deal-finder/watchlist/` | Workspace | workspace | Shortlist | contextual | Common Deal Finder navigation |
| `/dashboard/deal-finder/hidden/` | Workspace | workspace | Hidden listings | contextual | Common Deal Finder navigation |
| `/dashboard/deal-finder/searches/` | Workspace | workspace | Saved searches | contextual | Common Deal Finder navigation |
| `/dashboard/deal-finder/compare/` | Workspace | workspace | Comparison | contextual | Responsive workspace shell |
| `/dashboard/deal-finder/notifications/` | Workspace | workspace | Notification rules | contextual | Responsive workspace shell |
| `/dashboard/deal-finder/inbox/` | Workspace | workspace | Notification inbox | contextual | Responsive workspace shell |
| `/admin/moderation/` | Admin workspace | workspace | Moderation queue | up to 4 / 2 | Secondary mutations moved to overflow |
| `/admin/dealers/` | Admin workspace | workspace | Dealer administration | contextual | Role-gated sidebar item |
| `/admin/paid-products/` | Admin workspace | workspace | Paid products | contextual | Role-gated sidebar item |
| `/admin/purchases/` | Admin workspace | workspace | Purchases | contextual | Role-gated sidebar item |
| `/payment/success/` | Transaction state | public | Success state | 1 / 1 | Public shell |
| `/payment/cancel/` | Transaction state | public | Cancel state | 1 / 1 | Public shell |
| `/404` | Error | public | `ErrorState` | 1 / 1 | Shared state component |
| `/service-unavailable` | Error | public | `ErrorState` | 1 / 1 | Shared state component |
| `/auth/check/` | Auth utility | auth | Session check | 0 | Auth shell semantics |
| `/auth/google/callback/` | Auth utility | auth | OAuth callback | 0 | Auth shell semantics |
| `/robots.txt`, `/sitemap.xml` | Technical SEO | none | HTTP resources | 0 | Behavior unchanged |

## Priority findings and resolution

1. Critical visual inconsistency: public and workspace navigation were rendered together. Resolved with explicit layout variants on every route.
2. High mobile risk: mixed button sizes, wrapped action lists and text symbols. Resolved with tokenized controls, two-row action grids and Lucide SVG.
3. High content-density issue: fixed-height car/auth surfaces created empty space. Removed `548px` card height and auth minimum height.
4. Medium consistency issue: independent loading, empty and error treatments. Added common state components.
5. Medium mobile header issue found in final QA: brand, theme and menu wrapped into two rows. Resolved with a stable three-column mobile header grid.

## Layout system

`BaseLayout.astro` owns `public`, `workspace`, `legal` and `auth` variants. Routes select the variant directly. Public pages render header/main/footer without workspace navigation. Workspace pages render a 248 px sidebar, a 72 px compact sidebar at tablet widths and bottom navigation on mobile. Auth and legal pages retain the public frame but use purpose-specific content widths.

## Design tokens

- Spacing: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 72px`.
- Radius: controls `10px`, cards `14px`, panels `18px`, dialogs `20px`, pills `999px`.
- Controls: `36, 44, 48px`.
- Icons: `14, 18, 22px`.
- Container: `1180px`; page padding `16/24/32px`.
- Canonical files: `src/styles/tokens.css` and `src/styles/design-system.css`, loaded after the compatibility stylesheet.

## Buttons and actions

The canonical variants are primary, secondary/light, ghost, danger, icon-only and compact. Controls have consistent default, hover, active, focus-visible, disabled and loading states. Action groups use two columns; a long primary action spans both. Listing and moderation surfaces expose no more than four actions and place remaining operations in an overflow menu.

## Icons

`src/lib/appIcons.ts` is the single Lucide registry and initializer. It installs one refresh listener and supports dynamic fragments through `refreshAppIcons(root)`. Theme, password visibility, gallery, pagination, filter, view switch, moderation and upload controls no longer use `◐`, `‹`, `›`, `✓`, emoji eyes or text close symbols.

## Cards and states

Home, catalog, favorites, related vehicles and dynamic results continue to use `renderPublicCarCardMarkup()`. Cards have 16:10 media, clamped titles, auto content height and start-aligned grids. Generic `LoadingState`, `EmptyState`, `ErrorState` and `SkeletonCard` components provide one visual language for transient states.

## Page-by-page visual changes

| Surface | Before | After | Padding | CTA / rows | Responsive result |
|---|---|---|---|---|---|
| Home | Repeated navigation and 3+ competing actions | Public shell and two hero CTAs | mixed -> `16/24/32` | `3+ -> 2`, one row | Core filters remain readable at 360 px |
| Catalog | Vertical AI controls and text view symbols | 2x2 actions and Lucide grid/list | mixed -> `24/32` | `4 -> 4`, two rows | 4/2/1 filter geometry |
| Vehicle | Mixed gallery controls | Lucide controls and stable 60/40 split | mixed -> token scale | `3`, two rows | Single-column summary at mobile |
| Sell | Multiple creation names | One `Продать авто` entry | mixed -> token scale | `2 -> 1` | One-column mobile workflow |
| Pricing | Uneven plan heights | Content-height 3/2/1 grid | mixed -> `24` | one per plan | No fixed empty area |
| Login/register | Artificial minimum height and text password action | Content height, Google SVG, Eye/EyeOff | mixed -> `24/32` | sequential | Full-width form controls |
| Legal/support | Workspace chrome and wide reading line | Legal shell and 800 px measure | mixed -> `48/72` block | contextual | 16 px mobile gutter |
| Dashboard | Public and workspace actions duplicated | One sidebar and compact header | mixed -> `24/32` | up to 4, two rows | Compact/sidebar/bottom-nav modes |
| My listings | Long vertical action list | 2x2 actions plus More | mixed -> token scale | `3-6 -> <=4`, two rows | Touch-safe at 360 px |
| New/edit | Dense mixed sections | Tokenized steps and form sections | mixed -> `16/24` | max two rows | 2 columns desktop, 1 mobile |
| Favorites | Independent presentation | Shared public cards and state | mixed -> token scale | one primary | Same card geometry as catalog |
| Deal Finder | Dense internal nav and wrapping controls | Compact workspace shell and bounded grids | mixed -> token scale | max two rows | No horizontal overflow |
| Moderation | Many visible mutation buttons | Up to four actions and overflow menu | mixed -> token scale | `>4 -> 4`, two rows | Menu contains secondary operations |

## Files changed

- Layout/navigation: `src/layouts/BaseLayout.astro`, `src/components/Header.astro`.
- Core UI: `src/components/auth/AuthShell.astro`, `src/components/media/ImageLightbox.astro`.
- Shared states: `src/components/states/LoadingState.astro`, `EmptyState.astro`, `ErrorState.astro`, `SkeletonCard.astro`.
- Styling: `src/styles/tokens.css`, `src/styles/design-system.css`.
- Icons and UI clients: `src/lib/appIcons.ts`, `src/lib/authUi.ts`, `src/lib/dashboardListings.ts`, `src/lib/publicCarCard.ts`, `src/lib/deal-finder/client.ts`.
- Public asset: `public/google-g.svg`.
- Routes: all `.astro` files under `src/pages/` now declare an explicit layout variant; home, catalog, vehicle, sell, pricing, auth, legal, dashboard, listings, favorites, Deal Finder and admin moderation received scoped UI changes.
- Tests: `tests/full-design-system-stage-7.test.ts`, `tests/auth-ui.test.ts`, `tests/catalog-favorites-icons-stage-5.test.ts`, `tests/deal-finder.test.ts`, `tests/seller-workflow-stage-3.test.ts`.

## Verification

- `npm install`: exit 0; no vulnerabilities.
- `npm run check`: exit 0; 0 errors, one existing TypeScript conversion hint.
- `npm test`: exit 0; 325 passed, 0 failed.
- `npm run build`: exit 0; Cloudflare Advanced Mode bundle prepared.
- Responsive overflow scan: 19 representative routes x 6 widths; no horizontal overflow.
- Static regression coverage verifies layout ownership, button geometry, icons, shared cards and responsive constraints. It is not a substitute for authenticated production E2E.

## Screenshots

- Before: `artifacts/design-audit-stage-7/before/` (114 PNG files and six contact sheets).
- After: `artifacts/design-audit-stage-7/after/` (114 PNG files and six contact sheets).
- Widths: 1440, 1280, 1024, 768, 390 and 360 px.
- Local Cloudflare runtime: `wrangler pages dev dist/client`.

## Functional confidence

The 325-test suite covers auth restoration, favorites, contact profile behavior, manual and AI listing publication contracts, shared cards, SSR catalog/detail rendering, sitemap, Deal Finder and moderation access contracts. Local browser QA covered the real public routes and protected-route shells. No real production user data was mutated during Stage 7.

Production browser smoke confirmed the canonical `/cars/` public shell and `/dashboard/listings/` workspace shell at 390 px with no horizontal scroll and no console warnings or errors. The current in-app session was not treated as a reliable authenticated E2E fixture: `/dashboard/` and `/dashboard/favorites/` correctly resolved to login in that session, while route shells for listings and new-listing remained observable. No save, favorite, contact, listing publication or moderation mutation was submitted in production.

## Deployment

- Cloudflare Pages project: `sitecraft-auto-market`.
- Deployment ID: `15f37846-1d51-4443-831f-f549f8d94c40`.
- Deployment URL: `https://15f37846.sitecraft-auto-market.pages.dev`.
- Production URL: `https://automarket.sitecraft.agency`.
- Public HTTP integration: exit 0 for sitemap, catalog, brand/model SEO routes, real vehicle detail and a fail-closed unknown brand.
- Production browser smoke: public/workspace shell ownership correct, 390 px `scrollWidth === innerWidth`, clean console.

## Backups and rollback

Changed originals are stored in `.backups/full-design-system-stage-7/`. The backup excludes `.git`, dependencies, build output, environment files, tokens, cookies and production data. Rollback is a local file restore followed by the same direct Pages build/deploy workflow.

## Remaining risk

Authenticated production mutations were deliberately not exercised during visual work. The next QA task should use a dedicated account/listing fixture to submit favorite, contact and listing-form mutations without touching owner data.
