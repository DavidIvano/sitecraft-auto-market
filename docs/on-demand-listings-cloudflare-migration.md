# On-demand listings migration for Cloudflare Pages

## Summary

Public car detail pages and the sitemap are now rendered on request from current Xano data. An approved listing no longer has to exist during an Astro build: after Xano returns it from the public endpoint, `/cars/{slug}` can render it immediately without a code commit or another Cloudflare deployment.

The canonical production origin remains `https://automarket.sitecraft.agency`. The existing Cloudflare Pages project remains `sitecraft-auto-market`; `sitecraft-auto-market.pages.dev` stays attached as the secondary Pages domain.

## Previous architecture and root cause

`src/pages/cars/[slug].astro` used `getStaticPaths()`. A build fetched the complete public catalog, then generated one HTML file for every slug known at build time. Consequently:

- a newly approved Xano record had no route until the next build and deployment;
- the build performed many remote detail requests and artificial waits;
- one incomplete response could stop the entire deployment;
- `description.split(...)` failed when Xano omitted or returned `null` for `description`;
- the sitemap contained only the listing set present at build time.

The old Pages deployment workflow had a second independent failure. `CLOUDFLARE_API_TOKEN` was absent, `Deploy` was conditional, and a separate skip step completed successfully. GitHub run `29850751437` was therefore green while its `Deploy` step was `skipped`. Cloudflare continued to serve commit `e6b6f0d`.

The lightbox regression came from a three-column stage (`52px minmax(0, 1fr) 52px`). When navigation controls were hidden for a one-image listing, DOM placement could leave the viewport in a 52px implicit/edge column.

## Target architecture

- Astro 7 keeps ordinary marketing, dashboard and admin pages prerendered.
- `@astrojs/cloudflare` 14.1.4 builds the server entry for routes with `prerender = false`.
- `/cars/[slug]`, `/404` and `/service-unavailable` are on-demand Astro routes.
- `/sitemap.xml` is an on-demand endpoint.
- `/cars/[slug]` calls only `GET /cars/{encodeURIComponent(slug)}` for its main record.
- Existing Pages Functions for R2 uploads, R2 reads, drafts and promotion redirects remain active.
- `scripts/prepare-cloudflare-pages.mjs` packages Astro's server output and the existing Pages Functions into one Pages Advanced Mode `_worker.js` directory under `dist/client`.
- `public/_routes.json` invokes the worker only for dynamic car, sitemap, draft, promotion and API routes. Static assets bypass it.

Astro's current Cloudflare adapter primarily targets the Workers runtime. This project deliberately keeps the existing Pages project by packaging that standard Worker entry as a Pages Advanced Mode `_worker.js`. This compatibility layer is covered by local `wrangler pages dev` tests and should be rechecked when upgrading Astro, the adapter or Wrangler.

## Request behavior

### Public detail

1. Validate and safely decode the slug.
2. Reject empty, oversized, malformed, `undefined` and `null` slugs with HTTP 404.
3. Fetch the exact Xano record with an eight-second timeout.
4. Validate and normalize the external JSON at runtime.
5. Apply the shared `isPublicListing()` predicate again in Astro.
6. Return HTTP 404 for missing or non-public records without revealing that a private record exists.
7. Return HTTP 503 for timeout/network/5xx failure and HTTP 502 for other invalid upstream responses.
8. Render seller and related-listing enhancements on a best-effort basis; their failure cannot break the main record.

The detail and error responses use `Cache-Control: no-store`, so approval, blocking and deletion become visible immediately and negative 404 responses are not retained.

### Public status

The shared predicate permits `approved`, `published`, and the existing public `sold` state. It fails closed for `draft`, `ai_draft`, `pending_review`, `needs_fix`, `rejected`, `blocked`, `deleted`, `archived`, unknown values and conflicting lifecycle/moderation states. The Xano endpoint must keep the same public-only restriction; Astro is the second boundary, not a replacement for backend authorization.

### Xano normalization

`src/lib/publicCar.ts` accepts wrapper shapes and normalizes strings, finite numbers, nullable booleans, dates, AI scores, seller public summary and image relations. It supports `images`, `car_listing_images`, `image_urls`, main/cover fields and nested metadata. Only HTTPS or safe local image paths survive. Missing images use the local placeholder.

Description is nullable in the API contract. All SEO and visible-description processing starts with `String(value ?? "")` or an explicit type check, so `undefined.split()` cannot recur. Missing values do not render as `undefined`, `null`, `NaN`, `Invalid Date`, or a false AI `0%`.

