# Xano rollback plan

Production workspace: `sitecraft.agency` (`115940`), live branch `v1`, API group `sitecraft-auto-market` (`421515`).

## Rollout recovery points (2026-07-26)

- Before direct rollout: `/Users/david/.codex/audits/sitecraft-auto-market/xano-live-before-direct-rollout-2026-07-26`
- After additive schema: `/Users/david/.codex/audits/sitecraft-auto-market/xano-live-after-schema-2026-07-26`
- After new endpoints: `/Users/david/.codex/audits/sitecraft-auto-market/xano-live-after-new-endpoints-2026-07-26`
- After AI and Worker rollout: `/Users/david/.codex/audits/sitecraft-auto-market/xano-live-after-ai-worker-2026-07-26`
- Current Pages deployment: `aaacf090-8d9f-4057-a942-06f8c19b0c72`
- Previous Pages deployment: `4a64db87-6020-4c4a-9459-cc7fceb8764b`
- Current Worker version: `0115f0db-17f4-4d47-a346-4bfd82e51fbf`
- Previous Worker version: `ac733cc3-76fd-46e8-84bc-3fd4cf6d7e89`

The external audit folders are private and must not be copied into the public repository.

## Stop rule

Stop after the first failing layer. Keep `v1` live, restore only that layer, and delete no tables or records while they may contain retained data.

## Endpoint rollback

Restore only affected endpoint files from the external metadata snapshot. Verify the recorded SHA-256 checksum, run a dry-run, compile, and smoke-test the restored endpoint before continuing.

Existing endpoints changed in this rollout:

- Public responses: `3966698`, `3966699`, `3985671`.
- AI: `3979609`, `3981498`, `3981478`, `3981451`, `3981578`.

New endpoints that can be disabled without touching existing records:

- Favorites: `3997833`-`3997836`.
- Contact profile: `3997837`, `3997838`.
- Deal Finder translation: `3997839`.

Restore an existing endpoint from its matching file under the before-rollout snapshot. For a new endpoint regression, disable or delete only the affected endpoint after confirming the frontend no longer calls it. Do not expose a rollback endpoint.

## Schema rollback

- Do not automatically drop `car_listing_favorites` or `deal_finder_translations` after they contain rows.
- Disable the new endpoints first.
- Export/count affected rows and inspect references.
- Nullable contact fields can remain safely with visibility defaults set to false.
- Remove a table or index only after confirming no retained data and no endpoint dependency.

## Layer isolation

1. Frontend regression: roll Pages production back from `aaacf090-8d9f-4057-a942-06f8c19b0c72` to `4a64db87-6020-4c4a-9459-cc7fceb8764b`; leave Xano and Worker intact.
2. Worker regression: deploy Worker version `ac733cc3-76fd-46e8-84bc-3fd4cf6d7e89` at 100%; leave Xano intact.
3. Xano endpoint regression: restore the specific endpoint script from backup.
4. Xano schema regression: disable dependants, inspect data, then perform a reviewed migration.

No rollback endpoint is public. No secret or user record is stored in this plan.
