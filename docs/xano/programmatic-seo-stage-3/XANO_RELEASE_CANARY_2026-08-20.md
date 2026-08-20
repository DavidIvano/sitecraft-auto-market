# Xano Stage 3 release and direct canary — 20 August 2026

## Scope

Additive release only in workspace `115940`, production branch `v1`, API group
`421515`. No legacy table, field, endpoint or production listing was updated or
deleted.

New tables:

| ID | Name | Purpose |
| ---: | --- | --- |
| 880518 | `seo_listing_locale_index` | Immutable locale/listing readiness and catalogue ordering |
| 880519 | `seo_sitemap_locale_generations` | Locale totals and sitemap shard manifest |

New public read-only endpoints:

| ID | Method | Path |
| ---: | --- | --- |
| 4020327 | GET | `/public/locale/catalog` |
| 4020328 | GET | `/public/locale/sitemap/listings` |
| 4020329 | GET | `/public/seo/sitemap/manifest` |

## Safety sequence

1. Saved a fresh live metadata snapshot and a separate records backup outside
   the repository.
2. Ran Xano workspace push dry-run: exactly two table additions and three GET
   endpoint additions; zero updates and zero deletes.
3. Applied the same reviewed additive push.
4. Rebuilt readiness from the live public-listing, translation and locale
   state without changing those source tables.
5. Inserted the complete generation with `is_active=false`.
6. Verified exact counts and uniqueness.
7. Activated all index rows, verified 281/281, then activated the 28 manifest
   rows last and verified them again.

The Xano free-instance rate limit interrupted index activation once. Manifest
rows were still inactive, so the incomplete generation was not advertised.
The release resumed idempotently, detected 253 completed activations, finished
the remaining 28 one at a time, reverified the full index, and only then
activated the manifest.

## Active generation

- Generation: `g20260820canary1`
- Public locales: 28
- Current approved/public listings: 11
- Exact ready locale/listing rows: 281
- Listing total range by locale: 10–11
- Manifest rows: 28
- Shard size: 10,000
- Shards per current locale: 1

The non-rectangular 281-row result is intentional. One approved listing is
ready only in its source locale; no fallback or stale translation was promoted
into the SEO index.

## Direct canary result

The repository's strict TypeScript normalizers accepted all sampled live
responses:

- manifest: 28/28 registered public locales, one valid generation;
- German catalogue/shard: 10/10, exact slug parity;
- Russian catalogue/shard: 11/11, exact slug parity;
- Arabic catalogue/shard: 10/10, exact slug parity;
- every listing shard item contains only `slug` and `lastmod`;
- no seller, email, phone, user ID or VIN field is present;
- invalid generation: 404;
- out-of-range shard page: 404;
- invalid locale: 404.

Result: **PASS**.

## Rollout state

Stage 2 counts/page/related endpoints were subsequently released and verified.
The combined Stage 2–3 Cloudflare canary is active from commit `732d92b`:
catalogue and sitemap shard APIs are enabled with explicit compatibility
fallbacks retained for the observation window. The production root sitemap now
reports `xano_sharded`; German shard parity is 10/10. Repository defaults remain
`false`, so an unset environment fails safely.
