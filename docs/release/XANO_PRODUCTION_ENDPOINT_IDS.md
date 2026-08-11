# Xano Production Endpoint IDs

Workspace `sitecraft.agency` (`115940`), live branch `v1`, API group `sitecraft-auto-market` (`421515`).

| ID | Method | Route |
| ---: | --- | --- |
| 3999920 | GET | `/cars/{slug}/related` |
| 3997833 | DELETE | `/favorites/{listing_id}` |
| 3997834 | POST | `/favorites/{listing_id}` |
| 3997835 | POST | `/favorites/status` |
| 3997836 | GET | `/favorites` |
| 3997837 | GET | `/me/contact-profile` |
| 3997838 | PATCH | `/me/contact-profile` |
| 3997839 | POST | `/deal-finder/listings/{id}/translate-description` |
| 4011207 | POST | `/translations/internal/locales/release` |

The frontend uses route paths, not numeric endpoint IDs. IDs are recorded for Xano audit, rollback, and request-history lookup.
