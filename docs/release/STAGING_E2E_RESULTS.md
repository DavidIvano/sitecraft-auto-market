# Staging E2E results

Date: 26 July 2026

## Status

**BLOCKED - no Xano staging environment is available.**

Xano workspace `115940` has only live branch `v1`. Branch creation and the Xano sandbox are restricted by the current Free plan. The live API was not mutated and production data was not used for destructive tests.

## Test matrix

| Area | Status | Evidence / blocker |
| --- | --- | --- |
| Email/password auth | NOT RUN | no isolated staging backend/test users |
| Google OAuth | NOT RUN | no isolated staging callback/environment |
| Favorites owner/idempotency/IDOR | NOT RUN | schema and endpoints cannot be installed outside live |
| Contact consent and hidden DTO | NOT RUN | fields/endpoints cannot be installed outside live |
| AI listing generation | NOT RUN | updated XanoScript cannot be compiled in staging |
| One-credit idempotency | NOT RUN | no staging wallet/ledger fixture |
| Provider failure compensation | NOT RUN | no staging endpoint/provider trace |
| Deal Finder actions/analysis | NOT RUN | completion billing patch not installed in staging |
| de -> ru translation/cache | NOT RUN | translation table/endpoint has no staging installation or ID |
| Internal secret rejection | NOT RUN for new bundle | existing static tests pass; no staging deployment |
| Browser authenticated E2E | NOT RUN | no staging frontend/backend pair |

## Local evidence retained

- 251/251 contract/regression tests pass.
- Astro check has zero diagnostics.
- Production-mode local build passes.
- Dependency smoke QA passes at 390 and 1440 px without console issues or horizontal overflow.

These checks are not represented as authenticated staging E2E.

## Resume point

1. Enable a paid Xano branch or sandbox.
2. Create `staging-favorites-ai` from live `v1`.
3. Pull the clone and compare it with the recorded backup checksums.
4. Continue with schema installation, endpoint compilation and the test matrix above.

