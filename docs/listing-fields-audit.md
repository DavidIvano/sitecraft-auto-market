# Listing fields audit

Updated: 2026-07-14

This document records the canonical listing contract used by the manual form, AI assistant, Xano drafts, published listings, and the public detail page. Existing aliases remain readable during migration, but new writes use the canonical names.

## Canonical contract

| Field | Manual form before | AI before | `car_drafts` before | `car_listings` before | Create draft before | Submit before | Detail response before | Detail UI before | Canonical action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `title` | yes | yes | yes | yes | yes | yes | yes | yes | keep |
| `vehicle_type` | `vehicleType` | yes | yes | yes | yes | yes | yes | yes | canonicalize form payload |
| `brand` | yes | yes | yes | yes | yes | yes | yes | yes | keep |
| `model` | yes | yes | yes | yes | yes | yes | yes | yes | keep |
| `year` | yes | yes | yes | yes | yes | yes | yes | yes | keep |
| `price` | yes | yes | yes | yes | yes | yes | yes | yes | keep |
| `currency` | implicit EUR | absent | absent | yes | accepted | yes | yes | used by price | add to AI state and draft |
| `mileage` | yes | yes | yes | yes | yes | yes | yes | yes | keep; manual confirmation |
| `city` | `location` | yes | yes | yes | yes | yes | yes | yes | canonicalize form payload |
| `country` | implicit Germany | defaulted | absent | yes | accepted in metadata | yes | yes | yes | add to both forms and draft |
| `body_type` | `bodyType` | yes | yes | yes | yes | yes | yes | yes | canonicalize form payload |
| `fuel_type` | `fuelType` | yes | yes | yes | yes | yes | yes | yes | canonicalize form payload |
| `engine_volume` | `engineVolume` | yes | yes | yes | yes | yes | yes | yes | canonicalize form payload |
| `transmission` | yes | yes | yes | yes | yes | yes | yes | yes | keep |
| `drivetrain` | yes | missing | missing | yes | missing | lost | yes | yes | add end to end |
| `doors` | yes | yes | missing | yes | accepted but not stored | yes | yes | yes | add to draft |
| `seats` | yes | yes | missing | yes | accepted but not stored | yes | yes | yes | add to draft |
| `color` | yes | yes | yes | yes | yes | yes | yes | yes | keep |
| `owners_count` | `ownerCount` | missing | yes | yes | missing | lost (`owner_count` alias only) | yes + alias | yes | canonical write; read `owner_count` |
| `first_registration` | `firstRegistrationDate` | missing | yes | yes | missing | lost (`first_registration_date` alias only) | yes + alias | yes | canonical write; read legacy alias |
| `vehicle_condition` | `condition` | missing | missing | `condition` only | missing | lost | `condition` only | yes | add canonical column; read `condition` |
| `seller_type` | `sellerType` | missing | missing | yes | missing | lost | yes | yes | add end to end |
| `seller_name` | `sellerName` | auth fallback only | missing | yes | accepted but stored only in AI payload | yes | yes | contact only | add to draft; runtime seller card |
| `seller_phone` | `sellerPhone` | missing | missing | yes | accepted but stored only in AI payload | yes | yes | contact only | add to draft; never static plain text |
| `seller_email` | `sellerEmail` | auth fallback | missing | yes | accepted but stored only in AI payload | yes | yes | contact only | add to draft; never static plain text |
| `vin` | yes | unsafe OCR possible | missing | yes | accepted but not stored | yes | public full VIN possible | hidden by static sanitizer | add to draft; public response exposes `vin_masked` only |
| `has_valid_tuv` | missing | missing | missing | missing | missing | missing | missing | description fallback only | add nullable boolean end to end |
| `tuv_valid_until` | missing | missing | missing | missing | missing | missing | missing | description fallback only | add nullable `YYYY-MM` end to end |
| `description` | yes | yes | yes | yes | yes | yes | yes | yes | keep; stop embedding structured fields |
| `images` | 1-8 | 1-8 | relation | relation | relation | copied | relation | gallery | keep |
| `listing_quality_score` | calculated after explicit AI quality check | yes | nullable integer | nullable integer | canonical FormData field | copied unchanged | yes | shown only when present | never coerce absent value to `0` |
| `photo_quality_score` | calculated after explicit AI quality check | yes | nullable integer | nullable integer | canonical FormData field | copied unchanged | yes | shown only when present | never coerce absent value to `0` |
| `trust_score` | calculated after explicit AI quality check | yes | nullable integer | nullable integer | canonical FormData field | copied unchanged | yes | shown only when present | never coerce absent value to `0` |

## Alias policy

