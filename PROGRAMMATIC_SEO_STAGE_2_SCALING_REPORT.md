# Programmatic SEO — Stage 2 scaling report

Date: 20 August 2026
Repository state: combined Stage 2–3 implementation plus Xano release validated
Production bounded Xano endpoints: released and direct canary passed; Astro
feature flags remain disabled pending the Cloudflare canary

## 1. State before this stage

Every localized taxonomy route called `getLocalizedApprovedCars(locale)` (or
the legacy locale reader), downloaded the complete public catalogue, built all
seven facet graphs in Astro and then sliced the requested 24 cards.

The current German production response has 10 listings and is about 17,055
UTF-8 bytes, so the compatibility path is acceptable today. Its payload,
translation work and in-memory graph are O(all listings), however. At
10,000–100,000 listings every taxonomy request would repeat work unrelated to
the requested facet/page.

## 2. Implemented frontend architecture

- Added one shared `loadLocalizedSeoTaxonomyPage()` entry point for brand,
  model, city, region, fuel, body and price routes.
- Added an additive Xano page client capped at 24 cards.
- Added a paged counts client capped at 500 facets per request for sitemap and
  navigation aggregates.
- Added strict response validation before canonical, robots, hreflang or
  sitemap decisions.
- Added support for aggregate facet counts independent of the currently loaded
  cards; the same centralized indexability thresholds remain authoritative.
- Added bounded related groups (maximum 8 links per type) and ready-locale
  handling.
- Added `X-SiteCraft-Taxonomy-Source` observability:
  `xano_bounded` or `compatibility_catalog`.
- Sitemap taxonomy entries can use the paged aggregate feed when the rollout
  flag is on; while it is off, existing sitemap output is unchanged.

The primary files are:

- `src/lib/seo/taxonomyApi.ts`
- `src/lib/seo/taxonomyRoute.ts`
- `src/lib/seo/taxonomyPage.ts`
- `src/lib/seo/taxonomies.ts`
- `src/lib/xano.ts`
- `src/lib/apiRoutes.ts`
- `src/pages/[locale]/cars/**`
- `src/pages/sitemaps/[locale].xml.ts`

## 3. Fail-closed contract checks

The bounded response is rejected when any of these invariants fails:

- page/limit/total/total-pages disagree;
- page size exceeds 24;
- normalized public card count differs from the expected page size;
- facet total differs from pagination total;
- taxonomy type, canonical slug or model parent is invalid/noncanonical;
- fixed price slug is not in the central allowlist;
- current locale is absent from ready locales;
- counts pagination exceeds 500 or contains invalid/duplicate facets.

An invalid authoritative contract becomes a 503 via the route’s existing
service-unavailable handling. It is never silently indexed. Missing/empty
facets remain 404, and thin positive-count facets remain `noindex, follow`.

## 4. Rollout flags and compatibility

Two variables were added and default to `false`:

```env
PUBLIC_SEO_TAXONOMY_API_ENABLED=false
PUBLIC_SEO_TAXONOMY_COMPATIBILITY_FALLBACK_ENABLED=false
```

This preserves production behavior until Xano is ready. The fallback is a
separate explicit canary switch; it is not automatically used on a bounded API
failure because a full-catalog emergency read would recreate the scaling
problem and could hide a broken canonical contract.

## 5. Additive Xano design

Released from and documented in `docs/xano/programmatic-seo-stage-2/`:

- JSON response contract;
- additive tables and indexes;
- page/counts/related endpoint drafts;
- generation-based materializer contract;
- release and cache procedure.

New materialized tables:

1. `seo_taxonomy_facets`
2. `seo_taxonomy_listing_edges`
3. `seo_taxonomy_locale_stats`
4. `seo_taxonomy_related`

No legacy production field was deleted or renamed. The complete inactive
generation was built and validated first; activation happened only after
counts, edges, canonical identities and readiness agreed. Active generation
`t20260820canary1` contains 31 canonical facets, 2,333 locale/listing edges,
841 locale stats and 8,192 bounded related rows. The production manifest
records endpoint IDs `4020380`, `4020381` and `4020382`.

