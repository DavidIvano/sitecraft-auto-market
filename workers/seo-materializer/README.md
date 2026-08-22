# Production SEO materializer

The Worker drains the idempotent Xano `seo_refresh_queue` every fifteen minutes,
builds one immutable generation for all 28 public locales, validates listing
text/photo quality, stages catalogue/sitemap/taxonomy rows in bounded batches,
and asks Xano to activate the complete generation atomically. The active
sitemap manifest is the single generation pointer; catalogue and taxonomy
reads never mix rows from different immutable generations.

Xano Free is kept below its per-request execution ceiling with batches of 100,
eight exponential request attempts, one serialized staging stream and
retry-safe deterministic generation IDs. Requests are spaced by 3.2 seconds so
resumable no-op checks stay below the observed Free-plan burst limit, while the
longer backoff absorbs temporary connection resets.

Each invocation stages at most 36 row batches. The protected Xano checkpoint
stores the deterministic generation and the next batch cursor, returns the job
to `pending` without consuming a failure attempt, and lets the following cron
continue below Cloudflare's per-invocation external-subrequest limit. Only the
final phase can call atomic activation.

Required secrets (never commit them):

- `XANO_SEO_MATERIALIZER_SECRET` — shared only with protected Xano endpoints;
- `SEO_MATERIALIZER_TRIGGER_SECRET` — protects manual `POST /run`.

The production enable order is dry-run, canary generation, parity smoke, then
`SEO_MATERIALIZER_ENABLED=true`, `SEO_MATERIALIZER_DRY_RUN=false` and
`SEO_MATERIALIZER_SCHEDULED_ENABLED=true`.
