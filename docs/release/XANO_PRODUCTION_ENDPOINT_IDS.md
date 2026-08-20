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
| 4020327 | GET | `/public/locale/catalog` |
| 4020328 | GET | `/public/locale/sitemap/listings` |
| 4020329 | GET | `/public/seo/sitemap/manifest` |
| 4020380 | GET | `/public/locale/taxonomies/counts` |
| 4020381 | GET | `/public/locale/taxonomy/{type}/{slug}/related` |
| 4020382 | GET | `/public/locale/taxonomy/{type}/{slug}` |

The frontend uses route paths, not numeric endpoint IDs. IDs are recorded for Xano audit, rollback, and request-history lookup.
