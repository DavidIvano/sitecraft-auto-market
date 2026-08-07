# German Public Routes Release 3

## Release decision

**Not released.** Release 3 implementation and Cloudflare deployment were intentionally stopped by the required gates.

The selected pilot contains one German original (`listing_id=94`), but no pilot apply has occurred and no reviewed/approved German translations exist for the Russian source listings. Publishing `/de` now would either expose an incomplete catalog or risk forbidden Russian fallback under German URLs.

## Current route state

| Area | Status |
| --- | --- |
| `/de/` | Not enabled |
| `/de/cars/` | Not enabled |
| `/de/cars/[slug]/` | Not enabled |
| German API read | Not enabled |
| German SSR contamination tests | Not applicable yet |
| German SEO / hreflang / JSON-LD | Not enabled |
| `sitemap-de.xml` | Not created |
| Locale cache isolation | Not enabled |
| Cloudflare deployment ID | None for Release 3 |

Legacy production routes remain on Release 2. No root redirect was introduced. `/en/`, `/uk/`, and `/zh-Hans/` remain disabled. AI translation remains disabled.

Read-only production smoke confirmed `/`, `/cars/`, and `/admin/moderation/` return 200, while `/de/`, `/en/`, `/uk/`, and `/zh-Hans/` return 404.

## Required gates before implementation/deploy

1. Complete controlled authenticated dual-write create/save/edit/moderation E2E.
2. Verify endpoint `4003322` returns 401/403/200 for no token, ordinary user, and admin.
3. Apply the selected 8-record pilot and prove repeat-run idempotency.
4. Enable `I18N_API_READ_ENABLED` only for admin/test listing IDs and verify strict German resolution without Russian fallback or N+1.
5. Add shared German dictionary, taxonomy labels, locale formatters, SSR routes, SEO, sitemap, cache-key isolation, and contamination tests.
6. Run all local and Cloudflare-compatible runtime checks.
7. Deploy only with `I18N_PUBLIC_ROUTES_ENABLED` and `I18N_LOCALE_DE_ENABLED`, while AI and other public locales remain false.

## Rollback plan

The future Release 3 rollback is flag-based:

```text
I18N_LOCALE_DE_ENABLED=false
I18N_PUBLIC_ROUTES_ENABLED=false
I18N_API_READ_ENABLED=false
```

No rollback action is currently needed because no German route or production Xano patch was published.
