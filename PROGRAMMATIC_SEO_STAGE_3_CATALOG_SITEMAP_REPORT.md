# Programmatic SEO Stage 3 — catalogue pagination and sitemap scaling

Date: 20 August 2026
Repository: SiteCraft Auto Market
Production origin: `https://automarket.sitecraft.agency`
Status: frontend/contracts complete; Xano endpoints released and direct canary
passed; production flags intentionally disabled pending Stage 2 counts release

## 1. State before Stage 3

Stage 1 created the programmatic SEO taxonomy hierarchy and Stage 2 introduced
bounded taxonomy-page/count contracts. Two large-inventory bottlenecks remained:

1. `/{locale}/cars/` read the complete localized catalogue before rendering;
2. `/sitemaps/{locale}.xml` read the complete localized catalogue and combined
   static, taxonomy and listing URLs into one response.

This was acceptable for the current small inventory, but payload size, Astro
memory and Xano translation work would grow linearly at 10,000–100,000+
listings. It also left no stable sitemap shard generation boundary.

## 2. Requirements and architecture decisions

The implementation follows the current official guidance:

- Google sitemap files are limited to 50,000 URLs or 50 MB uncompressed, and
  large sets must be split through a sitemap index:
  `https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps`;
- paginated pages use sequential crawlable `<a href>` links and self-canonical
  URLs rather than canonicalizing page 2+ to page 1:
  `https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading`;
- Astro SSR dynamic routes/endpoints support the immutable generation/page
  shard path without `getStaticPaths`:
  `https://docs.astro.build/en/guides/routing/` and
  `https://docs.astro.build/en/guides/endpoints/`.

There is one root sitemap index. It directly references locale page sitemaps
and immutable listing shards; there are no nested sitemap indexes.

## 3. Implemented frontend architecture

### Bounded localized catalogue

New central modules:

- `src/lib/seo/catalogApi.ts` — strict response normalization, pagination,
  canonical, robots, hreflang and related-link decisions;
- `src/lib/seo/catalogRoute.ts` — feature-gated Xano loader plus explicit
  compatibility path.

`src/pages/[locale]/cars/index.astro` now:

- renders at most 24 SSR vehicle cards;
- uses `/{locale}/cars/` for page 1 and
  `/{locale}/cars/?page=N` for page 2+;
- redirects explicit `?page=1` to the clean page-one URL;
- exposes ordinary previous/next `<a href>` navigation;
- self-canonicalizes each unfiltered pagination page;
- marks arbitrary filter/query combinations `noindex,follow` and canonicalizes
  them to the corresponding unfiltered catalogue page;
- uses page-offset positions in the server-rendered `ItemList`;
- embeds bounded, real related taxonomy groups;
- exposes `X-SiteCraft-Catalog-Source` and one-query diagnostics.

The compatibility path now slices the existing full result into the same
24-card pagination contract. It preserves current production behavior while
the new Xano endpoint is unreleased, but remains intentionally temporary.

### Sitemap shards

New central modules:

- `src/lib/seo/sitemapApi.ts` — manifest/shard validation and limits;
- `src/lib/seo/sitemapRoute.ts` — feature-gated Xano loaders;
- `src/lib/seo/sitemapXml.ts` — shared escaped XML rendering.

New public route:

- `/sitemaps/{locale}/listings/{generation}/{page}.xml`

The sharded architecture is:

```text
/sitemap.xml
├── /sitemaps/de.xml                         static + taxonomy URLs
├── /sitemaps/de/listings/generation/1.xml   listing slug URLs
├── /sitemaps/de/listings/generation/2.xml
├── /sitemaps/en.xml
└── /sitemaps/en/listings/generation/1.xml
```

In authoritative sharded mode:

- `/sitemap.xml` performs one bounded manifest request;
- `/sitemaps/{locale}.xml` performs the bounded Stage 2 taxonomy-count read and
  does not load listing rows;
- each listing shard performs one slug-only read with exactly 10,000 maximum
  items;
- the root manifest is rejected if locale coverage, shard math, generation,
  timestamps or uniqueness are inconsistent;
- the root manifest is also rejected if the resulting sitemap index would
  exceed Google's 50,000 child-sitemap limit;
- invalid/unavailable authoritative data fails closed with 503 and cannot
  silently enter sitemap;
- unpublished/invalid locales, invalid generations and invalid shard pages
  return 404/no-store;
- listing shard output contains only canonical localized listing URLs and
  optional real `lastmod` values.

## 4. Additive Xano/API design

Released in Xano production branch `v1` on 20 August 2026:

- `4020327` — `GET /public/locale/catalog?lang=&page=&limit=24`;
- `4020329` — `GET /public/seo/sitemap/manifest`;
- `4020328` — `GET /public/locale/sitemap/listings?lang=&generation=&page=&limit=10000`.

The additive schema in `docs/xano/programmatic-seo-stage-3/` defines:

- `seo_listing_locale_index` — immutable generation/locale/listing/slug rows
  with deterministic catalogue order and lastmod;
- `seo_sitemap_locale_generations` — active locale totals, shard size and
  generation metadata.

No legacy Xano field is removed or renamed. The materializer is documented as
dry-run-first, batched, idempotent and atomically activated only after complete
generation invariants pass. Public reads perform no runtime AI.

The additive tables are `880518` (`seo_listing_locale_index`) and `880519`
(`seo_sitemap_locale_generations`). Generation `g20260820canary1` was built
inactive, verified, and activated manifest-last. It contains 281 exact
locale/listing readiness rows and 28 locale manifest rows. One current public
listing is source-ready in only one locale, so the correct per-locale totals
are 10–11 rather than an unsafe forced 11×28 matrix.

## 5. Rollout and compatibility flags

