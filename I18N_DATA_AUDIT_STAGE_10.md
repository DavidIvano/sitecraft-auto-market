# I18N Data Audit — Stage 10

Date: 2026-07-30
Scope: current local frontend and read-only production `GET /cars` sample before migration.

## Executive Summary

The production content model is legacy and Russian-first. The public API returned 13 listings and stores vehicle taxonomy as visible labels rather than stable codes. The frontend contains 64 explicit `ru-RU`/Russian locale marker lines across 27 files, 2,429 source lines containing Cyrillic UI or business text, and eight active description-parsing locations. A direct multilingual switch would mix Russian UI, localized free text and legacy taxonomy values, so Stage 10 must follow additive schema, dual write, backfill, dual read and feature flags.

Release 1 introduces the locale registry and canonical taxonomy without changing current public reads. Unknown legacy values are marked `needs_review`; they are never guessed.

## Production Value Sample

Read-only response: `GET /cars`, HTTP 200, 13 public rows.

| Field | Observed production values |
| --- | --- |
| `vehicle_type` | `Коммерческий транспорт`, `Легковой автомобиль` |
| `body_type` | `Минивэн`, `Седан`, `Универсал`, `Фургон`, `Хэтчбек` |
| `fuel_type` | `Бензин`, `Дизель` |
| `transmission` | `Автомат`, `Механика` |
| `drivetrain` | empty, `Задний`, `Передний` |
| `color` | empty, `Белый`, `Серебристый`, `Серый`, `Чёрный` |
| `condition` | empty |
| `vehicle_condition` | empty, `Б/у`, `Новый` |
| `seller_type` | empty, `Частное лицо` |
| `status` | `approved` |
| `moderation_status` | `approved` |

## Data Classification

| Field | Current source | Example | Data type | Translate? | Replace with code? | Main usage | Migration strategy |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `car_listings` | `73` | integer | no | no | all routes | unchanged |
| `user_id` | `car_listings` | owner ID | relation | no | no | ownership | unchanged |
| `slug` | `car_listings` | `bmw-520-2004-73` | text | no | no | canonical route | unchanged |
| `brand` | `car_listings` | `BMW` | text | no | no | catalog, SEO | preserve exact value |
| `model` | `car_listings` | `520` | text | no | no | catalog, SEO | preserve exact value |
| `year` | `car_listings` | `2004` | integer | no | no | cards, details | locale formatter only |
| `price`/`currency` | `car_listings` | `5000` / `EUR` | decimal/text | no | no | cards, JSON-LD | locale formatter only |
| `mileage` | `car_listings` | `220000` | integer | no | no | cards, filters | locale formatter only |
| `vehicle_type` | `car_listings` | `Легковой автомобиль` | text | label only | yes | forms, details | map to `passenger_car`; dual write before switch |
| `body_type` | `car_listings` | `Седан` | text | label only | yes | filters, details | map to `sedan`; preserve unknown legacy value |
| `fuel_type` | `car_listings` | `Дизель` | text | label only | yes | filters, details | map to `diesel` |
| `transmission` | `car_listings` | `Автомат` | text | label only | yes | filters, details | map to `automatic` |
| `drivetrain` | `car_listings` | `Передний` | text | label only | yes | details | map to `front_wheel_drive` |
| `color` | `car_listings` | `Серебристый` | text | label only | yes | details | map to `silver` |
| `condition` | legacy alias | empty | text | label only | yes | normalization | consolidate into `vehicle_condition` |
| `vehicle_condition` | `car_listings` | `Б/у` | text | label only | yes | details | map to `used` |
| `seller_type` | `car_listings` | `Частное лицо` | text | label only | yes | seller card | map to `private` |
| `status` | `car_listings` | `approved` | text code | UI label only | already code | access/state | keep stable code |
| `moderation_status` | `car_listings` | `approved` | text code | UI label only | already code | admin/public access | keep stable code |
| `title` | `car_listings` | seller title | text | yes | no | cards, SEO | original + one row per locale |
| `description` | `car_listings` | seller description | text | yes | no | detail page | original + one row per locale; stop runtime parsing after backfill |
| `seo_title` | optional API field | generated title | text | yes | no | metadata | translation row |
| `seo_description` | optional API field | generated summary | text | yes | no | metadata | translation row |
| `image_alt_texts` | optional API field | array/text | JSON | yes | no | gallery | translation row |
| `search_keywords` | optional API field | array/text | JSON | yes | no | search | translation row |
| phone/email/VIN/R2 URLs | profile/listing/images | neutral/private values | text | no | no | contact/media | never send to translation provider |

## Frontend Findings

- `src/layouts/BaseLayout.astro` had global `lang="ru"`.
- 27 files contain explicit `ru-RU` formatting or locale use.
- `src/data/carOptions.ts` uses Russian visible labels as submitted option values.
- `src/pages/cars/[slug].astro`, `src/pages/cars/index.astro`, `src/pages/index.astro` and edit flows parse structured characteristics from `description`.
- Header, footer, dashboard, catalog, auth, validation and error text are hardcoded instead of dictionary keys.
- Existing public routes are unprefixed (`/cars/...`) and the sitemap is single-locale.
- Existing `src/lib/seo/vehicleTaxonomy.ts` is brand/model SEO taxonomy, not the new stable vehicle-value taxonomy.
- Deal Finder has a separate Russian translation workflow and is outside the public listing translation migration.

## Current Public Xano Contracts

- `GET /cars`
- `GET /cars/{slug}`
- `GET /cars/{slug}/seller-listings`
- `GET /cars/{slug}/related` (ID `3999920`)

The three Stage 10 routes do not yet accept or resolve `locale`. Release 1 intentionally leaves their response contract unchanged.

## Migration Decision

1. Add locale, taxonomy, translation, job and migration-log tables.
2. Add nullable locale/hash/version fields without rewriting rows.
3. Keep all `I18N_*` feature flags false.
4. Add dual write only after endpoint backups and contract tests.
5. Backfill 25–100 records per idempotent batch.
6. Enable localized reads for admin/test traffic before public routes.
7. Roll out `de`, then `en`, `uk`, `zh-Hans` separately.
8. Remove description parsing and legacy labels only after contamination and rollback tests pass.

## Risks

- Existing free-plan Xano has only the live branch, so destructive migration tests are not acceptable.
- Legacy values may include spellings not visible in the 13-row public sample.
- A translation row must always be selected by `car_listing_id + locale_code`; selecting the first row is a critical isolation failure.
- Public route locale and cache key must remain coupled.
