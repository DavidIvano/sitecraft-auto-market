# Seller UX, Resilience, Views — Stage 3

Дата: 28 июля 2026

## Итог

Локальная реализация завершена, шесть Xano endpoint-патчей и два индекса опубликованы в live, а проверенная Cloudflare-сборка опубликована в существующий Pages project `sitecraft-auto-market`.

Production HTTP smoke после deploy проходит полностью, включая `/cars/brand/audi`, который ранее возвращал `503`. Публичный runtime и backend-дедупликация просмотров подтверждены. Авторизованный contact/TUV browser E2E не считается пройденным: Chrome Extension передал вкладку один раз, но затем неоднократно терял соединение при чтении страницы.

## Обнаруженные проблемы

| Приоритет | Страница / файл | Endpoint | Причина и воспроизведение | Исправление |
|---|---|---|---|---|
| High | Глобальная навигация, dashboard, `Header.astro`, `BaseLayout.astro` | — | На одном viewport конкурировали CTA «Продать авто», «Добавить авто» и «Добавить объявление». | Один canonical route `/dashboard/new`, единое название «Продать авто», responsive-правила исключают дубли. |
| High | `/dashboard/new`, `new.astro` | create draft / submit moderation | Manual и AI выглядели как два больших независимых процесса; было несколько конкурирующих действий. | Единый workflow «Фото → Данные → Проверка», AI открывается как помощник, одна основная отправка. |
| High | `/dashboard`, `ContactProfileForm.astro` | GET/PATCH `/me/contact-profile` (`3997837`, `3997838`) | Инициализация зависела от наличия токена в первый момент исполнения; временная ошибка могла выглядеть как потеря входа. | Submit подключён всегда, auth ожидается, GET имеет bounded retry, PATCH не повторяется автоматически, logout только после подтверждённого `401`. |
| High | Главная, каталог и кабинет | публичные и owner GET | Временный network/429/5xx мог оставить loader или пустой блок; параллельные одинаковые запросы дублировались. | Общий `fetchWithRetry`, timeout, jitter, `Retry-After`, in-flight GET dedupe, stale cache и ручной retry. |
| High | `/cars/[slug]`, `/dashboard/listings` | POST `/analytics/listing-view` (`3981281`), GET `/dashboard/listings` (`3968100`) | Событие отправлялось без требуемой 2-секундной видимости и без 24-часового клиентского ограничения; dashboard не возвращал статистику. | Видимость 2 секунды, preview skip, keepalive, browser guard, Xano 24-hour dedupe и owner projection подготовлены локально. |
| Critical | Создание, AI draft, edit, moderation | `3982637`, `3982675`, `3969714` | При `has_valid_tuv=false` могла сохраняться старая дата и backend-валидация могла продолжать требовать месяц. | Строгий nullable boolean; дата существует только при `true`, при `false` очищается в DOM, local draft, payload и подготовленных XanoScript. |

Первопричина production `503`: последовательные public GET к Xano Free tier получали `429` на пятом-шестом запросе, а brand SSR route преобразовывал недоступность зависимости в `503`. `src/lib/xano.ts` теперь использует bounded retry с `Retry-After`, timeout и in-flight dedupe. После deploy brand/model SSR smoke возвращает `200`.

## Изменённые файлы

Frontend и библиотеки:

- `src/components/Header.astro`
- `src/components/dashboard/ContactProfileForm.astro`
- `src/layouts/BaseLayout.astro`
- `src/lib/contactProfile.ts`
- `src/lib/dashboardListings.ts`
- `src/lib/http/fetchWithRetry.ts`
- `src/lib/listingFields.ts`
- `src/lib/types.ts`
- `src/lib/validation/listingValidation.ts`
- `src/pages/index.astro`
- `src/pages/cars/index.astro`
- `src/pages/cars/[slug].astro`
- `src/pages/dashboard/index.astro`
- `src/pages/dashboard/listings.astro`
- `src/pages/dashboard/listings/edit.astro`
- `src/pages/dashboard/new.astro`
- `src/styles/global.css`

Подготовленные локальные XanoScript:

- `docs/xano/public-favorites-contacts/endpoints.xs`
- `docs/xano-endpoint-get-dashboard-listings.xs`
- `docs/xano-endpoint-patch-dashboard-listing.xs`
- `docs/xano-endpoint-post-analytics-listing-view.xs`
- `docs/xano-endpoint-post-listings-create-draft.xs`
- `docs/xano-endpoint-post-listings-submit-moderation.xs`

