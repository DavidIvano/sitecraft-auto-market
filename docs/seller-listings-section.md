# Seller listings section

Updated: 2026-07-14

## Public contract

The detail page shows “Другие автомобили продавца” before “Похожие автомобили”. Seller identity is resolved only inside Xano from `car_listings.user_id`; the browser never receives `user_id` for grouping.

Primary endpoint:

- `GET /cars/{slug}/seller-listings`
- endpoint ID `3985671`
- public, no auth
- maximum 6 items
- current listing excluded
- strict public predicate excludes draft, AI draft, pending review, needs fix, rejected, blocked, deleted, and archived rows
- response omits `user_id`, seller contacts, VIN, moderation status, admin fields, storage keys, and full image arrays

`GET /cars/{slug}` endpoint `3966699` also returns the same privacy-minimized array as `seller_listings`. Astro uses this nested array at build time so the static page does not depend on browser CORS and does not make an extra request per detail page.

## Card projection

Allowed fields are `id`, `slug`, `title`, `brand`, `model`, `year`, `mileage`, `fuel_type`, `transmission`, `body_type`, `price`, `currency`, `city`, `country`, `is_ai_generated`, nullable `listing_quality_score`, nullable `photo_quality_score`, nullable `trust_score`, and public image URL candidates. The frontend normalizes this projection again and supplies a synthetic approved display state only to the shared `CarCard` component. Absent scores are omitted from the UI rather than rendered as `AI 0%`.

The same `CarCard` component is used as in the catalog. Missing images use its existing placeholder. Images below the first viewport are lazy-loaded and have the listing title as `alt` text.

## Related-list deduplication

Seller listing slugs are removed from the similar-car candidates during static generation. The current listing is excluded by Xano. If `seller_listings` is empty, the complete seller-listings section is omitted.

## Privacy and build verification

- Static HTML contains no `user_id`, full VIN, seller email/phone, or private status tokens.
- Seller endpoint returned 6 items for the verification fixture and no forbidden keys.
- The seller section appears before the related section, excludes the current listing, and contains no links duplicated in the related section.
- The page has no horizontal overflow at 1440, 1024, 768, 430, or 375 px.
- Final static build generated 11 public detail routes; its sitemap contains the same 11 public car routes.
- Preview verification is available at `https://detail-data-scores-preview.sitecraft-auto-market.pages.dev/cars/mercedes-benz-a-class-2008-56`; no production deployment was performed in this stage.
