# Programmatic SEO Stage 2: bounded Xano reads

Status: **contract implemented in the Astro client; Xano release pending**.

The production locale taxonomy pages currently use the compatibility catalog
because `PUBLIC_SEO_TAXONOMY_API_ENABLED` defaults to `false`. Do not enable the
flag until the additive schema, materializer and three public endpoints below
have been released and canary-tested in Xano.

## Why this stage exists

`GET /public/locale/cars` returns every ready listing. That is safe for the
current small inventory, but it makes each taxonomy SSR response O(N) in Xano
payload size, translation work and Astro memory. At 10,000–100,000 listings it
is not a viable taxonomy-page data source.

The bounded contract makes a taxonomy request O(page size + related links):

- at most 24 localized cards;
- one canonical facet and its total;
- at most 8 related facets per related group;
- ready locale codes for reciprocal hreflang;
- no arbitrary filter combinations.

## Additive API

1. `GET /public/locale/taxonomy/{type}/{slug}`
   - inputs: `lang`, `page`, `limit`, optional `parent_slug` for a model;
   - returns the requested page, aggregate total, canonical identity, ready
     locales and already-bounded related groups;
   - `limit` must be 1–24.
2. `GET /public/locale/taxonomies/counts?lang={locale}`
   - returns canonical facet counts and last modification timestamps;
   - intended for sitemap generation and catalogue navigation;
   - never returns listing rows.
3. `GET /public/locale/taxonomy/{type}/{slug}/related`
   - returns at most 8 real, indexable related facets per group;
   - can be used independently by future consumers; the page endpoint embeds
     the same bounded result so Astro needs only one Xano request.

The exact JSON contract is in `public-contract.json`.

## Materialized data model

`01_additive_schema.xs` defines four new tables without changing legacy
`car_listings` or translation fields:

- `seo_taxonomy_facets` — stable canonical entities;
- `seo_taxonomy_listing_edges` — ready locale/listing/facet relationships;
- `seo_taxonomy_locale_stats` — counts, readiness and lastmod;
- `seo_taxonomy_related` — precomputed overlap rankings.

The materializer must run after listing approval/unpublish, canonical taxonomy
changes and translation readiness changes. Writes must be idempotent and use a
generation token: build a complete new generation, validate it, then make that
generation active. This prevents half-refreshed counts from entering sitemap or
canonical decisions.

## Frontend rollout flags

```env
PUBLIC_SEO_TAXONOMY_API_ENABLED=false
PUBLIC_SEO_TAXONOMY_COMPATIBILITY_FALLBACK_ENABLED=false
```

- API disabled: existing full-catalog behavior, unchanged production output.
- API enabled, fallback disabled: bounded endpoint is authoritative and fails
  closed with 503 on invalid/unavailable contracts.
- API enabled, fallback enabled: temporary canary mode; a missing/erroring
  endpoint may use the full catalogue. Never leave this enabled at large scale.

Every successful route emits `X-SiteCraft-Taxonomy-Source` with either
`xano_bounded` or `compatibility_catalog` for smoke-test observability.

## Required release order

1. Apply additive tables and indexes after checking live schema names.
2. Deploy an idempotent materializer and run it in dry-run mode.
3. Materialize one locale generation and compare every facet/count to the
   existing Astro graph.
4. Release the three GET endpoints with new numeric IDs; record them in
   `docs/xano/CURRENT_ENDPOINT_MANIFEST_RU.md`.
5. Canary with both flags `true`; verify payload bounds, canonical, robots,
   breadcrumbs, pagination, related links and locale readiness.
6. Set compatibility fallback to `false` while keeping the bounded API on.
7. Only then enable production traffic for all public locales.

## Cache contract

The browser URL, Xano request and cache key include locale, type, canonical
slug, parent slug and page. Public indexable pages retain the existing
Cloudflare catalogue profile (120 seconds plus 600 seconds stale-while-
revalidate). Noindex/filter pages remain `no-store`. Materializer completion
should purge the affected locale/facet URLs or allow the short TTL to expire;
never cache a partial generation.

## Not included in this release

- live Xano mutation or production flag activation;
- unbounded listing sitemap replacement (it needs a paged listing-index
  contract before inventories approach sitemap limits);
- arbitrary filter-combination landings;
- removal of the compatibility reader.
