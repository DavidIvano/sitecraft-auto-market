# Xano Programmatic SEO Stage 2 release and canary — 20 August 2026

## Scope and safety

This was an additive release in production workspace `115940`, branch `v1`,
API group `421515`. A fresh metadata/records backup was saved outside the
repository before mutation. Exact dry-runs were reviewed before table, record
or endpoint pushes. No legacy listing, translation, locale, endpoint or field
was deleted or rewritten.

## Released tables

| ID | Table | Active rows |
| ---: | --- | ---: |
| 880531 | `seo_taxonomy_facets` | 31 |
| 880532 | `seo_taxonomy_listing_edges` | 2,333 |
| 880533 | `seo_taxonomy_locale_stats` | 841 |
| 880534 | `seo_taxonomy_related` | 8,192 |

Active generation: `t20260820canary1`. It covers 28 public locales and 281
ready locale/listing rows from the previously released Stage 3 readiness
index. Data was imported with `is_active=false`, verified for exact counts,
uniqueness, referential integrity and stat/edge parity, then activated in one
transaction.

## Released read-only API

| ID | Method | Path |
| ---: | --- | --- |
| 4020380 | GET | `/public/locale/taxonomies/counts` |
| 4020381 | GET | `/public/locale/taxonomy/{type}/{slug}/related` |
| 4020382 | GET | `/public/locale/taxonomy/{type}/{slug}` |

The page and related endpoints accept an omitted `parent_slug` for non-model
facets; model requests require their canonical brand parent. Invalid taxonomy
types, slugs, locale, page numbers and missing model parents fail with `404`.

## Direct canary

The live payloads were passed through the same strict TypeScript normalizers
used by Astro.

- German counts: 30 non-empty facets, 24 indexable.
- Indexable pages passed for brand, model, city, region, fuel, body and price.
- Pagination totals matched facet totals and returned no more than 24 cards.
- Embedded related groups exactly matched the standalone related endpoint and
  never exceeded 8 links per group.
- A positive-count facet below its threshold resolved to `noindex`.
- Russian and Arabic localized responses passed readiness and indexability.
- No seller email, phone, seller name, user ID or VIN field was exposed.
- Unknown type/slug/locale, out-of-range page and model without parent returned
  `404`, preventing soft 404s.

Result: **PASS**.

## Operational constraint

The current Xano plan enforces 10 requests per 20 seconds. Canary tooling used
paced requests and `429` backoff. Cloudflare caching and bounded single-request
taxonomy SSR are therefore required; future high traffic should include Xano
capacity planning and rate-limit monitoring.

## Rollout state

The Xano data and endpoints are active, but Astro rollout flags remain off at
the time of this report. The next safe step is a Cloudflare deployment with API
and compatibility fallback flags enabled, production smoke verification, then
a separate switch to authoritative mode without fallbacks.
