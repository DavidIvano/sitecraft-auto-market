# Cloudflare R2 image storage

Новый flow для новых объявлений:

1. Браузер сжимает выбранные фото и конвертирует их в WebP.
2. Браузер отправляет WebP-файлы на `POST /api/upload-listing-images`.
3. Cloudflare Pages Function проверяет токен пользователя через `GET /auth/me`.
4. Function загружает файлы в Cloudflare R2 bucket `car-images`.
5. Function возвращает массив `{ url, key, contentType, size }`.
6. Форма объявления отправляет в Xano только ссылки и ключи:
   - `main_image_url`
   - `cover_image_url`
   - `image_urls`
   - `image_keys`
   - `r2_images`

## Cloudflare setup

Сейчас R2 должен быть включён в Cloudflare Dashboard. Если Wrangler показывает:

```txt
Please enable R2 through the Cloudflare Dashboard. [code: 10042]
```

открой Cloudflare Dashboard -> R2 Object Storage и включи R2 для аккаунта.

Создать R2 bucket:

```txt
car-images
```

Рекомендуемый URL для картинок через приватный Pages proxy:

```txt
https://sitecraft-auto-market.pages.dev/api/r2-images
```

Так bucket может оставаться закрытым: сайт отдаёт картинки через endpoint
`GET /api/r2-images/{key}`.

В Cloudflare Pages добавить R2 binding:

```txt
Binding name: R2_BUCKET
Bucket: car-images
```

В Cloudflare Pages Environment variables добавить:

```txt
R2_PUBLIC_BASE_URL=https://sitecraft-auto-market.pages.dev/api/r2-images
XANO_API_URL=https://x8ki-letl-twmt.n7.xano.io/api:jAAj839u
ALLOWED_UPLOAD_ORIGINS=https://sitecraft-auto-market.pages.dev
ENVIRONMENT=production
```

`PUBLIC_XANO_API_URL` поддерживается серверной функцией только как временный backwards-compatible fallback.
`R2_BUCKET` — имя runtime binding. `R2_BUCKET_NAME` приложением не читается.

Для preview-проверки добавь точный preview origin в `ALLOWED_UPLOAD_ORIGINS`. Wildcard для `*.pages.dev` не используется.
Для локального development environment разрешены `localhost` и `127.0.0.1` на портах 4321/4322. Опубликованную Pages Function можно использовать только если этот точный local origin временно добавлен в серверный allowlist:

```txt
PUBLIC_IMAGE_UPLOAD_URL=https://sitecraft-auto-market.pages.dev/api/upload-listing-images
```

Важно для проверки: `functions/api/upload-listing-images.ts` — это Cloudflare Pages Function. В обычном `astro dev`
локальный путь `/api/upload-listing-images` может отдавать `404`, потому что Astro не поднимает Cloudflare bindings.
Проверять upload нужно через Cloudflare Pages preview или Wrangler/Pages runtime с подключённым `R2_BUCKET`.

## R2 key structure

Файлы сохраняются с подтверждённым через Xano user ID:

```txt
listing-images/{authenticated_user_id}/{yyyy}/{mm}/{uuid}.{safe-extension}
```

## Limits

- от 1 до 8 файлов на upload endpoint;
- JPEG, PNG, WebP или AVIF; frontend отправляет сжатый WebP;
- максимум 1 MB на файл и 8 MB на batch;
- SVG, GIF, пустые и не-image файлы запрещены.

## TODO

- После обновления Xano endpoint можно добавить отдельную задачу очистки R2-файлов по `image.key` при удалении объявления.
- Если нужно физически переносить файлы из `cars/temp` в `cars/{listingId}`, это лучше сделать отдельным backend endpoint после создания объявления.
