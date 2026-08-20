# Stage 3 generation materializer contract

The materializer is an internal authenticated job. It is additive,
idempotent, dry-run-first and must never be callable from the browser.

## Inputs

- `dry_run=true` by default;
- optional locale/listing ID for a bounded canary or event refresh;
- cursor plus `limit <= 250` for full rebuilds;
- server-only job secret.

## Generation algorithm

1. Allocate one immutable generation ID for the complete public locale set.
2. In batches of at most 250, select only genuinely public listings.
3. For each public locale, apply the existing strict source-hash translation
   readiness check. Never call an AI provider in this job or public GET.
4. Insert one `seo_listing_locale_index` row per ready locale/listing with the
   canonical public slug, listing lastmod and deterministic catalogue ordering.
5. Calculate each locale total and latest lastmod. Insert one inactive
   `seo_sitemap_locale_generations` row with `shard_size=10000`.
6. Verify before activation:
   - unique listing ID and slug inside locale/generation;
   - every row points to a public, locale-ready listing;
   - row count equals manifest total;
   - every public SEO-ready locale has exactly one manifest row;
   - computed shard count is `ceil(total / 10000)`;
   - total root sitemap entries do not exceed 50,000;
   - first/last catalogue pages and first/last shards have exact counts;
   - no seller/private field is present in the shard projection.
7. In one transaction deactivate the old current generation and activate all
   verified rows of the new generation. A failed generation remains inactive.
8. Emit safe metrics: generation, locale totals, shard counts, duration and
   invariant failures. Purge the root/locale catalogue cache, but immutable old
   shard URLs can retain their normal sitemap cache lifetime.

## Refresh triggers

- listing approval/publication/sale/archive/block/delete;
- canonical slug change;
- promotion/order change (catalogue ordering only);
- source hash or locale translation readiness change;
- locale publication state change.

Events are idempotent by listing ID, locale and translation version. Multiple
events may coalesce into one complete generation. Do not patch a published
generation in place because shard URLs are content-addressed by generation.

## Release evidence

For each public locale record current versus new totals, duplicate/orphan
checks, sampled card equality, sampled slug/lastmod equality, root child count,
first/last shard length and HTTP/caching headers. Do not enable the Stage 3
flags until this evidence is complete.