Тесты:

- `tests/contact-profile.test.ts`
- `tests/fetch-with-retry.test.ts`
- `tests/listing-views.test.ts`
- `tests/seller-workflow-stage-3.test.ts`
- `tests/listing-fields.test.ts`
- `tests/ai-draft-submission.test.ts`
- `tests/dashboard-listings.test.ts`
- `tests/deal-finder.test.ts`
- `tests/promotions.test.ts`

## Xano

В live workspace `115940`, branch `v1`, опубликованы изменения существующих endpoint:

| ID | Method / route | Локальное изменение |
|---|---|---|
| `3997838` | PATCH `/me/contact-profile` | Проверка, что preferred phone/email действительно заполнен и публичен. |
| `3968100` | GET `/dashboard/listings` | Owner-only `views_total`, `views_unique`, `views_7d`, `last_viewed_at`; TÜV-поля. |
| `3981281` | POST `/analytics/listing-view` | Public listing check, canonical car ID, 24-hour session dedupe, без raw IP/UA/PII. |
| `3982637` | POST `/listings/create-draft` | `tuv_valid_until=null`, если TÜV не подтверждён как `true`. |
| `3982675` | POST `/listings/submit-moderation` | При `false` дата очищается и не валидируется. |
| `3969714` | PATCH `/dashboard/listings/{id}` | Единая bool/month-нормализация при edit. |

Новых endpoint и таблиц не создавалось. Используется существующая таблица `listing_views` (`866168`). Добавлены индексы `(slug, session_id, created_at desc)` и `(car_id, created_at desc)`.

Runtime-проверка: первое событие для публичного slug создало `view_id=84`; повтор той же browser-session вернул `deduped=true`; неизвестное объявление вернуло `404`. Raw IP, email, телефон и полный user-agent не сохраняются.

Ограничение: публичный Xano endpoint возвращает `403`, если XanoScript даже условно обращается к `$auth.id` без токена. Поэтому owner exclusion нельзя безопасно реализовать в текущем public endpoint через optional auth. Эта ветка удалена из live; следующий этап должен использовать нативный optional-auth механизм Xano или отдельный защищённый endpoint.

## Интерфейс

- Глобальный seller CTA унифицирован как «Продать авто» и ведёт на `/dashboard/new`.
- На desktop и mobile responsive-правила не показывают одновременно одинаковые акцентные CTA в header/sidebar/workspace.
- В dashboard сохранено одно главное действие «Добавить объявление».
- Карточка объявления имеет одно status-dependent действие: «Продолжить», «Исправить» или «Посмотреть».
- Редактирование, продвижение и удаление перенесены в `•••`; меню поддерживает mouse, touch, keyboard, Escape, `aria-expanded` и возврат фокуса.
- Публикация состоит из трёх шагов. AI является помощником; результат описания имеет «Применить» и «Отмена», остальные действия скрыты в «Другие AI-действия».
- Локальный safe draft имеет TTL 7 дней. Токен, бинарные файлы, полный VIN и долговременные приватные контакты не сохраняются.
- Дополнительные поля пока оставлены видимыми, поскольку действующий backend-контракт всё ещё требует часть из них. Скрывать их до согласованного ослабления Xano validation небезопасно.

## Retry

`src/lib/http/fetchWithRetry.ts` применяется к GET-блокам главной, каталога, dashboard, owner listings, edit и contact profile.

- Попытка 1: сразу.
- Попытка 2: около 1 секунды с 10% jitter.
- Попытка 3: около 3 секунд с 10% jitter.
- Timeout каждой попытки: 10 секунд.
- Повторяются network error, timeout, `408`, `425`, `429`, `5xx`.
- Учитывается `Retry-After`.
- `400`, `401`, `403`, `404`, `409`, `422` автоматически не повторяются.
- Одинаковые одновременные GET объединяются; mutations не объединяются и PATCH контактов не повторяется.
- При ошибке сохраняется последняя user-scoped версия, loader завершается, доступна кнопка «Повторить» и один retry после события `online`.

## Контакты

Корневая причина: auth token читался слишком рано, поэтому форма могла остаться неинициализированной даже после завершения входа. Теперь форма ждёт токен ограниченное время, получает его непосредственно перед GET/PATCH и различает истёкшую сессию от временной ошибки API.

