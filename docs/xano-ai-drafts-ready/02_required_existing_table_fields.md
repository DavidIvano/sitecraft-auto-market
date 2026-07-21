# Existing table fields required by AI drafts

Проверь существующие таблицы. Если поля уже есть, не создавай дубликаты.

## `car_listings` или `cars`

Нужные поля:

```text
int user_id
int draft_id?
text title
text brand
text model
int year?
int mileage?
text fuel_type?
text transmission?
text body_type?
text vehicle_type?
text engine_volume?
text first_registration?
int owners_count?
text color?
int price?
text city?
text description?
text slug
text status
text moderation_status?
bool is_ai_generated?
timestamp created_at
timestamp updated_at?
```

## `car_listing_images` или `car_images`

Нужные поля:

```text
int car_id
int sort_order
bool is_primary
file image?
text image_url?
text mime_type?
text original_filename?
int size_bytes?
json image_metadata?
```

## Auth table

В endpoint-ах используется:

```text
auth = "automarket_users"
```

Если твоя auth-таблица называется `user`, замени на:

```text
auth = "user"
```