All new flags default to `false`:

```env
PUBLIC_SEO_CATALOG_API_ENABLED=false
PUBLIC_SEO_CATALOG_COMPATIBILITY_FALLBACK_ENABLED=false
PUBLIC_SEO_SITEMAP_SHARDS_ENABLED=false
PUBLIC_SEO_SITEMAP_COMPATIBILITY_FALLBACK_ENABLED=false
```

Therefore the current production deployment does not call the new Stage 3
endpoints yet. API/shard activation and fallback activation are independent so
catalogue and sitemap can be canaried separately.

## 6. Canonical, robots, hreflang and crawl behavior

- Page 1 has one clean canonical URL.
- Page 2+ has a unique self canonical and unique title/description suffix.
- Pagination is present in initial HTML and does not depend on JavaScript.
- Tracking parameters do not create a new SEO entity.
- Arbitrary filters remain outside sitemap and receive `noindex,follow`.
- Bounded API hreflang only includes locales reported ready by the contract.
- `x-default` remains on clean page 1; it is not emitted for pagination/filter
  variants.
- Shard listing paths are canonical absolute URLs on the configured production
  origin and contain no queries.

## 7. Performance implications

After Xano activation, per-request complexity becomes bounded:

| Route | Xano reads | Maximum listing/card rows |
| --- | ---: | ---: |
| Catalogue page | 1 | 24 cards |
| Taxonomy page (Stage 2) | 1 | 24 cards |
| Locale page sitemap | bounded count pages | 0 listing rows |
| Listing sitemap shard | 1 | 10,000 slug/lastmod pairs |
| Root sitemap index | 1 | manifest only |

The slug-only shard avoids images, descriptions, seller/private data and
translation bodies. Immutable generation URLs are cache-safe. Filter variants
remain no-store.

## 8. Files added or materially changed in Stage 3

Added:

- `src/lib/seo/catalogApi.ts`
- `src/lib/seo/catalogRoute.ts`
- `src/lib/seo/sitemapApi.ts`
- `src/lib/seo/sitemapRoute.ts`
- `src/lib/seo/sitemapXml.ts`
- `src/pages/sitemaps/[locale]/listings/[generation]/[page].xml.ts`
- `tests/programmatic-seo-stage3-scaling.test.ts`
- `docs/xano/programmatic-seo-stage-3/*`

Changed:

- `src/pages/[locale]/cars/index.astro`
- `src/pages/sitemap.xml.ts`
- `src/pages/sitemaps/[locale].xml.ts`
- `src/lib/xano.ts`
- `src/lib/apiRoutes.ts`
- `src/lib/config.ts`
- `src/lib/seo/taxonomyApi.ts`
- `src/lib/seo/taxonomyRoute.ts`
- `.env.example`, `src/env.d.ts`, `README.md`
- `scripts/http-public-seo-integration.mjs`
- affected static/SEO tests and the Xano endpoint registry.

Stage 2 files are also still present in the same uncommitted worktree; this
Stage 3 implementation deliberately builds on that bounded taxonomy layer.

## 9. Automated verification

### `npm run check`

- Result: PASS
- Astro files checked: 325
- Errors: 0
- Warnings: 0
- Existing informational hints: 20

### `npm test`

- Result: PASS
- Tests: 506
- Passed: 506
- Failed: 0

Stage 3 tests cover exact 24-card pages, page-one redirects, filter noindex,
canonical pagination, compatibility slicing, locale readiness, invalid bounds,
manifest locale parity, exact shard math, duplicate slugs, generation mismatch,
50,000-index limit, XML escaping, privacy and default-off rollout flags.

### `npm run build`

- Result: PASS
- Astro SSR server build completed.
- Cloudflare Worker compiled successfully.
- Advanced Mode bundle prepared in `dist/client/_worker.js`.
- 55 built asset references verified across 97 SSR Worker files.
- Vite retains an existing large-chunk warning; no new build failure.

### Production read-only smoke

Command: `npm run test:http:production -- --locale de`

- Result: PASS
- `/sitemap.xml`, `/sitemaps/de.xml`, German home/catalog, vehicle detail,
  static SEO pages and every current German taxonomy/listing sitemap URL passed;
- canonical, indexability, hreflang, structured data and legacy inventory were
  verified without authentication;
- current production reports compatibility sitemap mode, as expected, because
  Stage 3 frontend flags remain disabled;
- `listingSitemapShardChecked=false` is expected until the shard flag is
  enabled after Xano canary.

## 10. Remaining risks and next actions

1. Stage 2 `/public/locale/taxonomies/counts` is still unreleased. The Stage 3
   sharded sitemap flag must remain disabled until that dependency passes its
   own canary.
2. Until frontend activation, catalogue and locale sitemap compatibility paths still
   load the small full catalogue and are not the 100,000-listing solution.
3. Direct Xano canary passed for the complete 28-locale manifest, representative
   `de`, `ru`, `ar` bounded catalogues/shards, exact slug parity, strict frontend
   normalizers, privacy and negative 404 cases. Astro-through-production canary
   is still required before enabling flags.
4. Old immutable sitemap generations need a documented retention window; do
   not delete them immediately after activation.
5. Google Search Console sitemap submission/index coverage and Xano/Cloudflare
   latency/error dashboards remain operational work, not local code work.
6. If the global child-sitemap count ever approaches 50,000, the system fails
   closed by design; introduce multiple separately submitted root indexes
   before raising that scale.

## 11. Publication state

The Xano schema/endpoints and active canary generation were released additively
on 20 August 2026. No production feature flag was enabled. The combined Stage
2–3 frontend can now be published safely because every new flag defaults to
`false`; authoritative sitemap activation remains blocked on the unreleased
Stage 2 taxonomy-count endpoint.