Локальные contract-тесты покрывают валидность публичного phone/email, preferred method, ожидание auth, retry GET и запрет retry PATCH. Live endpoint скомпилирован и опубликован. Авторизованный production test с изменением, reload и проверкой публичной карточки не выполнен из-за обрыва Chrome Extension, поэтому контакты не считаются browser E2E-подтверждёнными.

## TÜV/HU

Frontend:

- `true` показывает и требует `YYYY-MM` текущего/будущего месяца;
- `false` скрывает, disables и очищает дату и field error;
- `null` даёт ошибку только переключателю;
- восстановление local/AI draft не возвращает старую дату при `false`;
- edit использует тот же контракт.

Backend XanoScript:

```text
if has_valid_tuv == true:
  validate tuv_valid_until
else:
  tuv_valid_until = null
```

Все девять локальных matrix-сценариев проходят, включая `false + stale AI date` и edit false. Live Xano rollout выполнен. Реальное авторизованное создание тестового объявления без TÜV не выполнялось из-за обрыва Chrome Extension, поэтому этот browser E2E остаётся обязательным.

## Просмотры

- Public detail ждёт 2 секунды видимости.
- Cloudflare preview не отправляет событие.
- Отправка использует `fetch(..., {keepalive:true})` и не блокирует карточку.
- Browser session ограничивает повтор на 24 часа; Xano остаётся источником истины и также дедуплицирует 24 часа.
- Dashboard endpoint возвращает owner-only total, unique, 7-day count и last viewed timestamp.
- Первый public view и repeat той же session подтверждены в live runtime. Owner exclusion не поддерживается до отдельного optional-auth решения и не выдаётся за выполненный результат.

## Проверки

| Команда | Результат |
|---|---|
| `npm install` | exit `0`, vulnerabilities `0` |
| `npm run check` | exit `0`, 202 files, 0 errors/warnings/hints |
| `npm test` | exit `0`, 290 passed, 0 failed |
| `npm run build` | exit `0`, Cloudflare Advanced Mode Worker compiled |
| `npm run test:http:local` | exit `0`, sitemap/catalog/brand/model/detail/not-found проверены без токена |
| `npm run test:http:production` | exit `0` после deploy: sitemap/catalog/brand/model/detail/not-found |
| dist secret scan | `.env`, `.dev.vars`, key files и известные secret names не найдены |

SSR, sitemap, brand/model routes и public detail прошли локальный Cloudflare HTTP integration test.

## Публикация

Публикация выполнена только в существующий project.

- Cloudflare project: `sitecraft-auto-market`.
- Production URL: `https://automarket.sitecraft.agency`.
- Deployment ID: `5c0979ca`.
- Deployment URL: `https://5c0979ca.sitecraft-auto-market.pages.dev`.
- Production public smoke: passed без пользовательского токена.

Оставшийся QA blocker: ChatGPT Chrome Extension видит открытую авторизованную вкладку, но после успешного claim теряет соединение при DOM-read. Поэтому contact/TUV и owner dashboard browser E2E не помечены как passed.

## Резервная копия и rollback

Backup:

`/Users/david/Documents/Codex/2026-06-27/first-install-this-skill-npx-skills/sitecraft-auto-market/.backups/seller-ux-resilience-views-stage-3/`

Для rollback восстановить перечисленные файлы из этой папки и удалить новые файлы:

- `src/lib/contactProfile.ts`
- `src/lib/http/fetchWithRetry.ts`
- `tests/contact-profile.test.ts`
- `tests/fetch-with-retry.test.ts`
- `tests/listing-views.test.ts`
- `tests/seller-workflow-stage-3.test.ts`

Xano live backups и rollback-источники:

- `/Users/david/.codex/audits/sitecraft-auto-market/xano-stage3-live-before-2026-07-28`
- `/Users/david/.codex/audits/sitecraft-auto-market/xano-stage3-live-after-final-2026-07-28`

Frontend rollback: повторно развернуть предыдущий Pages deployment из Cloudflare dashboard. Xano rollback: применить сохранённые pre-change endpoint/table definitions из live-before backup.

## Следующий безопасный шаг

1. Переустановить/переподключить ChatGPT Chrome Extension и выполнить contact/TÜV/dashboard browser E2E на тестовом объявлении.
2. Реализовать owner exclusion через нативный optional-auth Xano или отдельный защищённый analytics endpoint.
3. Повторить browser QA на desktop, 768, 390 и 360 px; публичный HTTP runtime уже подтверждён.
