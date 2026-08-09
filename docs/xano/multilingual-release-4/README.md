# Xano contract for Multilingual Release 4

This directory documents the additive migration and contains the reviewed live
XanoScript for the two strict public locale endpoints. It contains no secrets.
The migration was applied additively to production and did not delete or rename
existing Xano tables or legacy endpoints.

## Data model

- `locales` is the backend copy of the reviewed locale registry. `is_public`
  controls rollout; it must never be inferred from the existence of a row.
- `car_listings.source_locale`, `translation_version`, and
  `translation_source_hash` identify the authoritative seller content.
- `car_listing_translations` is unique by `(car_listing_id, locale_code)` and
  stores `title`, `description`, SEO fields, `source_hash`, status and timestamps.
- `translation_jobs` is an asynchronous queue. Public GET endpoints never call
  an AI provider and never wait for a translation job.
- taxonomy values remain canonical codes. Labels are resolved from reviewed
  dictionaries or `taxonomy_translations`, never generated per request.

## Public read rule

A localized listing is returned only when one of these conditions is true:

1. `source_locale == requested_locale`; or
2. a translation for `requested_locale` is approved/translated, its
   `source_hash` matches the listing source hash, and its version matches the
   listing translation version.

Missing, pending, failed, stale, fallback-language, empty-title, and
empty-description records are excluded from public SEO responses.

## Applied rollout

1. Additive columns/tables and indexes are present and verified.
2. `de` is the only public locale; prepared locales remain nonpublic.
3. Strict locale-aware endpoints are deployed alongside legacy endpoints.
4. Readiness, response privacy and legacy parity were verified.
5. Global frontend flags and production HTTP checks are part of deployment.
6. Future locales must still be enabled one at a time.

The current frontend uses the existing `lang` query parameter when calling
Xano. Browser URLs use `/{locale}/...`; the two contracts are intentionally
separate.
