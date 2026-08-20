# Programmatic SEO Stage 2: bounded Xano reads

Status: **released in Xano production and direct canary passed on 20 August 2026**.

The additive schema, materialized generation and all three public endpoints are
live and have passed the repository's strict frontend normalizers. Cloudflare
production canary is active: bounded taxonomy, catalogue and sitemap paths are
enabled, with their explicit compatibility fallbacks temporarily retained for
the observation window. Repository/.env defaults remain fail-safe `false`.

## Production release

- Active generation: `t20260820canary1`.
- Tables: `880531` facets, `880532` listing edges, `880533` locale stats,
  `880534` related overlaps.
- Endpoints: `4020380` counts, `4020381` related, `4020382` taxonomy page.
- Active records: 31 facets, 2,333 edges, 841 locale stats and 8,192 related
  rows across 28 public locales.
- Direct canary: all seven taxonomy types passed; German counts were 30 total /
  24 indexable; thin positive-count facets remained `noindex`; invalid locale,
  slug, type, page and model parent returned `404`.

See `XANO_RELEASE_CANARY_2026-08-20.md` for the full release evidence.

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

## Release and rollout order

1. **Complete:** additive tables and indexes applied after live-schema audit.
2. **Complete:** idempotent materialization planned, imported inactive and
   verified before activation.
3. **Complete:** 28-locale generation compared to the existing Astro graph.
4. **Complete:** three GET endpoints released with numeric IDs recorded in the
   production manifest.
5. **Complete:** canary Astro with both flags `true`; payload bounds, canonical, robots,
   breadcrumbs, pagination, related links and locale readiness.
6. After the observation window, set compatibility fallback to `false` while
   keeping the bounded API on.
7. Only then enable production traffic for all public locales.

## Cache contract

The browser URL, Xano request and cache key include locale, type, canonical
slug, parent slug and page. Public indexable pages retain the existing
Cloudflare catalogue profile (120 seconds plus 600 seconds stale-while-
revalidate). Noindex/filter pages remain `no-store`. Materializer completion
should purge the affected locale/facet URLs or allow the short TTL to expire;
never cache a partial generation.

## Not included in the Xano release

- Cloudflare/Astro production flag activation;
- arbitrary mutation of legacy Xano listing or translation data;
- arbitrary filter-combination landings;
- removal of the compatibility reader.