- `drive_type` is accepted as an input alias for `drivetrain`.
- `owner_count` is accepted as an input/read alias for `owners_count`.
- `condition` is accepted as an input/read alias for `vehicle_condition`.
- `registration_date` and `first_registration_date` are accepted as input/read aliases for `first_registration`.
- New frontend writes and new Xano projections use only the canonical field names.

## Confirmed backend migration

`car_drafts` table ID `863714` was missing `currency`, `country`, `drivetrain`, `doors`, `seats`, `vehicle_condition`, `seller_type`, seller contact fields, `vin`, `has_valid_tuv`, and `tuv_valid_until`. These columns now exist. `seller_phone`, `seller_email`, and `vin` remain sensitive. `has_valid_tuv` is nullable boolean and `tuv_valid_until` stores canonical `YYYY-MM` text.

`car_listings` table ID `861468` already held most legacy fields, but was missing `vehicle_condition`, `has_valid_tuv`, and `tuv_valid_until`. These columns now exist. Legacy aliases `owner_count`, `first_registration_date`, and `condition` are retained for backward-compatible reads; new writes use the canonical names.

The two tables now also have nullable integer fields `listing_quality_score`, `photo_quality_score`, and `trust_score`. `POST /listings/create-draft` (`3982637`) validates and saves the canonical fields and also keeps them in `ai_payload.scores` for backward-compatible reads. `POST /listings/submit-moderation` (`3982675`) copies the stored values to `car_listings`; direct submission safely falls back to the submitted score object only when no draft exists. A missing score remains `null`, not `0`.

## Implemented end-to-end contract

| Surface | Result |
| --- | --- |
| Manual form | Complete canonical field set plus required TÜV/HU confirmation |
| AI review form | Same complete field set; sensitive/document fields require confirmation |
| `POST /ai/listing/analyze-photos` | Full normalized contract, confidence map, field sources, null/manual-required policy |
| `POST /listings/create-draft` (`3982637`) | Saves incomplete canonical drafts and TÜV/HU values |
| `POST /listings/submit-moderation` (`3982675`) | Validates required fields and copies canonical draft fields to listing |
| `POST /cars` (`3966700`) | Accepts the same manual contract |
| `PATCH /dashboard/listings/{id}` (`3969714`) | Preserves the same canonical fields during editing |
| `GET /dashboard/listings` (`3968100`) | Returns owner-scoped listing data including new safe fields |
| `GET /cars` (`3966698`) | Returns the public catalog projection only |
| `GET /cars/{slug}` (`3966699`) | Returns full safe detail data, masked VIN, seller summary, safe seller listings, canonical AI scores, and structured AI analysis |
| `GET /cars/{slug}/seller-listings` (`3985671`) | Returns at most six public cards without seller identity or private status fields |

TÜV/HU validation is shared by frontend and Xano: draft values may be null; moderation submit requires an explicit boolean, requires a future `YYYY-MM` when true, and rejects a date when false. Existing rows remain null and are not silently treated as “Нет”.

AI never supplies seller contacts, seller type, owner count, first registration, full VIN, or TÜV/HU from inference alone. Mileage, engine volume, drivetrain, vehicle condition, and document-derived values stay editable and require confirmation according to confidence/source policy.

## Public privacy finding

Before this change, both `GET /cars` (endpoint `3966698`) and `GET /cars/{slug}` (endpoint `3966699`) returned the raw listing record. This exposed `user_id`, seller contacts, and the full `vin` field when present. The implemented public contract removes those fields, returns `vin_masked`, and keeps seller contact as a validated runtime action rather than static plain text. Static detail HTML contains neither the contact href nor the full VIN.

## Save-before-submit synchronization (2026-07-15)

The AI review form and `car_drafts` could previously diverge after the first confirmation. The form looked complete while `POST /listings/submit-moderation` correctly read stale canonical columns from Xano. Moderation submission now always saves the current canonical payload immediately before submit, even for an existing draft.

The current payload includes title, vehicle type, brand, model, year, price, currency, mileage, city, country, body type, fuel, engine volume, transmission, drivetrain, doors, seats, color, owners count, first registration, condition, seller type/name/contact, VIN, description, TÜV/HU, stored AI scores, accepted suggestions, AI analysis, and image metadata. Legacy aliases remain write-only compatibility fields.

Seller validation requires phone OR email. Cached auth identity may prefill a visible control once, but cannot replace a value the seller removed. `has_valid_tuv=false` remains explicit and clears `tuv_valid_until`; true requires a valid future `YYYY-MM`.

Xano's structured validation response maps canonical and legacy field names back to the form. Missing fields do not create a listing or copy images. A valid owned draft creates or updates one listing with `pending_review`; repeated submission is idempotent.
