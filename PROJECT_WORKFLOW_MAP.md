# SiteCraft Auto Market: Workflow Map

Audit basis: production commit `cdb94115892fa275f6670094a9ff2c0645530694`, repository inspection, and read-only Xano metadata on 2026-07-23.

## System Topology

```mermaid
flowchart LR
  U["Browser user"] --> P["Cloudflare Pages / Astro"]
  P --> F["Pages Functions"]
  P --> X["Xano API jAAj839u"]
  F --> X
  F --> R["Cloudflare R2 car-images"]
  X --> O["OpenAI/provider calls"]
  W["Deal Finder Worker"] --> X
  W --> S["External listing source"]
  W --> O
  C["Cloudflare Cron"] --> W
```

| Surface | Responsibility | Release mechanism | Status |
| --- | --- | --- | --- |
| Astro frontend | public and authenticated UI, client orchestration | GitHub Actions -> Cloudflare Pages | WORKING |
| Pages Functions | R2 upload/read, promotion/draft route handlers | bundled into Pages Advanced Mode | WORKING |
| Xano | auth, listings, moderation, credits, AI, Deal Finder state | managed separately in Xano | PARTIAL operational coupling |
| R2 | listing image objects | Cloudflare binding `CAR_IMAGES` | WORKING |
| Deal Finder Worker | source sync and queued AI analysis | separate Wrangler deployment | UNKNOWN live version |

## Identity and Session

```mermaid
sequenceDiagram
  participant B as Browser
  participant A as authClient
  participant X as Xano
  B->>A: Login / Google callback
  A->>X: POST auth/login or OAuth continue
  X-->>A: authToken + user
  A->>A: localStorage + JS cookie (60 days)
  A->>X: GET auth/me with Bearer token
  X-->>A: user and role
  A-->>B: Render role-aware UI
```

- Entry points: `src/pages/login.astro:115-245`, `src/pages/register.astro:104-180`, `src/pages/auth/google/callback.astro:81-211`.
- Session manager: `src/lib/authClient.ts:1-243`.
- Backend contracts: POST `/auth/login` 3968548, POST `/auth/register` 3968549, GET `/auth/me` 3968077, GET `/oauth/google/init` 3968076, POST OAuth continuation 3968099.
- `BROKEN`: duplicate registration of an OAuth-only email can set a password without identity verification. This workflow must be repaired before public sign-up.
- `PARTIAL`: frontend role visibility is a convenience only; Xano correctly needs to remain the authorization authority.

## Public Buyer Journey

```mermaid
flowchart TD
  H["Home"] --> C["Catalog /cars"]
  C --> F["Filters and sorting"]
  C --> AI["AI intent parser"]
  F --> D["Vehicle /cars/[slug]"]
  AI --> D
  D --> CT["Phone / email seller"]
  D --> SV["Record listing view"]
  C --> SS["Save search"]
```

| Step | Contract | Status | Notes |
| --- | --- | --- | --- |
| Load inventory | GET `/cars` 3966698 | WORKING | public approved projection |
| Open vehicle | GET `/cars/{slug}` 3966699 | WORKING | seller contact and masked VIN |
| Related seller stock | GET `/cars/{slug}/seller-listings` 3985671 | WORKING | public projection |
| Record view | POST `/analytics/listing-view` 3981281 | WORKING | public endpoint |
| AI query parsing | POST `/ai/search/intent` 3981451 | BROKEN | public, unmetered, no observed rate limit |
| Save search | POST `/saved-searches` 3981320 | WORKING | authenticated |

## Manual Seller Listing

```mermaid
sequenceDiagram
  participant S as Seller
  participant UI as dashboard/new
  participant PF as Pages Function
  participant R2 as R2
  participant X as Xano
  S->>UI: Complete fields and select images
  UI->>PF: POST /api/upload-listing-images
  PF->>X: GET /auth/me
  PF->>R2: Put validated user-scoped objects
  PF-->>UI: Public image URLs
  UI->>X: POST /cars
  X-->>UI: Listing id
  UI->>X: PATCH /cars/{id}/submit
  X-->>UI: Pending moderation
```

- UI orchestration: `src/pages/dashboard/new.astro:3180-3428`.
- Upload: `functions/api/upload-listing-images.ts:24-320`.
- Contracts: POST `/cars` 3966700, PATCH `/cars/{id}/submit` 3966701.
- `WORKING`: normal success path is complete.
- `PARTIAL`: uploaded objects can become orphaned when the later Xano operation fails.

## AI-Assisted Seller Listing

```mermaid
flowchart TD
  IMG["Upload photos"] --> AP["Analyze photos"]
  AP --> DF["Create/update draft"]
  DF --> GD["Generate description"]
  GD --> QS["Quality score"]
  QS --> SM["Submit moderation"]
  AP -. charge 1 .-> CR["Single ai_credits wallet"]
  GD -. no charge .-> CR
  QS -. no charge .-> CR
```

| Step | Endpoint | Status | Evidence |
| --- | --- | --- | --- |
| Analyze photos | POST `/ai/listing/analyze-photos` 3979609 | WORKING | charges one credit |
| Create draft | POST `/listings/create-draft` 3982637 | WORKING | authenticated |
| Load/update draft | GET/PATCH `/dashboard/drafts/{id}` 3974028/3974029 | WORKING | owner scoped |
| Generate description | POST `/ai/listing/generate-description` 3981498 | PARTIAL | no consistent credit charge; local fallback |
| Quality score | POST `/ai/listing/quality-score` 3981478 | PARTIAL | no consistent credit charge; local fallback |
| Submit moderation | POST `/listings/submit-moderation` 3982675 | WORKING | authenticated |
| Publish draft | POST `/dashboard/drafts/{id}/publish` 3974031 | WORKING | alternate path |

