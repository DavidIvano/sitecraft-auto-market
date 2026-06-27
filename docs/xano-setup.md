# Xano API Setup

This project uses Xano for records, moderation, and temporary image storage.

## API Group

Create an API group named `public` or `auto_market`.

Example base URL:

```txt
https://YOUR_INSTANCE.xano.io/api:YOUR_GROUP
```

Use this value for:

```txt
PUBLIC_XANO_API_URL
```

## Tables

### car_listings

| Field | Type | Notes |
| --- | --- | --- |
| id | integer | Xano default |
| slug | text | Unique. Generate from title + id or title + timestamp. |
| title | text | Required |
| brand | text | Required |
| model | text | Required |
| year | integer | Required |
| mileage | integer | Required |
| fuel_type | text | Required |
| transmission | text | Required |
| price | decimal | Required |
| currency | text | Default `EUR` |
| city | text | Required |
| country | text | Default `Германия` |
| description | text | Required |
| status | enum/text | `draft`, `pending_review`, `approved`, `rejected`, `archived`, `sold` |
| main_image_url | text | Copied from the first uploaded Xano image metadata URL |
| created_at | timestamp | Xano default |
| updated_at | timestamp | Xano default |

### car_listing_images

| Field | Type | Notes |
| --- | --- | --- |
| id | integer | Xano default |
| car_listing_id | table reference | References `car_listings` |
| image | file/image metadata | Xano file metadata object |
| image_url | text | Public URL from Xano file metadata |
| sort_order | integer | `0`, `1`, `2`... |
| is_main | boolean | First image is `true` |
| created_at | timestamp | Xano default |

## Endpoints

### GET /cars

Public catalog endpoint.

Function stack:

1. Query all records from `car_listings`.
2. Filter `status = approved`.
3. Sort by `created_at desc`.
4. Return list.

### GET /cars/{slug}

Public detail endpoint.

Function stack:

1. Input: `slug` from path.
2. Query single `car_listings` record where `slug = input.slug` and `status = approved`.
3. Query related `car_listing_images` by `car_listing_id`.
4. Add images to response as `images`.
5. Return record or `404`.

### POST /cars

Creates a draft listing with optional images.

Inputs:

| Name | Type |
| --- | --- |
| title | text |
| brand | text |
| model | text |
| year | integer |
| mileage | integer |
| fuel_type | text |
| transmission | text |
| price | decimal |
| currency | text |
| city | text |
| country | text |
| description | text |
| status | text |
| images | Storage -> File Resource -> List |

Function stack:

1. Add record to `car_listings` with status `draft`.
2. Generate `slug` from title and new record id.
3. If `images` exists, loop through uploaded file resources.
4. For each image, create metadata/file record in Xano file storage.
5. Add row to `car_listing_images`.
6. For the first image, update `car_listings.main_image_url`.
7. Return the created listing with images.

Important: the frontend sends this endpoint as `multipart/form-data` with `images` as the file input name.

### PATCH /cars/{id}/submit

Moves listing from draft to moderation.

Function stack:

1. Input: `id` from path.
2. Find listing by id.
3. Update status to `pending_review`.
4. Return listing.

### GET /dashboard/listings

Temporary endpoint for the future user dashboard.

For now, return all listings or filter by future authenticated user id.

### GET /admin/moderation

Admin moderation queue.

Function stack:

1. Query `car_listings`.
2. Filter `status = pending_review`.
3. Sort by `created_at asc`.
4. Return list.

### PATCH /admin/cars/{id}/approve

Function stack:

1. Find listing by id.
2. Update status to `approved`.
3. Return listing.

### PATCH /admin/cars/{id}/reject

Inputs:

| Name | Type |
| --- | --- |
| reason | text |

Function stack:

1. Find listing by id.
2. Update status to `rejected`.
3. Store rejection reason later if needed.
4. Return listing.

## CORS

Allow these origins:

```txt
http://localhost:4321
https://sitecraft-auto-market.pages.dev
```

Add your future custom domain after it is connected.

## Notes

Xano file upload endpoints should start with a File Resource input. Xano documentation describes file uploads through `Storage -> File Resource`, and the input can be a list for multiple images.