## Privacy and security model

- Public rendering uses no browser auth token and no private Xano token.
- Full VIN is removed during normalization; only `maskVin()` output can render.
- Seller phone/email fields are cleared from the main listing payload. Only the existing public seller contact summary may expose an allowed `tel:` or `mailto:` action.
- Unknown/private slugs return the same 404.
- Admin notes, rejection notes, moderation diagnostics and unknown source keys are not copied into the normalized listing.
- Cloudflare, R2, Xano private and AI credentials remain server-side and are never committed or logged.
- Deploy credentials are GitHub Secrets; public origins are GitHub Variables.

## Sitemap

`src/pages/sitemap.xml.ts` is dynamic and `no-store`. Each request loads the current public listing set, applies the shared predicate, removes invalid/duplicate slugs and emits only canonical URLs under `https://automarket.sitecraft.agency`. No private listing payload is serialized.

## Lightbox

`src/styles/global.css` contains one source of truth for `.image-lightbox-*` layout. The stage has one full-width grid column, the viewport occupies row/column 1, and previous/next controls are absolutely positioned overlays. Hidden controls use `display: none !important`. The image box fills the viewport and the pixels are fitted with `object-fit: contain` and centered positioning; this avoids the unresolved percentage `max-height` behavior that clipped tall intrinsic images in a CSS Grid. Mobile uses `100dvh` and safe-area padding; scroll locking, Escape, arrow keys, focus restoration, reset and zoom/pan remain in the shared lightbox module.

## Build and deployment flow

1. Push to `main`.
2. GitHub Actions checks all four required settings without printing their values.
3. Run `npm ci`, `npm run check`, `npm test`, and `npm run build`.
4. Astro writes static assets to `dist/client` and server modules to `dist/server`.
5. The packaging script creates `dist/client/_worker.js` and compiles existing Pages Functions as a plugin.
6. Wrangler deploys `dist/client` to the existing `sitecraft-auto-market` project on branch `main`.
7. Both the pages.dev domain and `automarket.sitecraft.agency` receive the same production deployment.

The workflow now fails if any of these settings is absent:

- Secret `CLOUDFLARE_API_TOKEN`
- Secret `CLOUDFLARE_ACCOUNT_ID`
- Variable `PUBLIC_XANO_API_URL`
- Variable `PUBLIC_SITE_URL`

`PUBLIC_SITE_URL` must be `https://automarket.sitecraft.agency`. The verified Cloudflare account ID belongs to the account that owns the existing Pages project. Secret values are intentionally not documented.

## Verification

Local Pages runtime checks use the packaged `dist/client` with `wrangler pages dev`, not a static file server. Verified scenarios include:

- approved Renault detail: HTTP 200;
- unknown and malformed slugs: HTTP 404 with the dedicated page;
- unreachable Xano: HTTP 503 with `no-store` and `noindex`;
- dynamic sitemap: HTTP 200 and canonical listing URLs;
- promotion redirect: HTTP 302 through the preserved Pages Function;
- no full VIN or internal moderation fields in the rendered detail HTML;
- one-column/overlay lightbox CSS and shared keyboard/focus behavior.

The final production acceptance test must approve a newly created safe listing whose slug was absent from the deployment, then confirm detail HTTP 200 and sitemap inclusion without another build or deployment.

## Changed runtime files

- `astro.config.mjs`
- `package.json`, `package-lock.json`
- `src/pages/cars/[slug].astro`
- `src/pages/404.astro`
- `src/pages/service-unavailable.astro`
- `src/pages/sitemap.xml.ts`
- `src/lib/xano.ts`
- `src/lib/publicCar.ts`
- `src/lib/types.ts`
- `src/styles/global.css`
- `public/_routes.json`
- `scripts/prepare-cloudflare-pages.mjs`
- `.github/workflows/cloudflare-pages.yml`
- focused tests under `tests/`

The obsolete duplicate Pages Functions for `/cars/*` and `/sitemap.xml` were removed so Astro owns those routes.

## Rollback

1. In Cloudflare Pages, roll back to the previous known-good deployment if production health is affected.
2. Revert the migration commit on `main`; do not force-push or reset shared history.
3. Restore the prior workflow only together with a deliberate deployment plan. Do not restore the silent green skip.
4. If rolling back only the compatibility package, temporarily restore the former static car functions/routes and verify public/private status behavior before deployment.
5. Keep Xano schema and moderation data unchanged; this migration does not require a database rollback.

After rollback, newly approved listings may again require a build. That limitation should be stated explicitly until the on-demand route is redeployed.
