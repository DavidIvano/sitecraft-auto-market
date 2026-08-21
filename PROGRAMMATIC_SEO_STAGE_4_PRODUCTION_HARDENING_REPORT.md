# Programmatic SEO — Stage 4 production hardening report

Date: 21 August 2026  
Production domain: `https://automarket.sitecraft.agency`  
Result: **PASS — bounded/sharded Xano reads are authoritative; all compatibility fallbacks are disabled**

## 1. Starting state

Stages 2–3 had already released the additive taxonomy, bounded catalogue and
listing-shard APIs. Cloudflare production was using those APIs, but the three
explicit compatibility fallbacks were still enabled for the observation
window. The existing parity audit also still treated locale sitemaps as if
they contained listing URLs directly, although Stage 3 had moved listing URLs
to immutable shards.

## 2. Freshness audit before cutover

The active Xano generation was recalculated read-only from the current public
listings, translation readiness and public locale registry before fallback
removal.

- public listings: 11;
- public locales: 28;
- calculated ready locale/listing rows: 281;
- active `seo_listing_locale_index` rows: 281;
- active generation: `g20260820canary1`;
- manifest rows: 28;
- listing count range per locale: 10–11;
- missing, extra or changed readiness rows: 0;
- locale total differences: 0.

No Xano data was changed during this audit. The active generation exactly
matched the live source state at cutover time.

## 3. Audit and CI corrections

`scripts/verify-seo-parity.mjs` now discovers listing shards from the root
sitemap, loads the complete bounded catalogue page-by-page and compares:

`strict localized inventory ↔ bounded catalogue ↔ listing shards`.

The legacy locale catalogue remains informational because it may intentionally
contain a source-language fallback listing that is not eligible for localized
indexing. Canonical taxonomy-link checks now validate the actual SSR hrefs,
and Cyrillic taxonomy labels are accepted for `ru`, `uk` and `bg`.

The production HTTP gate gained `--require-authoritative`. It fails unless the
observed sources are exactly:

- root sitemap: `xano_sharded`;
- locale sitemap: `xano_pages_only`;
- listing shard: `xano_slug_shard`;
- localized catalogue: `xano_bounded`;
- every sitemap taxonomy route: `xano_bounded`.

The gate is paced at one request per 2.1 seconds to respect the current Xano
limit of 10 requests per 20 seconds.

## 4. Transient fallback cache protection

The first strict production gate correctly found that its earlier request rate
could trigger `compatibility_catalog`. It also exposed a separate cache risk:
an indexable compatibility response could be stored by Cloudflare like a
normal bounded response.

This is now prevented centrally with `setPublicNoStoreHeaders()`:

- bounded/indexable responses keep their existing edge-cache profile;
- filters and other noindex responses remain `no-store`;
- catalogue, taxonomy and sitemap compatibility responses are always
  `no-store`, while retaining the correct robots directive;
- unavailable authoritative reads fail closed and remain `503/noindex`.

## 5. Production cutover

Functional commits:

- `d842b2c42de5a9675b55de0445b3deee8042f55c` — authoritative parity and CI gate;
- `f394055e60094ba0c6f298b76b6e7d98feb70ed1` — rate-aware smoke and transient fallback cache protection.

Release sequence:

1. fallback-on authoritative canary passed in GitHub Actions run
   [`32530014796`](https://github.com/DavidIvano/sitecraft-auto-market/actions/runs/32530014796);
2. the three compatibility variables were changed to `false` while all three
   bounded/sharded API variables remained `true`;
3. fallback-off deploy and complete production smoke passed in run
   [`32530234808`](https://github.com/DavidIvano/sitecraft-auto-market/actions/runs/32530234808).

Current production variable state:

- `PUBLIC_SEO_TAXONOMY_API_ENABLED=true`;
- `PUBLIC_SEO_CATALOG_API_ENABLED=true`;
- `PUBLIC_SEO_SITEMAP_SHARDS_ENABLED=true`;
- all three `*_COMPATIBILITY_FALLBACK_ENABLED=false`.

## 6. Production evidence

The final German authoritative audit reported:

- strict localized inventory: 10;
- bounded catalogue: 10;
- listing shard: 10;
- missing/unexpected slugs in either direction: 0;
- inspected page violations: 0;
- authoritative source violations: 0;
- one intentionally legacy-only non-indexable listing:
  `mazda-5-2006-102`.

Representative pre-cutover parity also passed for `ru` (11/11/11), `ar`
(10/10/10) and `fr` (10/10/10). The deployed HTML exposes build SHA
`f394055e60094ba0c6f298b76b6e7d98feb70ed1`.

## 7. Verification

- `npm run check`: PASS, 0 errors (20 existing hints);
- `npm test`: PASS, 508/508;
- `npm run build`: PASS;
- Cloudflare Advanced Mode Worker: compiled;
- built asset verification: 55 references across 97 SSR Worker files;
- production authoritative smoke: PASS with fallbacks disabled.

The existing Vite warning for a client chunk above 500 kB remains unrelated
to this server-side SEO cutover.

## 8. Performance and scale

Taxonomy and catalogue SSR remain bounded to 24 cards per request. Listing
sitemaps are immutable slug/lastmod shards, and locale sitemaps contain only
static/taxonomy pages. No related-link block performs its own Xano query.

The production smoke is intentionally paced; this protects the current Xano
tier but is not a substitute for capacity planning. Rate-limit monitoring and
a higher-capacity tier are recommended before substantial crawler/traffic
growth.

## 9. Remaining risk and next SEO stage

The materialized readiness and taxonomy generations are correct now, but the
repository does not yet contain an automatic production writer for them. A new
approval, unpublish, canonical taxonomy change or translation readiness change
therefore requires a safe regeneration procedure.

The next SEO stage should add an authenticated, idempotent materializer with:

1. event-driven refresh after listing/translation state changes;
2. a scheduled reconciliation as a safety net;
3. inactive-generation build and validation before atomic activation;
4. freshness metrics and alerts comparing live sources to active generations;
5. targeted Cloudflare cache purge only after successful activation.

Until that automation exists, generation refresh remains an operational step;
the application correctly fails closed rather than silently restoring the
unbounded compatibility path.