The flow is implemented in `src/pages/dashboard/new.astro:2527-3140`. The main product risk is contractual, not missing UI: users cannot predict which AI action consumes a credit.

## Seller Management

```mermaid
flowchart LR
  DL["Dashboard listings"] --> E["Edit"]
  E --> R["Submit review"]
  DL --> SD["Soft delete"]
  DL --> PR["Promote"]
  PR --> TX["Lock wallet + listing transaction"]
  TX --> LED["Credit ledger"]
  TX --> EXP["Promotion expiry"]
```

- GET `/dashboard/listings` 3968100: `WORKING`.
- GET/PATCH `/dashboard/listings/{id}` 3995774/3969714: `WORKING`.
- PATCH `/dashboard/listings/{id}/delete` 3983598: `WORKING`.
- POST `/dashboard/listings/{id}/promote` 3995775: `WORKING`, transactional/idempotent.
- GET `/dashboard/summary` 3995777 and credit history 3995776: `WORKING`.
- Promotion UI: `src/pages/dashboard/cars/promote.astro:65-266`.

## Moderation

```mermaid
flowchart TD
  Q["Moderation queue"] --> M["Open listing"]
  M --> AI["AI check"]
  M --> A["Approve"]
  M --> R["Reject"]
  M --> B["Block"]
  M --> D["Delete / sold"]
  M --> O["Assign owner"]
  M --> IM["Image management"]
  IM --> MISS["Missing API"]
```

Core endpoints are backend-authorized and `WORKING`: GET `/admin/moderation` 3966702 plus approve/reject/block/delete/sold/assign-owner. AI moderation POST `/ai/moderation/check-listing` 3981578 is `PARTIAL` because UI can fall back locally.

Image add/delete/primary and archive/restore commands in `src/pages/admin/moderation.astro:890-973` are `MISSING`. The current UI must not imply they succeeded.

## Credits and Promotion

```mermaid
flowchart TD
  G["Registration"] --> W["One ai_credits balance: +10"]
  W --> PA["Photo AI: -1"]
  W --> LG["Legacy AI generation: -1"]
  W --> P5["Promotion: -5/-12/-20"]
  W --> NC["Other AI actions: no charge"]
  DAY["Documented daily +5, cap 50"] -. not implemented .-> W
  PAY["Paid/provider wallets"] -. not represented .-> W
```

The promotion transaction is `WORKING`; the wallet policy is `BROKEN`. The single Xano balance is used by both AI and promotion. `/me/credits` 3974027 can also mutate admin role and grant a hardcoded huge balance, which must be removed.

## Paid Purchase Journey

```mermaid
flowchart LR
  PRI["Pricing"] --> BILL["Billing / dealer page"]
  BILL --> CO["Checkout"]
  CO --> WH["Verified webhook"]
  WH --> ORD["Order + fulfilment"]
  CO:::missing
  WH:::missing
  ORD:::missing
  classDef missing fill:#632525,color:#fff,stroke:#c44;
```

Only pricing and balance/history UI exist. `/purchases/create`, `/purchases/apply`, `/me/purchases`, provider checkout, webhooks, refunds, reconciliation, dealer profiles, and subscription entitlements are `MISSING` or `UI_ONLY`.

## Deal Finder

```mermaid
flowchart TD
  CRON["Cloudflare cron"] --> WK["Deal Finder Worker"]
  WK --> SRC["External source"]
  SRC --> ING["Ingest/touch Xano"]
  ING --> Q["Pending analysis queue"]
  WK --> CL["Claim"]
  CL --> AI["AI analysis"]
  AI --> CP["Complete/fail"]
  CP --> FEED["Authenticated feed"]
  FEED --> ACT["View/save/hide/restore"]
  FEED --> MAN["Manual analyze queue"]
  FEED --> LOCAL["Local compare/notification preview"]
```

### Working server flow

- Worker health, secret-protected sync/analysis, cron dispatch: `workers/deal-finder-sync/src/index.ts:97-152`.
- Internal Xano endpoints: active searches, existing IDs, ingest, touch-seen, pending, claim, complete, fail, and preflight.
- Frontend Xano endpoints: stats, list, detail, view/save/unsave/hide/restore, analyze, and search GET.

### Missing server flow

- Search create/update/delete.
- Description translation.
- Shared workspace and server-side comparisons.
- Notification preferences, delivery records, channels, and retries.
- Inbox/email retrieval (client currently returns `[]`).
- Sync log/report endpoint.

### Scale risk

Xano list and stats scripts fetch the latest analysis inside listing loops. Replace N+1/2N+1 lookups with joined/precomputed current-analysis fields or a batch query before increasing inventory limits.

## SEO Publishing

```mermaid
flowchart LR
  L["BaseLayout"] --> META["Canonical + OG + Twitter"]
  L --> JSON["JSON-LD"]
  CARS["Approved Xano cars"] --> SM["Dynamic sitemap"]
  ROB["robots.txt"] --> PUB["Public pages allowed"]
  ROB --> PRIV["Dashboard/admin/auth disallowed"]
```

Core SEO is `WORKING`. Fix pricing offer accuracy, stable sitemap timestamps, and add `impressum` to the explicit static sitemap routes.

## Operational Workflow

```mermaid
flowchart LR
  PUSH["Push main"] --> CI["check + test + build"]
  CI --> PG["Deploy Pages"]
  PG --> PROD["automarket.sitecraft.agency"]
  XCH["Manual Xano changes"] --> PROD
  WCH["Separate Worker deploy"] --> PROD
```

The Pages lane is `WORKING`. Xano and Worker changes are separately released, so compatibility and rollback are `PARTIAL`. Add a release record containing frontend SHA, Xano workspace/version, Worker version, migrations, environment checksum, smoke results, and rollback owner.
