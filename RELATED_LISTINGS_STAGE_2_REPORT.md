# Этап 2: ограниченный endpoint похожих автомобилей

Дата реализации и публикации: 28 июля 2026 года.

## Результат

Карточка автомобиля больше не загружает полный публичный каталог для блока «Похожие автомобили». Она использует отдельный публичный endpoint:

```text
GET /cars/{slug}/related
Xano endpoint ID: 3999920
```

Endpoint опубликован в существующей production API-группе `sitecraft-auto-market` и не требует авторизации.

## Серверная логика

- Основная карточка проверяется по slug и должна быть публичной; проданная публичная карточка допустима как исходная.
- Кандидаты выбираются ограниченными запросами по приоритету: марка, кузов, топливо, город, затем свежие активные объявления.
- Каждый запрос возвращает не более шести строк.
- Общий ответ содержит максимум шесть уникальных машин.
- Текущая машина и объявления того же продавца исключаются.
- Проданные, черновые, отклоненные, заблокированные, удаленные и архивные кандидаты исключаются.
- Ответ содержит только поля публичной карточки; `user_id`, контакты, VIN, private status и moderation/admin-поля не возвращаются.

## Обнаруженная и исправленная ошибка Xano

Первая версия endpoint возвращала `400 ERROR_CODE_INPUT_ERROR` из-за runtime-фильтра `trim`, использованного внутри сравнений полей кандидатов. Фильтр удален из этих выражений; path-параметр остается типизированным как `text`, а сравнения выполняются напрямую. Финальный endpoint возвращает `200`.

## Frontend

- В `API_ROUTES` добавлен `carRelatedListings(slug)`.
- Добавлен `getRelatedListingsBySlug(slug)` с существующим timeout/error contract.
- Projection нормализуется общим ограниченным public-card helper и повторно обрезается до шести записей.
- `src/pages/cars/[slug].astro` использует `getRelatedListingsBySlug` вместо `getApprovedCars`.
- Related и seller requests остаются вторичными через `Promise.allSettled`; их ошибка не скрывает основную карточку.
- Финальный UI дополнительно ранжирует кандидатов по реальным совпадениям и показывает максимум шесть карточек.

## Измененные файлы

- `src/lib/apiRoutes.ts`
- `src/lib/xano.ts`
- `src/pages/cars/[slug].astro`
- `docs/xano-endpoint-get-cars-slug-related.xs`
- `docs/release/XANO_PRODUCTION_ENDPOINT_IDS.md`
- `tests/public-car-on-demand.test.ts`
- `tests/related-listings-endpoint.test.ts`
- `RELATED_LISTINGS_STAGE_2_REPORT.md`

Список составлен вручную без Git.

## Проверки

- `npm run check`: успешно, 0 ошибок, 0 предупреждений.
- `npm test`: успешно, 266/266 тестов.
- `npm run build`: успешно, Advanced Mode Worker собран.
- Focused tests: 18/18 успешно.
- Xano smoke: `200`, 6 записей, все ID уникальны, текущий slug отсутствует, forbidden keys отсутствуют.
- Неизвестный slug: `404`.
- Локальный Cloudflare runtime: карточка `200`, SSR related section присутствует, три реально релевантные уникальные карточки отображены.

## Production QA

Проверенная карточка:

`https://automarket.sitecraft.agency/cars/mercedes-benz-a-170-2008-49`

Результат:

- status `200`;
- canonical и H1 сохранены;
- описание и `Vehicle` JSON-LD сохранены;
- edge cache сохранен (`s-maxage=300`);
- related section находится в исходном SSR HTML;
- отображены 3 релевантные уникальные карточки;
- placeholder API URL отсутствует.

Cloudflare Pages deployment:

- project: `sitecraft-auto-market`;
- deployment ID: `fccacad2-6716-4e6f-8b46-7fbb78a591f2`;
- deployment URL: `https://fccacad2.sitecraft-auto-market.pages.dev`.

## Резервные копии и rollback

Backups:

`/Users/david/Documents/Codex/2026-06-27/first-install-this-skill-npx-skills/sitecraft-auto-market/.backups/related-listings-stage-2/`

Rollback:

1. Восстановить три frontend-файла из backup и пересобрать Pages bundle.
2. Повторно опубликовать предыдущий Pages deployment `2c458dc7-f399-4c49-b60f-bd4bcae46258` либо восстановленный bundle.
3. Удалить только новый Xano endpoint ID `3999920` через Metadata API.
4. Существующие `/cars`, `/cars/{slug}` и `/cars/{slug}/seller-listings` не изменялись и rollback не требуют.

## Следующий этап

Создать индексируемые SSR-страницы марок и моделей с нормализованными slug, уникальными метаданными, sitemap и canonical. После этого добавить независимые HTTP integration-тесты для локального Cloudflare runtime и production smoke без пользовательских токенов.
