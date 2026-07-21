# Xano Backend Audit

## Критические правила

1. Все защищенные endpoints должны использовать auth object `automarket_users`.
2. Admin endpoints не должны проверять `$auth.role` напрямую. В Xano auth token часто содержит только `id`, поэтому условие `$auth.role == "admin"` падает с ошибкой `Unable to locate auth: role`.
3. Для проверки администратора нужно:
   - получить пользователя из `automarket_users` по `$auth.id`;
   - проверить `role == "admin"` или email из owner-list;
   - только потом выполнять approve, reject, delete, sold, archive, block, restore.
4. Основной источник изображений в таблицах `car_listing_images` и `car_draft_images` — поля `image_url`, `image_metadata`, `mime_type`, `original_filename`, `size_bytes`.
5. Не записывать объект в колонку `image`, если колонка Xano image/file не принимает текущий формат. Это уже вызывало ошибку `Param: image - Value is not properly formed`.
6. Старый `POST /ai/generate-listing` нельзя использовать как основной AI-поток, если он создает `car_listings` со статусом `pending_review` без подтверждения пользователя. Frontend держит legacy fallback выключенным через `PUBLIC_ALLOW_LEGACY_AI_GENERATE=false`.

## Endpoints, которые frontend использует сейчас

- `GET /auth/me`
- `POST /auth/login`
- `POST /auth/register`
- `GET /oauth/google/init`
- `POST /oauth/google/continue`
- `GET /cars`
- `GET /cars/{slug}`
- `POST /cars`
- `PATCH /cars/{id}/submit`
- `GET /dashboard/listings`
- `PATCH /dashboard/listings/{id}/delete`
- `PATCH /dashboard/listings/{id}`
- `GET /me/credits`
- `POST /ai/generate-listing`
- `GET /admin/moderation`
- `PATCH /admin/cars/{id}/approve`
- `PATCH /admin/cars/{id}/reject`
- `PATCH /admin/cars/{id}/delete`
- `PATCH /admin/cars/{id}/sold`
- `PATCH /admin/cars/{id}/assign-owner`

## Endpoints, которые нужно добавить или проверить в Xano

- `GET /dashboard/listings/{id}`
- `POST /ai/listing/analyze-photos`
- `POST /ai/listing/generate-description`
- `POST /ai/listing/quality-score`
- `POST /listings/create-draft`
- `POST /listings/submit-moderation`
- `POST /purchases/create`
- `POST /purchases/apply`
- `GET /me/purchases`
- `PATCH /admin/cars/{id}/archive`
- `PATCH /admin/cars/{id}/block`
- `PATCH /admin/cars/{id}/restore`
- `PATCH /admin/cars/{id}/images/{imageId}/delete`
- `PATCH /admin/cars/{id}/images/{imageId}/primary`

## Dashboard listings: live owner contract

- `GET /dashboard/listings` — endpoint ID 3968100, auth `automarket_users`. Возвращает только объявления текущего пользователя и поле `thumbnail_url`. Основное активное изображение выбирается по приоритету `is_main`, затем `is_primary`, затем минимальный `sort_order`/`id`; `is_deleted == true` исключается. Pending-объявление и его фото доступны владельцу, но не публичным `/cars` и `/cars/{slug}`.
- `PATCH /dashboard/listings/{id}/delete` — endpoint ID 3983598, auth `automarket_users`. Owner condition входит в lookup; чужой и отсутствующий ID дают одинаковый 404. Удаление идемпотентное и мягкое: меняются только `car_listings.status = deleted` и `updated_at`. Blocked возвращает 403. Строки `car_listing_images`, R2-объекты, drafts, credits и AI-записи не удаляются.
- Seller frontend не вызывает admin delete fallback. Отсутствующая или небезопасная картинка заменяется локальным placeholder.

## AI flow

AI не должен сразу публиковать объявление. Правильный поток:

1. Пользователь загружает фото.
2. R2 сохраняет изображения и возвращает публичные `image_url`.
3. Xano `POST /ai/listing/analyze-photos` создает `ai_draft`.
4. Пользователь подтверждает или редактирует поля.
5. Xano `POST /listings/create-draft` создает обычный черновик.
6. Xano `POST /listings/submit-moderation` переводит объявление в `pending_review`.
7. Модератор публикует через admin endpoint.

Если Xano пока имеет только `POST /ai/generate-listing`, его нужно переписать в один из двух безопасных вариантов:

- вернуть только `ai_draft`/`draft_id`, `detected_fields`, `confidence`, `missing_fields`, `warnings`, `suggested_description`;
- или оставить endpoint отключенным на frontend и добавить новые endpoints из списка выше.

## Free credits

Для новых пользователей нужно выдавать стартовые AI credits при регистрации:

- `user_credits.user_id = new_user.id`
- `ai_credits_balance = 3` или другое стартовое значение
- транзакция в `credit_transactions` с типом `free_grant`

Owner/admin аккаунты:

- `ivanovdavid119@gmail.com`
- `ivanovdavid19@gmail.com`

Для них можно использовать `is_unlimited_ai = true` или большой баланс, например `999999`.

## PayPal

Пока frontend готов к покупке кредитов через:

- `POST /purchases/create`
- `POST /purchases/apply`
- `GET /me/purchases`

Эти endpoints должны создавать заказ, хранить PayPal order id и начислять кредиты только после подтвержденного платежа.
