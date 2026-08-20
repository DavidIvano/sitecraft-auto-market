# Taxonomy materializer contract

This is an internal, authenticated Xano job. It is intentionally documented
before a live script is created because generation activation changes public
SEO state and must be matched to the actual live Metadata API schema.

## Inputs

- `locale` (required, active registry code);
- `dry_run=true` by default;
- `cursor` and `limit` for bounded batches (`limit <= 250`);
- optional `listing_id` for an event-driven refresh;
- server-only materializer secret; never a browser/API key.

## Canonical source fields

Prefer additive `brand_slug`, `model_slug`, `city_slug`, `region_slug`,
`fuel_code` and `body_code` when present. Until the safe backfill is complete,
use the same normalization dictionaries and fixed price buckets as
`src/lib/seo/taxonomies.ts`. Unknown values produce a warning and no edge; they
must never invent a canonical SEO entity.

## Full generation algorithm

1. Allocate an immutable generation ID.
2. Read public listing IDs in batches of at most 250.
3. Resolve translation readiness for the requested locale using current source
   hash/version rules. Never call an AI provider.
4. Upsert canonical facets into the new inactive generation.
5. Upsert unique listing/facet/locale edges.
6. Aggregate ready counts and latest listing update into locale stats.
7. Apply the centralized thresholds: brand/model 1; city/region/fuel/body/price
   3. Store the result in `is_indexable` for diagnostics, but the Astro client
   rechecks the gate.
8. Precompute pairwise overlap only across a listing’s seven direct facets.
   Rank per source facet and related type; retain at most 8 per group.
9. Verify invariants:
   - no duplicate canonical facet keys;
   - every edge references a public, locale-ready listing;
   - stats equal edge counts;
   - no arbitrary filter combination exists;
   - fixed price slugs match the central allowlist;
   - every related row has positive overlap and an indexable target.
10. In one transaction, deactivate the previous locale generation and activate
    every table row from the verified new generation.
11. Emit safe metrics (generation, locale, counts, duration, warnings) and
    invalidate only affected taxonomy/catalog/sitemap cache scopes.

If any invariant fails, the new generation remains inactive. The previous
complete generation continues serving traffic.

## Event-driven refresh

Queue refresh after:

- listing approval, publication, sale, archive, block or deletion;
- canonical brand/model/city/region/fuel/body/price change;
- translation row becomes ready, stale or removed;
- locale publication state changes.

Events are idempotent by `listing_id + translation_version + locale`. Multiple
events may coalesce into one bounded generation job.

## Safe release evidence

Before activation, compare materialized results to the current Astro graph for
every production listing and public locale. Record:

- total listings and facets by type;
- canonical key diffs;
- count diffs;
- indexability diffs;
- ready-locale diffs;
- related-link targets;
- zero orphan/duplicate/inconsistent rows.

Do not enable `PUBLIC_SEO_TAXONOMY_API_ENABLED` without this evidence.
