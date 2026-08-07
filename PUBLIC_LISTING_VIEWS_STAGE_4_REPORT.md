# Public Listing Views Stage 4 Report

Дата завершения: 29 июля 2026

## 1. Результат

Публичный общий счётчик просмотров добавлен в SSR-контракт автомобилей и отображается:

- на `/cars`;
- на карточках главной страницы;
- на `/cars/[slug]`.

Карточки с 0-4 просмотрами показывают `Новое`, с 5 и более — компактное реальное число. Детальная страница показывает точное число с корректной русской формой слова. Владелец по-прежнему получает расширенную аналитику только в закрытом кабинете.

## 2. Backend

Изменены два существующих публичных Xano endpoint:

- `3966698` — GET `/cars`;
- `3966699` — GET `/cars/{slug}`.

`GET /cars` сначала получает ID публичных автомобилей, затем одним запросом читает `listing_views` и считает значения в памяти. Запросов к `listing_views` внутри цикла карточек нет, поэтому N+1 не создан.

`GET /cars/{slug}` выполняет один агрегирующий запрос для конкретного автомобиля. Оба endpoint возвращают только безопасное поле:

```json
{ "views_total": 7 }
```

При временной ошибке таблицы просмотров используется fail-soft значение `0`; публичная выдача автомобиля не падает.

Endpoint `3999920` `/cars/{slug}/related` не менялся. Счётчик намеренно скрыт в компактных блоках похожих автомобилей и объявлений продавца.

## 3. Privacy

Публичные ответы не содержат:

- `views_unique`;
- `views_7d`;
- `last_viewed_at`;
- `session_id`;
- `user_id`;
- источник трафика и сырые строки `listing_views`.

Публичное чтение не требует токена и не раскрывает владельца или посетителей.

## 4. Frontend

Добавлен общий helper `src/lib/listingViews.ts` для:

- безопасной нормализации `null`, отрицательных и нечисловых значений;
- русских форм `просмотр / просмотра / просмотров`;
- компактного формата больших чисел;
- порога `Новое` для 0-4 просмотров.

`normalizePublicCarListing` теперь сохраняет `views_total`, поэтому SSR не теряет backend-значение. Shared renderer карточки используется каталогом и главной страницей. Метаданные являются вторичным неинтерактивным текстом с `aria-label`; кнопка из счётчика не создавалась.

Lucide `Eye` добавлен в клиентский набор иконок. После финальной публикации предупреждения о неизвестной иконке исчезли.

## 5. Изменённые файлы

- `docs/xano-endpoint-get-cars.xs`;
- `docs/xano-endpoint-get-cars-slug.xs`;
- `src/lib/listingViews.ts`;
- `src/lib/publicCar.ts`;
- `src/lib/publicCarCard.ts`;
- `src/lib/publicCarCardsClient.ts`;
- `src/pages/cars/[slug].astro`;
- `src/styles/global.css`;
- `tests/public-listing-views.test.ts`.

## 6. Regression Tests

Покрыты:

- безопасная нормализация;
- правильные русские формы;
- компактные значения 999, 1000, 1200 и 1 000 000;
- отображение `Новое` и реального числа;
- сохранение `views_total` после API-нормализации;
- доступность и отсутствие интерактивной кнопки;
- разные значения у разных карточек;
- скрытие в related/seller блоках;
- отсутствие N+1 в XanoScript;
- fail-soft fallback;
- отсутствие приватных полей;
- SSR на главной, в каталоге и детали;
- отсутствие отдельного frontend-запроса просмотров на каждую карточку;
- наличие `Eye` в Lucide-наборе.

Итог:

- `npm run check` — успешно, 204 файла, 0 ошибок, 0 предупреждений;
- `npm test` — успешно, 301/301;
- `npm run build` — успешно;
- `npm run test:http:production` — успешно без пользовательского токена.

## 7. Production E2E

После публикации Xano:

- ID `95`, `mercedes-benz-vito-2006-74` — API `views_total: 3`, карточка показывает `Новое`;
- ID `94`, `bmw-520-2004-73` — API `views_total: 7`, карточка показывает `7`, детальная страница — `7 просмотров`.

Значение BMW увеличилось с 6 до 7 во время реальной browser-проверки детальной страницы, что подтверждает связь публичного отображения с действующей системой учёта.

Проверены:

- desktop 1440x1000;
- tablet 768x1024;
- mobile 390x844;
- mobile 360x800.

На всех ширинах карточки и счётчики не имеют внутреннего или горизонтального переполнения. На production-детали BMW заголовок, 7 изображений и счётчик отобразились. После финального deploy ошибок и предупреждений в консоли нет.

## 8. Backups

Локальные целевые копии до изменений:

`/Users/david/Documents/Codex/2026-06-27/first-install-this-skill-npx-skills/sitecraft-auto-market/.backups/public-listing-views-stage-4/`

Live Xano до публикации:

`/Users/david/.codex/audits/sitecraft-auto-market/public-listing-views-stage-4-live-before-2026-07-29-02/`

Live Xano после публикации:

`/Users/david/.codex/audits/sitecraft-auto-market/public-listing-views-stage-4-live-after-2026-07-29-01/`

Минимальный Xano push-пакет:

`/Users/david/.codex/audits/sitecraft-auto-market/public-listing-views-stage-4-push-2026-07-29-01/`

## 9. Deployment

Использован существующий Cloudflare Pages project `sitecraft-auto-market`.

- финальный deployment ID: `74ef6960`;
- deployment URL: `https://74ef6960.sitecraft-auto-market.pages.dev`;
- production: `https://automarket.sitecraft.agency`.

Новые проекты, домены, Workers, ветки и pull request не создавались. Git-команды не использовались.

## 10. Rollback

Frontend rollback: повторно развернуть предыдущий проверенный `dist/client` или восстановить перечисленные файлы из локальной backup-папки и собрать Pages bundle.

Xano rollback: восстановить endpoint `3966698` и `3966699` из live-before backup, выполнить dry-run для этих двух документов и опубликовать только их. Таблица `listing_views` и данные просмотров этой задачей не изменялись.