## 6. Canonical, noindex and internal links

The bounded path uses the same central helpers as the compatibility graph:

- stable technical slugs;
- fixed price buckets;
- central thresholds;
- localized H1/title/description;
- self canonical and page canonical;
- canonical redirect for wrong case/legacy slug;
- `noindex, follow` for arbitrary query filters;
- reciprocal hreflang only from ready locales;
- server-rendered breadcrumbs, listing cards, pagination and related links.

No user filter combination is added to the bounded API, related table or
sitemap contract.

## 7. Performance implications

After Xano activation, a taxonomy page transfers at most:

- 24 localized public cards;
- one facet summary and pagination block;
- at most 48 related facet summaries (6 groups × 8 links).

Work becomes bounded by page size rather than catalogue size. Related overlap
and counts are materialized, so page GET does not run per-block or per-card
queries. Existing Cloudflare catalogue caching remains 120 seconds with 600
seconds stale-while-revalidate; noindex/filter responses remain `no-store`.

The localized listing sitemap still needs the complete listing index. Before
inventory approaches sitemap limits, it should move to a separate paged,
slug-only sitemap feed/shards. This is deliberately not hidden as part of the
taxonomy optimization.

## 8. Automated verification

- `npm run check`: passed, 0 errors (20 pre-existing hints).
- `npm test`: passed, 506/506.
- `npm run build`: passed in the six-flag canary configuration; Cloudflare
  Advanced Mode Worker compiled and 55 built asset references across 97 SSR
  Worker files were verified.
- Existing Vite warning remains: one or more chunks exceed 500 kB. It predates
  this server-only taxonomy data layer and should be handled as a separate
  client-bundle optimization task.

New tests cover:

- bounded page normalization and SSR resolution;
- count-only sitemap facet normalization;
- canonical/noindex/related/breadcrumb output;
- invalid/unbounded/inconsistent response rejection;
- explicit rollout flags and compatibility path;
- additive schema, limits, privacy boundary and released manifest state.

## 9. Local SSR smoke results

Compatibility mode against real production Xano data:

- `/de/cars/brand/mercedes-benz/` — 200, index, self canonical;
- `/de/cars/region/niedersachsen/` — 200, index, self canonical;
- `/de/cars/fuel/petrol/` — 200, index, self canonical;
- `/de/cars/body/hatchback/` — 200, index, self canonical;
- `/de/cars/price/under-10000/` — 200, index, self canonical;
- fuel page with `?transmission=automatic` — 200, `noindex, follow`, canonical
  to the clean taxonomy URL;
- `/sitemaps/de.xml` — 200, 41 URLs, one compatibility catalogue request.

Bounded mode against a local Xano contract fixture:

- region page — 200;
- `X-SiteCraft-Taxonomy-Source: xano_bounded`;
- one Xano request;
- self canonical, German H1, three SSR listing cards;
- SSR brand and fuel related links;
- filtered variant stays `noindex, follow` with clean canonical.

The dev server and mock server were stopped after verification.

## 10. Xano release result and remaining rollout

The additive Xano release is complete. A fresh backup was taken, exact dry-run
plans showed four table additions with no legacy updates/deletes, the full
generation was inserted inactive, validated, then activated. Direct canary
passed all seven types, German/Russian/Arabic locales, strict response bounds,
privacy checks, related parity, thin-facet `noindex` and negative `404` cases.

Remaining production rollout:

1. Pass all six Stage 2–3 flags through the Cloudflare build workflow.
2. Deploy with each API flag and its compatibility fallback enabled.
3. Verify production source headers, canonical/robots/SSR output and sitemap
   shard parity.
4. Disable compatibility fallbacks after a green observation window while
   keeping the bounded APIs authoritative.

No GitHub push, Cloudflare deployment, Xano mutation or production flag change
was performed in this stage without a separate release confirmation.
