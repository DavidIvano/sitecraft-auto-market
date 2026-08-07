# Stage 10 Multilingual Rollout

This directory contains the additive multilingual schema and incremental endpoint artifacts. Releases 1 and 2 do not switch public reads or run AI translation.

Safe order:

1. Export live table metadata and schema.
2. Confirm the five table names do not already exist.
3. Create the five tables from `01_additive_schema.xs`.
4. Add the six nullable `car_listings` fields and nullable `automarket_users.preferred_locale`.
5. Seed `locales` idempotently by unique `code` using `02_seed_locales.json`.
6. Keep every `I18N_*` flag disabled.
7. Confirm the existing `/cars` and `/cars/{slug}` contracts are unchanged.

Rollback for Release 1 is disabling the flags. Do not delete additive tables after data has been written; archive them instead. Existing listing fields remain the production source until dual-read rollout.

## Release 2

Artifacts are stored under `release-2/`:

- `car_drafts.after.xs`;
- `POST_listings_create_draft.after.xs`;
- `POST_listings_submit_moderation.after.xs`;
- `PATCH_dashboard_listings_id.after.xs`;
- `GET_admin_listing_translations.xs`.

Safe application order:

1. export live table and endpoint metadata outside the repository;
2. add the default-safe `car_drafts.source_locale` field;
3. patch create draft;
4. patch submit moderation;
5. patch owner edit;
6. create the read-only admin translation endpoint;
7. compile every endpoint and verify unauthenticated admin access returns `401`;
8. deploy the frontend admin inspection panel;
9. keep API reads, public routes and AI translation flags disabled.

Release 2 writes the source locale, hash, original translation and idempotent translation jobs only when the relevant listing workflow runs. It does not rewrite existing production listings as part of deployment.
