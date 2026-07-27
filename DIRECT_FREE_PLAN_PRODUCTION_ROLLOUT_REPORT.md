# Direct Free Plan Production Rollout Report

Date: 2026-07-26

## 1. Xano workspace and branch

- Workspace: `sitecraft.agency` (`115940`).
- Live branch: `v1`.
- API group: `sitecraft-auto-market` (`421515`).
- Plan constraint: Xano Free, including the observed request-window limit.

## 2. Environment isolation

No Xano branch, sandbox, workspace, API group, Git branch, Pages project, or Worker was created. Changes were applied in small batches to the existing production resources.

## 3. Backups

- Before rollout: `/Users/david/.codex/audits/sitecraft-auto-market/xano-live-before-direct-rollout-2026-07-26`.
- After schema: `/Users/david/.codex/audits/sitecraft-auto-market/xano-live-after-schema-2026-07-26`.
- After new endpoints: `/Users/david/.codex/audits/sitecraft-auto-market/xano-live-after-new-endpoints-2026-07-26`.
- After AI and Worker: `/Users/david/.codex/audits/sitecraft-auto-market/xano-live-after-ai-worker-2026-07-26`.

The backups include metadata and private record exports where available. Secret values and private records are not reproduced in this report.

## 4. Schema changes

- Added `car_listing_favorites` with owner/listing uniqueness and lookup indexes.
- Added nullable contact-profile fields to `automarket_users`; `show_phone` and `show_email` default to `false`.
- Added `deal_finder_translations` with a unique current-translation cache key.
- Changes were additive. Login/OAuth email and existing balances were not migrated into public contact fields.

## 5. New endpoint IDs

| ID | Method | Route |
| ---: | --- | --- |
| 3997833 | DELETE | `/favorites/{listing_id}` |
| 3997834 | POST | `/favorites/{listing_id}` |
| 3997835 | POST | `/favorites/status` |
| 3997836 | GET | `/favorites` |
| 3997837 | GET | `/me/contact-profile` |
| 3997838 | PATCH | `/me/contact-profile` |
| 3997839 | POST | `/deal-finder/listings/{id}/translate-description` |

## 6. Existing endpoint changes

- Public DTOs: `3966698`, `3966699`, `3985671`.
- AI: `3979609`, `3981498`, `3981478`, `3981451`, `3981578`.
- Legacy `3974045` remains an internal historical endpoint and was removed from the active frontend route configuration instead of being enabled blindly.

## 7. Xano compilation

All new and modified scripts passed Metadata API dry-run and production compilation. Early dry-run syntax findings were corrected before publication. An auth-order issue found immediately after the first AI publication was corrected and republished before continuing.

## 8. Favorites API E2E

Controlled existing users were used. Create, repeated create, list, status, delete, repeated delete, unavailable-listing rejection, and unauthenticated `401` behavior passed. Test rows were cleaned up through the production endpoint.

## 9. Favorites IDOR

User isolation passed: the second controlled user could not list or delete the first user's favorite. The server derives ownership from `$auth.id`; request bodies do not select a user.

## 10. Contact consent

The contact GET/PATCH production path and unauthenticated `401` behavior passed. Existing users remain opt-out by default, and public DTOs do not fall back to login/OAuth email. A complete authenticated browser matrix for phone-only, email-only, both visible, validation errors, and restoration was not completed in this run because a stable controllable signed-in browser session was unavailable.

## 11. Seller DTO

`GET /cars`, `GET /cars/{slug}`, and seller listings return privacy-minimized data. Anonymous `is_saved` is `false`; hidden phone/email values and login/OAuth credentials are absent. Production Renault HTML showed the no-public-contact state and contained no tested sensitive markers.

## 12. AI model

The five active AI endpoints and the existing Worker use server-side `gpt-5.6-luna`, Responses API, `store: false`, strict output parsing, and a 60-second timeout. The frontend does not select a model or contain an OpenAI key.

A final active-source scan found no `gpt-5.4-mini`, `gpt-5.4`, `gpt-5-mini`, or `gpt-4o-mini` marker in `src` or the Worker. The production bundle contains none of the checked OpenAI, source-provider, or Xano ingest secret names.

## 13. AI generation

