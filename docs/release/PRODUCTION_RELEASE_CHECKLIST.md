# Production release checklist

Date: 26 July 2026

Release decision: **BLOCKED - DO NOT DEPLOY**.

| Critical gate | Status | Note |
| --- | --- | --- |
| Xano staging exists | BLOCKED | Free plan rejects branches and sandbox |
| XanoScript compiles in staging | NOT RUN | staging unavailable |
| Authenticated Favorites E2E | NOT RUN | staging unavailable |
| Contact consent/hidden DTO E2E | NOT RUN | staging unavailable |
| IDOR tests | NOT RUN | staging unavailable |
| Luna provider trace | NOT RUN | updated endpoints unpublished |
| One-credit idempotency | NOT RUN | staging unavailable |
| Provider failure does not charge | NOT RUN | staging unavailable |
| Translation is real and cached | NOT RUN | endpoint has no ID |
| Internal Worker routes remain closed | PASS (static/local) | production/staging smoke still required |
| Frontend/backend contract match | PASS (static/local) | staging integration still required |
| `npm audit` | PASS | 0 vulnerabilities |
| Astro/TypeScript check | PASS | 0 diagnostics |
| Tests | PASS | 251/251 |
| Production build | PASS | Worker bundle compiled |
| Browser dependency smoke | PASS (local) | 12 checks, no console issues/overflow |

Because the critical staging and authenticated gates are not PASS, the required order `Xano -> Worker -> frontend` was not started. Existing production deployments remain untouched.

## Cloudflare read-only precheck

- Wrangler 4.114.0 is authenticated.
- Pages project `sitecraft-auto-market` exists with `sitecraft-auto-market.pages.dev` and `automarket.sitecraft.agency`.
- Deal Finder Worker deployment history is readable.
- No preview or production deployment was created in this run.

