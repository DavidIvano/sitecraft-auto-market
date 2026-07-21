# Xano AI drafts ready scripts

Эти файлы подготовлены для SiteCraft Auto Market.

Порядок вставки в Xano:

1. `01_tables_ai_drafts_and_logs.xs`
2. `02_required_existing_table_fields.md`
3. `03_endpoint_GET_me_credits.xs`
4. `04_endpoint_POST_ai_generate_listing.xs`
5. `05_endpoint_GET_dashboard_drafts_id.xs`
6. `06_endpoint_PATCH_dashboard_drafts_id.xs`
7. `07_endpoint_POST_dashboard_drafts_id_publish.xs`

Переменные Xano:

```text
OPENAI_API_KEY=sk-...
OPENAI_BEARER_TOKEN=Bearer sk-...
OPENAI_CAR_AI_MODEL=gpt-5.4-mini
OPENAI_CAR_AI_FALLBACK_MODEL=gpt-5.5
AI_MAX_PHOTOS=4
AI_MAX_PHOTO_BYTES=8388608
AI_DAILY_LIMIT_PRIVATE=5
AI_MONTHLY_LIMIT_PRIVATE=30
AI_MIN_CONFIDENCE=0.72
```

Frontend уже готов:

- `/dashboard/new/` отправляет `POST /ai/generate-listing`
- после генерации открывает `/dashboard/drafts/{id}`
- страница черновика вызывает:
  - `GET /dashboard/drafts/{id}`
  - `PATCH /dashboard/drafts/{id}`
  - `POST /dashboard/drafts/{id}/publish`

Если Xano ругается на `car_listings`, а твоя таблица называется `cars`, замени `car_listings` на `cars`.

Если Xano ругается на `car_listing_images`, а твоя таблица называется `car_images`, замени `car_listing_images` на `car_images`.

