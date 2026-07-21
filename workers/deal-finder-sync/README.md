# SiteCraft Deal Finder Sync Worker

This isolated Worker runs the closed production Deal Finder module. It has five routes:

- `GET /health` - no secrets or source data.
- `POST /sync` - trigger-secret protected and bounded to one search, 100 candidates and four detail requests; disabled in Free-plan production.
- `POST /sync/dry-run` - same protection and manual gate, no Xano writes.
- `POST /analyze` - protected manual queue processor, limited to one job.
- `POST /analyze/dry-run` - validates a safe pending snapshot or fixture without OpenAI or Xano mutation.

Production Cron checks the AI queue every two minutes and runs one bounded source sync daily at `06:15 UTC`. The search inspects up to 100 candidates for one credit; at most four new-listing detail requests cap scheduled Kleinanzeigen Agent usage at five credits per day. The worker uses documented Kleinanzeigen Agent routes with the server-only `klaz_key` header, then calls protected Xano ingestion contracts. It does not query Gmail, scrape Kleinanzeigen, write to `car_listings`, or store images in R2. OpenAI processes only explicitly queued listing analyses.

## Security boundary

All four manual POST routes authenticate only the incoming `X-Deal-Finder-Secret` value against `DEAL_FINDER_WORKER_TRIGGER_SECRET`. `XANO_DEAL_FINDER_INGEST_SECRET` is exclusively outbound for Worker-to-Xano requests. The Xano secret, OpenAI key, and provider key are never accepted as manual trigger credentials, and the trigger secret is never forwarded to Xano.

The manual and automatic flags remain independent fail-closed gates. Free-plan production disables manual source sync while keeping the bounded automatic daily sync and manual AI path available. Setting either manual flag to false blocks its protected HTTP route before network access; setting the automatic flags to false stops the corresponding scheduled work.

`GET /health` exposes only fixed service/source labels and safe configured/enabled booleans. It never returns endpoint URLs, secret material or fingerprints, account/project metadata, usage, or billing data. Security tests cover missing/wrong credentials, secret non-interchangeability, fail-closed manual gates with zero network calls, outbound header separation, the health response, and browser bundle scans.

Production limits are locked to one search profile, 100 search candidates, four detail requests and one AI analysis per queue run. Historical controlled ingests used the previous five-result limit; new scheduled runs use the Free-plan four-detail ceiling.

Repeat sync is now split safely: search discovers IDs, `existing-ids` divides candidates, detail requests run only for new IDs, full ingest receives only validated `data_level=detail` rows, and existing IDs go to one `touch-seen` request per search. A detail failure is counted and skipped; search-level fallback is never created. Xano independently prevents search-level payloads from replacing stored detail data or user flags. No second provider sync was run while implementing or testing this policy.

The AI route uses `gpt-5.6-luna` through the OpenAI Responses API with `store=false`, `max_output_tokens=1500`, low reasoning effort, a strict JSON schema, local validation, safe error codes, and a hard `0.70` confidence cap while no comparables exist. It sends no tools, images, source URL, seller data, or raw provider payload. `OPENAI_API_KEY` is a Worker-only secret; Xano and browser code never receive it.

On 2026-07-18 the approved local checkpoint completed listing 1 and then listings 2-5 sequentially. The second batch produced exactly four enqueue/claim/Responses/complete operations and no retries. Usage was 2652 input, 3108 output, and 5760 total tokens for listings 2-5; cumulative usage was 3257 input, 3908 output, and 7165 total tokens. The queue ended with five completed rows and no pending, processing, or failed rows. Live AI was disabled again, dry-run was enabled, and the local Worker was stopped; no provider operation, Cron, or deployment ran.

Use the repository runner for explicit local batches: `npm run deal-finder:analyze -- --ids=2,3,4,5 --max=4 --stop-on-error`. It performs nothing without `--ids`, defaults to dry-run and one-at-a-time execution, rejects parallel/maximum overflow, and stops on the first failure. Explicit `--force` is reserved for a bounded manual repeat; active work is still reused and the separate Worker trigger/Xano secrets remain mandatory. Preflight and snapshot validation normalize ISO/Unix timestamps; the Xano claim transaction locks and transitions only a pending row.

For a future `deal-finder-v2`, tighten the distinction between confirmed mechanical defects, risks, and neutral operational facts. Historical v1 rows remain immutable; a controlled repeat creates a new row and must not be used merely to change subjective wording.

One approved repeat QA run for listing 1 later verified this path end to end. It created exactly one new completed row with 605 input, 781 output, and 1386 total tokens, left the original result intact, changed no listing flags, and ended with zero pending, processing, or failed rows. The local Worker was then stopped and automatic AI, sync, and Cron remained disabled.

Both the Worker trigger secret and Xano ingest secret must be ASCII-safe because Fetch API header values are byte strings. Never print them, interchange them, or expose them in a `PUBLIC_` variable.

## Deployment status

On 2026-07-18 the Worker was published as `sitecraft-deal-finder-sync` with server-only secrets and two Cron triggers. The production frontend at [sitecraft-auto-market.pages.dev](https://sitecraft-auto-market.pages.dev) enables real authenticated Xano mode. Health, analysis dry-run, sync dry-run, one real bounded sync and an empty live queue run all passed. Generated browser files contain no Worker secret names, input snapshot, provider response ID or raw OpenAI response.

Run `npm run check` here after installing the repository dependencies. Configure secrets interactively; never place them in source files or a `PUBLIC_` variable. See [DEAL_FINDER_SETUP.md](../../docs/DEAL_FINDER_SETUP.md).
