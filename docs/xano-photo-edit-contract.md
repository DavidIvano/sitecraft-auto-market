# Xano contract for listing photos and editing

## Why Audi A1 shows only 1 / 1

The frontend gallery shows exactly what Xano returns from:

```txt
GET /cars/{slug}
```

For `audi-a1-2026-15`, Xano currently returns only one row in `images`.
That means the issue is in Xano saving only one uploaded file into `car_listing_images`.

## Tables

`car_listings` should have:

```txt
main_image_url text
user_id integer/reference automarket_users
```

`car_listing_images` should have one row per photo:

```txt
id
created_at
car_listing_id integer/reference car_listings
image file/image metadata
image_url text
sort_order integer
is_main boolean
```

For 5 photos, the table must contain 5 rows with the same `car_listing_id` and `sort_order` from `0` to `4`.

## POST /cars

Input must include:

```txt
photos: Storage -> File Resource -> List, optional
```

The endpoint should:

1. Create `car_listings` record.
2. Loop through `$input.photos`.
3. For each file, create/store the image in Xano storage.
4. Add one row to `car_listing_images`.
5. Set `main_image_url` from the row where `sort_order == 0`.
6. Limit to 5 photos.

The frontend sends `multipart/form-data` with repeated `photos` fields.

## PATCH /dashboard/listings/{id}

This endpoint is needed for the edit page.

The edit page now uploads new files to Cloudflare R2 first, then sends metadata to Xano. Keep the old `photos` fallback only for manual Xano tests.

Input should accept:

```txt
title text
brand text
model text
year integer
price decimal
mileage integer
city text
country text
fuel_type text
transmission text
seller_name text
seller_phone text
seller_email email optional
description text
replace_photos boolean/text optional
delete_image_ids text optional
r2_images text/json optional
new_image_urls text/json optional
new_image_keys text/json optional
photos Storage -> File Resource -> List optional
```

Expected behavior:

1. Authenticate with `automarket_users`.
2. Find listing by `id` and `user_id == $auth.id`.
3. Update listing fields.
4. Set `status = draft` or `pending_review` after edit, depending on moderation flow.
5. If `delete_image_ids` is passed, delete those rows from `car_listing_images` only for this listing.
6. If `replace_photos == true`, delete all existing `car_listing_images` rows for this listing.
7. If `r2_images` is passed, parse JSON and add one row per R2 image to `car_listing_images`.
8. If `new_image_urls` is passed without `r2_images`, add one row per public URL to `car_listing_images`.
9. If legacy `photos` are passed, store each file in Xano, build a full public URL from `image.path`, and add rows to `car_listing_images`.
10. Do not rely on the `image` column for new rows. Save the public URL in `image_url` and the full source object in `image_metadata`.
11. Recalculate `sort_order`, `is_main`, and `is_primary`.
12. Update `car_listings.main_image_url` and `car_listings.cover_image_url` from the first remaining image.

After saving, the frontend can call:

```txt
PATCH /cars/{id}/submit
```

to send the listing back to moderation.

The full copy-paste endpoint is in:

```txt
docs/xano-endpoint-patch-dashboard-listings-id-photos.xs
```
