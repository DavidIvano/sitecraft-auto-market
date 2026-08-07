# Listing Views Completion Report

Дата проверки: 2026-07-29. Production: `https://automarket.sitecraft.agency`.

## Текущая реализация

- `POST /analytics/listing-view`, Xano endpoint `3981281`: публичная запись анонимного просмотра.
- `GET /dashboard/listings`, Xano endpoint `3968100`: объявления и статистика только текущего владельца.
- `POST /me/analytics/listing-view`: новый защищённый маршрут исключения просмотров владельца. Live GUID: `R1ugWRRDEbyGGfjhZL2yzC9nZj0`; Xano CLI multidoc не вернул числовой ID, поэтому он не выдумывался в отчёте.
- Таблица `listing_views`, ID `866168`.
- Live-индексы подтверждены до изменений: `(slug, session_id, created_at desc)` и `(car_id, created_at desc)`. Дубли не создавались.
- Backend-дедупликация: `car_id + session_id + rolling 24 hours`.

## Обнаруженные проблемы

1. Публичная карточка всегда вызывала публичный analytics endpoint, поэтому сервер не мог исключить владельца.
2. Dashboard выполнял три запроса `listing_views` для каждой машины, создавая view N+1.
3. Dashboard не показывал время последнего просмотра, а числа не имели единой безопасной нормализации и русского склонения.
4. Client guard не завершал цикл после полученного HTTP-ответа, поэтому повторное событие видимости могло инициировать новый запрос после ошибки.
5. Первая строгая проверка публичности Xano компилировалась, но на конфликте `approved + pending_review` возвращала `500 SQL Error: 7`. Она заменена последовательной server-side нормализацией; live повторный тест возвращает безопасный `404`.
6. Xano CLI игнорировал новые документы с комментариями до объявления `query`. Публикуемые `.xs` приведены к распознаваемому формату.

## Изменения frontend

- `src/pages/cars/[slug].astro`: правильные `car_id` и `slug`, стабильный anonymous session ID, ожидание двух секунд видимой вкладки, пропуск preview deployment, client guard, максимум один повтор только при network error, `keepalive`, нефатальная аналитика.
- При наличии auth token используется `/me/analytics/listing-view`; без токена используется `/analytics/listing-view`. Analytics `401` не перенаправляет посетителя на login.
- `src/lib/apiRoutes.ts`: добавлен защищённый analytics route.
- `src/lib/dashboardListings.ts`: добавлены `normalizeViewCount`, `formatViewCount`, `formatLastViewedAt` и поля статистики.
- `src/pages/dashboard/listings.astro`: карточка показывает total, 7 дней и последнюю дату с иконкой просмотра.
- `src/styles/global.css`: компактный flex-wrap layout; последняя дата переносится отдельной строкой и не выходит за мобильную ширину.

## Изменения Xano

- `3981281`: проверяет существование и публичность автомобиля, дедуплицирует по `car_id + session_id + 24h`, возвращает `counted`, не хранит raw IP, PII, token или полный user-agent.
- Новый `/me/analytics/listing-view`: требует `automarket_users`; при `car.user_id == $auth.id` возвращает `owner_view: true, counted: false`, иначе использует ту же дедупликацию.
- `3968100`: один запрос получает все просмотры принадлежащих пользователю car ID; внутри списка считаются отдельные `total`, `unique`, `7d`, `last_viewed_at`. Запросов `listing_views` внутри car loop нет.
- Изображения dashboard не менялись функционально; существующий image lookup остаётся отдельным от устранённого view N+1.

Изменённые XanoScript:

- `docs/xano-endpoint-post-analytics-listing-view.xs`
- `docs/xano-endpoint-post-me-analytics-listing-view.xs`
- `docs/xano-endpoint-get-dashboard-listings.xs`

## Резервные копии

- До изменений: `/Users/david/.codex/audits/sitecraft-auto-market/xano-listing-views-before-2026-07-29-01`
- После публикации endpoint: `/Users/david/.codex/audits/sitecraft-auto-market/xano-listing-views-after-2026-07-29-01`
- E2E records до: `/Users/david/.codex/audits/sitecraft-auto-market/xano-listing-views-e2e-before-2026-07-29-01`
- E2E records после: `/Users/david/.codex/audits/sitecraft-auto-market/xano-listing-views-e2e-after-2026-07-29-01`
- Минимальный publish batch: `/Users/david/.codex/audits/sitecraft-auto-market/xano-listing-views-final-push-2026-07-29-01`

Эти папки находятся вне репозитория и содержат production-данные; их нельзя публиковать.

## Тесты

- `npm install`: exit `0`, уязвимостей `0`.
- `npm run check`: exit `0`, 202 файла, ошибок/предупреждений `0`.
- `npm test`: exit `0`, `293 passed`, `0 failed`.
- `npm run build`: exit `0`, Cloudflare Advanced Mode Worker собран.
- Local Cloudflare runtime: `/cars/bmw-520-2004-73/` → `200`; `/dashboard/listings/` → `200`.
- Local public HTTP integration: успешно.
- Production public HTTP integration: успешно.

Контрактные тесты проверяют source-контракты и не выдаются за browser E2E.

## Production E2E

Фактически выполненный live API/records сценарий:

| Машина | До total/unique/7d | Session (masked) | Первый POST | Повтор | После total/unique/7d |
|---|---:|---|---|---|---:|
| A, ID 95 | 2 / 2 / 2 | `qa-a-…7f31` | `counted=true`, row `86` | `deduped=true`, `counted=false` | 3 / 3 / 3 |
| B, ID 94 | 5 / 4 / 5 | `qa-b-…2c84` | `counted=true`, row `87` | не требовался | 6 / 5 / 6 |

Результаты подтверждают, что A и B увеличиваются независимо, а повтор A не создаёт вторую строку. Неизвестный slug и непубличная конфликтная запись возвращают `404`. Защищённый маршрут без token возвращает `401`.

### Незакрытая проверка

Авторизованный owner browser E2E не подтверждён. Управляемая Chrome-вкладка и встроенный браузер несколько раз теряли соединение до чтения dashboard. Поэтому отчёт не заявляет, что в этом прогоне визуально подтверждены:

- отображение новых чисел в авторизованном `/dashboard/listings`;
- `owner_view: true` из реальной Google-сессии;
- отсутствие увеличения счётчика после открытия владельцем собственной карточки.

Backend-контракт owner exclusion опубликован и покрыт тестом, но это не замена реальному browser E2E. Definition of Done по этому одному пункту остаётся частично незакрытым.

## Публикация

- Cloudflare Pages project: `sitecraft-auto-market`.
- Deployment ID: `fd5bc202`.
- Deployment URL: `https://fd5bc202.sitecraft-auto-market.pages.dev`.
- Production URL: `https://automarket.sitecraft.agency`.
- Production public smoke после deploy: успешно.

## Следующий шаг

Восстановить стабильное управление уже авторизованной browser-сессией и выполнить короткий owner-only сценарий: записать dashboard counters, открыть собственную карточку более двух секунд, вернуться в dashboard и подтвердить неизменность total/unique и отсутствие console errors.
