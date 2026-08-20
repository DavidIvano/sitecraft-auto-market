# Programmatic SEO Stage 3: bounded catalogue and listing sitemap shards

Status: **Astro contracts implemented; three Xano GET endpoints released and
direct canary passed; production flags remain disabled**.

Released on 20 August 2026 in workspace `115940`, production branch `v1`, API
group `421515`:

- `4020327` — `GET /public/locale/catalog`;
- `4020328` — `GET /public/locale/sitemap/listings`;
- `4020329` — `GET /public/seo/sitemap/manifest`.

The additive tables are `880518` (`seo_listing_locale_index`) and `880519`
(`seo_sitemap_locale_generations`). Active generation
`g20260820canary1` contains 281 locale/listing rows and 28 locale manifests.
See `XANO_RELEASE_CANARY_2026-08-20.md` for the verified rollout record.

Stage 2 bounded individual taxonomy pages. Stage 3 removes the two remaining
full-catalog reads from the large-inventory path:

- `GET /public/locale/catalog` returns one localized page of at most 24 cards;
- `GET /public/seo/sitemap/manifest` returns one active immutable generation
  and listing/shard counts for every public, SEO-ready locale;
- `GET /public/locale/sitemap/listings` returns at most 10,000 slug/lastmod
  pairs and never returns card, seller or translation content.

The compatibility readers remain available while every flag is `false`. They
are not suitable for 10,000–100,000 listings.

## Public URL topology

The root `/sitemap.xml` remains the only sitemap index. It directly references:

- `/sitemaps/{locale}.xml` for static and indexable taxonomy landing pages;
- `/sitemaps/{locale}/listings/{generation}/{page}.xml` for immutable listing
  shards.

There are no nested sitemap indexes. One shard contains 10,000 URLs, below
Google's 50,000 URL/50 MB limits. The frontend validates that the complete root
index never exceeds 50,000 child sitemap entries.

Generation is part of the shard URL. Never change the content of an already
published generation. Build, verify and atomically activate a new generation;
old shard URLs may expire after search engines and edge caches have refreshed.

## Frontend rollout flags

```env
PUBLIC_SEO_CATALOG_API_ENABLED=false
PUBLIC_SEO_CATALOG_COMPATIBILITY_FALLBACK_ENABLED=false
PUBLIC_SEO_SITEMAP_SHARDS_ENABLED=false
PUBLIC_SEO_SITEMAP_COMPATIBILITY_FALLBACK_ENABLED=false
```

- API/shards disabled: current production-compatible full-catalog reads.
- API/shards enabled, fallback enabled: short canary only.
- API/shards enabled, fallback disabled: bounded contracts are authoritative;
  invalid/missing data fails closed with 503 and cannot enter canonical/sitemap.

Successful responses expose safe diagnostics:

- `X-SiteCraft-Catalog-Source: xano_bounded|compatibility_catalog`;
- `X-SiteCraft-Sitemap-Source: xano_sharded|xano_pages_only|xano_slug_shard|compatibility_combined`;
- `X-SiteCraft-Query-Count` and immutable sitemap generation where applicable.

## Release state and remaining order

1. Completed: live schema comparison, additive tables, readiness materializer,
   inactive verification and manifest-last activation.
2. Completed: all three read-only GET endpoints released, IDs recorded and
   direct contract canary passed for `de`, `ru` and `ar` plus all 28 manifest
   locales and negative `404` cases.
3. Next: release and canary the Stage 2 taxonomy endpoints, especially
   `/public/locale/taxonomies/counts`; sharded locale sitemaps depend on it.
4. Canary catalogue API through Astro, with fallback enabled; verify page 1, page 2,
   filtered noindex, hreflang and related links.
5. Canary sitemap shards through Astro, with fallback enabled; verify root index,
   locale page sitemap, first/last listing shard and URL counts.
6. Disable both compatibility fallbacks only after both Stage 2 and Stage 3
   authoritative reads pass production smoke.

## Cache and privacy

Catalogue cache keys include locale and page. Filter variants stay
`noindex,follow` and `no-store`; canonical catalogue pages keep the existing
edge catalogue cache profile. Sitemap manifests/pages use the sitemap profile.

The listing shard response is deliberately slug-only: `slug` and `lastmod` are
the only listing fields. It must never expose seller data, descriptions,
images, translations, auth fields or arbitrary user filters. No endpoint calls
an AI provider during a public GET.

## Files

- `01_additive_schema.xs` — generation/index tables;
- `GET_public_locale_catalog.draft.xs` — bounded localized catalogue;
- `GET_public_seo_sitemap_manifest.draft.xs` — global generation manifest;
- `GET_public_locale_sitemap_listings.draft.xs` — immutable slug shard;
- `MATERIALIZER_CONTRACT.md` — safe refresh and activation workflow;
- `public-contract.json` — frontend boundary contract.