Compilation, active frontend routing, and unauthenticated `401` checks passed for all five endpoints. A new authenticated provider-backed photo draft was not created during final browser QA, so this report does not claim a full production photo-upload/draft-reload E2E.

## 14. Credit balance

No credit was charged by the real Deal Finder translation test. An authenticated before/after balance for a new photo generation was not measured in final E2E; the live scripts enforce post-success debit and were covered by static contract tests.

## 15. Ledger

The published metered endpoints contain one post-success ledger path. No new authenticated AI operation was run for this final rollout, so no new transaction ID is reported.

## 16. Idempotency replay

Favorites idempotency and translation cache reuse passed in production. AI idempotency is enforced server-side and covered by contract tests, but a real authenticated replay with balance verification was not completed.

## 17. Provider failure

The AI scripts place debit after successful provider parsing. Static regression tests passed. A forced production provider failure was not executed to avoid an unsafe live mutation, so the no-debit failure case is not claimed as production E2E.

## 18. Deal Finder analysis

Existing read endpoints remained protected and responsive; unauthenticated requests returned `401`. An authorized Worker analysis completion and one-credit ledger assertion were not executed because the internal trigger secret was intentionally not read or exposed.

## 19. Translation

A real authenticated German-to-Russian translation completed with `gpt-5.6-luna`; it returned the safe DTO and did not debit credits.

## 20. Translation cache

The repeated request returned the cached result (`cached: true`) and reused the persisted source hash without a second provider call.

## 21. Worker deployment

- Worker: `sitecraft-deal-finder-sync`.
- URL: `https://sitecraft-deal-finder-sync.ivanovdavid19.workers.dev`.
- Version: `0115f0db-17f4-4d47-a346-4bfd82e51fbf`.
- Local Worker check passed; deployment succeeded; health returned `200`; unauthorized `/analyze` returned `401`.
- Secret names were verified without reading values. Authorized internal completion remains an explicit limitation noted in section 18.

## 22. Frontend deployment

- Existing Pages project: `sitecraft-auto-market`.
- Production deployment: `aaacf090-8d9f-4057-a942-06f8c19b0c72`.
- Deployment URL: `https://aaacf090.sitecraft-auto-market.pages.dev`.
- Previous rollback deployment: `4a64db87-6020-4c4a-9459-cc7fceb8764b`.

## 23. Production URLs

- Primary: `https://automarket.sitecraft.agency/`.
- Technical: `https://sitecraft-auto-market.pages.dev/`.
- Canonical on the tested detail page points to `https://automarket.sitecraft.agency`.

Both domains returned `200` for the requested main, catalog, dashboard, favorites, new-listing, and Deal Finder routes. Detail routes returned `200`; two initial technical-domain `503` responses occurred only after a burst exceeded the Xano Free request window and returned `200` when retried after the window reset.

## 24. Browser QA

HTTP, rendered HTML, canonical, privacy markers, and requested route availability were checked in production. A controllable authenticated browser session could not be kept stable, so console inspection, authenticated UI actions, and the full `320/375/390/768/1024/1440` visual/overflow matrix remain unconfirmed. These are acceptance limitations, not claimed passes.

## 25. Dependency audit

`npm audit`: `0 vulnerabilities`.

## 26. Local validation

- `npm run check`: passed, 183 files, 0 errors/warnings/hints.
- `npm test`: passed, 251/251.
- `npm run build`: passed; Cloudflare advanced-mode bundle generated.
- `git diff --check`: passed.

## 27. Rollback actions

No production rollback was required. Early findings were corrected before the rollout advanced. Exact Xano, Worker, and Pages recovery points are recorded in `docs/release/XANO_ROLLBACK_PLAN.md`.

## 28. Remaining limitations and status

Production schema, endpoints, Worker, and frontend are deployed, and public smoke checks pass. The rollout is operational but the strict Definition of Done is not fully closed because the following live assertions remain unconfirmed: complete contact-consent browser matrix, favorites UI across two signed-in browser users, provider-backed photo draft with before/after balance and ledger replay, forced provider-failure no-debit, authorized Worker completion, console-clean and responsive visual matrix. Xano Free burst limits can surface temporary service-unavailable responses when many server-rendered pages are requested in one short window.

Recommended next step: run one supervised signed-in production acceptance session, record the remaining assertions without exposing tokens, and stop immediately if any balance, privacy, or ownership result differs from the contracts above.
