# Submit moderation: root cause and fix

Updated: 2026-07-15

## Incident

`POST /listings/submit-moderation` returned HTTP 400 with `Listing is not ready for moderation`, although the AI review form looked complete.

## Confirmed root cause

The browser and Xano were validating different snapshots:

1. The first confirmation saved a `car_drafts` row.
2. Later edits changed only the form controls.
3. Submit validated the current DOM, but skipped `POST /listings/create-draft` when an ID already existed.
4. Xano correctly reloaded the owned draft from the database and found stale or missing values.
5. The old frontend ignored Xano's field-level payload and displayed only the generic message.

Additional contract defects made the failure harder to diagnose:

- root `id` from an AI response could be mistaken for `draft_id`;
- root `id` from a save response could be mistaken for `listing_id`;
- cleared seller contact fields could be silently restored from cached auth data;
- several canonical AI-review controls were not populated after analysis;
- the Xano TÜV/HU regular expression did not correctly represent `YYYY-MM`.

## Before and after

| Field group | Visible form before submit | Stored draft before fix | Submit result before fix | Stored draft after fix |
| --- | --- | --- | --- | --- |
| Seller contact | current phone or email visible | could remain empty or old | `seller_contact` error | current visible value |
| Condition and seller type | current selection visible | could remain empty | field error | current selection |
| First registration | current month visible | could remain empty | `first_registration` error | current `YYYY-MM` |
| TÜV/HU | current choice/date visible | stale/null or rejected by regex | TÜV field error | explicit boolean and valid date |
| Images | previews visible | relation could be older snapshot | `images` error when relation empty | owned draft image relation retained |

No seller PII, token, full VIN, or image data was recorded during diagnosis.

## New browser flow

Every click on `Отправить на модерацию` now performs this sequence:

1. Read the current form controls.
2. Validate the current canonical values and 1-8 images.
3. Save the current values through `POST /listings/create-draft`.
4. Accept only explicit `draft_id`, `draft.id`, `listing_id`, `car_id`, `listing.id`, or `car.id` from the response.
5. Submit the latest server IDs through `POST /listings/submit-moderation`.
6. Keep the form intact and map backend field errors to the corresponding controls on failure.

The submit button is locked for the whole sequence, so a second click cannot start another flow. Dirty state is cleared only after a successful save and is set again by field, photo, suggestion, description, contact, VIN, or TÜV/HU changes.

## Error response contract

Xano now returns the safe structured payload below for an incomplete draft:

```json
{
  "success": false,
  "code": "LISTING_NOT_READY",
  "message": "Listing is not ready for moderation",
  "errors": [
    {
      "field": "seller_contact",
      "message": "Укажите телефон или email продавца."
    }
  ]
}
```

The frontend also accepts Xano's wrapped `payload.errors` form. It marks the corresponding control invalid, connects the message with `aria-describedby`, focuses the first invalid field, and shows the Russian summary `Объявление пока не готово к модерации. Исправьте отмеченные поля.` Unknown fields remain visible in the common error list.

## Xano changes

- `POST /listings/create-draft`, endpoint `3982637`: corrected TÜV/HU `YYYY-MM` validation; existing owner-scoped update and image deduplication remain unchanged.
- `POST /listings/submit-moderation`, endpoint `3982675`: corrected TÜV/HU validation and added the structured `LISTING_NOT_READY` payload.
- Both endpoints keep the database draft as the source of truth.
- Submit performs no approve or publish action. A valid listing moves only to `pending_review`.

## Disposable Xano test

The live Xano endpoints were tested on 2026-07-15 with a disposable user and a public non-user fixture URL. No R2 object was created.

| Scenario | Result |
| --- | --- |
| Incomplete owned draft | HTTP 400 with structured fields |
| Update existing draft | HTTP 200 and same `draft_id` |
| Complete submit | HTTP 200 and `pending_review` |
| Repeat submit | HTTP 200, `already_submitted=true`, same `listing_id` |
| Cleanup | 7 disposable database records deleted |

The incomplete test identified these missing field names: `fuel_type`, `transmission`, `vehicle_type`, `body_type`, `drivetrain`, `doors`, `seats`, `color`, `first_registration`, `vehicle_condition`, `seller_type`, and `images`.

## Release boundary

The two existing Xano endpoints were updated after their XanoScript exports had been retained in the repository. Frontend production and Cloudflare Preview were not deployed in this stage.

## Final project verification

- `npm run test`: 60/60 passed.
- `npm run check`: 0 errors, 0 warnings, 0 hints.
- `npm run build`: completed successfully.
- Client-output scan: no Xano metadata token, OpenAI key, R2 credential marker, or private key was found in 74 generated files.
