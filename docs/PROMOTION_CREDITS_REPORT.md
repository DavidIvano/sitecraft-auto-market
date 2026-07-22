# Продвижение объявлений за внутренние кредиты

Дата проверки: 22 июля 2026. Среда Xano: `live`. API group: `sitecraft-auto-market` (`jAAj839u`, ID `421515`).

## Что реализовано

- `boost_7_days`: 5 кредитов, 7 дней.
- `featured_14_days`: 12 кредитов, 14 дней.
- `homepage_premium_7_days`: 20 кредитов, 7 дней.
- Один TypeScript-конфиг является источником названий, стоимости, срока, timestamp-полей и приоритета.
- Кабинет показывает баланс, статистику объявлений и количество активных продвижений.
- Список объявлений показывает активные услуги и даты окончания; опубликованную карточку можно продвигать и продлевать.
- Страница продвижения загружает реальное объявление и баланс, показывает расчет остатка, подтверждает списание через dialog и обновляет UI без перезагрузки.
- История операций загружается из Xano с пагинацией.
- Каталог сортирует `homepage > featured > boosted > ordinary`, затем по `last_promoted_at`, затем по дате объявления.
- Главная показывает премиум-блок только при наличии активного `homepage_until`.
- Истекший timestamp не влияет на стиль, премиум-блок и сортировку.

## Xano: опубликованные endpoint

| ID | Метод и путь | Назначение |
|---:|---|---|
| `3966698` | `GET /cars` | Публичный privacy-safe каталог с promotion timestamps |
| `3966699` | `GET /cars/{slug}` | Публичная карточка и безопасные карточки продавца с promotion timestamps |
| `3968100` | `GET /dashboard/listings` | Объявления текущего владельца с promotion timestamps |
| `3995774` | `GET /dashboard/listings/{id}` | Owner-only карточка для экрана продвижения |
| `3995775` | `POST /dashboard/listings/{id}/promote` | Атомарная покупка продвижения |
| `3995776` | `GET /dashboard/credits/transactions` | История текущего пользователя, `page`/`per_page` |
| `3995777` | `GET /dashboard/summary` | Баланс и статистика кабинета |

Все dashboard endpoint используют Xano auth `automarket_users` (ID `861779`). Проверка без Bearer token возвращает `401` для detail, summary, history и promote. Публичные endpoint не возвращают `user_id`, телефон, email или полный VIN.

## Xano: таблицы

### `car_listings` (ID `861468`)

Добавлены nullable timestamp-поля:

`boosted_at`, `boosted_until`, `featured_at`, `featured_until`, `homepage_at`, `homepage_until`, `last_promoted_at`.

Добавлены индексы для активных сроков и сортировки. Существующее поле владельца `user_id` сохранено, дубликат `owner_id` не создавался.

### `user_credits` (ID `863717`)

Используется существующий баланс `ai_credits`. Уникальный индекс по `user_id` уже существовал. Если кошелька нет, summary/promote безопасно создают одну запись с нулевым балансом. Существующая логика ежедневных бесплатных начислений не заменялась и повторный стартовый grant не добавлялся.

### `credit_transactions` (ID `863718`)

Сохранена совместимость с существующей схемой:

- `type` используется как `transaction_type`;
- `related_car_id` используется как `listing_id`;
- `notes` используется как `description`;
- добавлены `updated_at`, `balance_before`, `product_slug`, `status`, `idempotency_key`, `metadata`;
- уникальный составной индекс: `user_id + idempotency_key`.

Продвижение записывается как `type=promotion_purchase`, отрицательный `amount`, `status=completed`, с балансом до/после и metadata срока.

## Исправление production-ошибки 500

22 июля 2026 реальный `POST /dashboard/listings/88/promote` трижды возвращал `500`. Xano Request History показал точный упавший шаг: вычисление переменной `$active_until` в Function Stack. Исходная ошибка:

`ERROR_FATAL: Unable to locate func entry: add_days`

Причина: в опубликованном XanoScript использовался несуществующий в текущем runtime фильтр `$base_time|add_days:$duration_days`. Его заменили на поддерживаемый timestamp-фильтр `$base_time|add_secs_to_timestamp:$duration_seconds`, где `$duration_seconds = $duration_days * 86400`.

До исправления проверены `user_credits`, `car_listings` и `credit_transactions`: все три неуспешных запроса были полностью откатаны `db.transaction`; частичного списания и поврежденных данных не было.

Production-проверка после исправления выполнена тремя последовательными реальными покупками `boost_7_days` для опубликованного listing `88` владельца `15`. Это одновременно подтвердило первое включение и двукратное продление активного срока:

| Transaction | Idempotency key | Баланс до | Баланс после | `boosted_until` |
|---:|---|---:|---:|---:|
| `34` | `c32749d6-7c0e-4a6c-a9d3-c43eb97b5dd2` | `1000000000` | `999999995` | `1785352676944` |
| `35` | `af62a447-72fc-48e2-a427-7f654104551a` | `999999995` | `999999990` | `1785957476944` |
| `36` | `fcda69da-5cad-480d-8c42-aa31eb553d47` | `999999990` | `999999985` | `1786562276944` |

Финальный POST на опубликованной версии вернул `200`, `credits_spent=5`, `amount=-5`, `type=promotion_purchase`, `status=completed`. Каждый новый срок ровно на `604800000` мс больше предыдущего, поэтому активная услуга действительно продлевается, а не перезаписывается от `now`. Повтор финального POST с тем же ключом вернул `409/DUPLICATE_OPERATION`, оставив баланс, срок и ledger без изменений.

Тестовые endpoint для выпуска короткоживущих auth token удалялись сразу после каждого запроса. В API group не осталось временных QA-маршрутов; временные draft-записи также удалены.

## Контракт ошибок и отрицательные проверки

После основной починки контракт доведен до требуемых HTTP-статусов. Для `409` и `422` XanoScript выставляет status line через `util.set_header` и завершает функцию до операций списания.

| Сценарий | Результат production | Изменения данных |
|---|---|---|
| Нет Bearer token | `401` | нет |
| Чужой listing `88`, пользователь `1` | `403/NOT_LISTING_OWNER` | нет |
| Неизвестный listing | `404/LISTING_NOT_FOUND` | нет |
| Неизвестный продукт | `400/INVALID_PRODUCT` | нет |
| Удаленный listing `20` | `409/LISTING_BLOCKED` | нет |
| Временный draft listing `93` | `409/LISTING_NOT_PUBLISHED` | нет; fixture удален |
| Повтор того же idempotency key | `409/DUPLICATE_OPERATION` | нет |
| Listing `21`, пользователь `31`, баланс `0` | `422/INSUFFICIENT_CREDITS` | нет |

Отдельный тест искусственно изменил баланс и promotion timestamps внутри `db.transaction`, затем вызвал `500/FORCED_LEDGER_FAILURE` на шаге, имитирующем отказ создания ledger. После запроса баланс остался `999999990`, listing полностью совпал с состоянием до запроса, число транзакций осталось `2`. Это подтверждает rollback уже выполненных записей, а не только ранний выход до мутаций.

## Атомарное списание

`POST /dashboard/listings/{id}/promote` принимает только `product_slug` и `idempotency_key`. Стоимость, длительность и изменяемое поле выбираются серверным allowlist.

В одной `db.transaction` Xano:

1. блокирует строку объявления;
2. проверяет владельца, blocked/deleted/archived/sold и опубликованность;
3. блокирует кошелек пользователя;
4. проверяет уникальный idempotency key;
5. проверяет баланс;
6. рассчитывает срок от текущего активного окончания или от `now`;
7. обновляет `ai_credits`;
8. обновляет нужные timestamps объявления;
9. создает ledger-запись.

Любая ошибка откатывает все изменения. Дополнительно уникальный индекс не дает двум параллельным запросам записать одну операцию. Frontend блокирует кнопку на время запроса и повторно использует тот же key после неопределенной сетевой ошибки.

## Frontend

Основные файлы:

- `src/lib/promotions/model.ts` — продукты, типы, даты, активность, продление и сортировка;
- `src/lib/apiRoutes.ts` — реальные dashboard routes;
- `src/pages/dashboard/index.astro` — summary кабинета;
- `src/pages/dashboard/listings.astro` — объявления и promotion-состояния;
- `src/pages/dashboard/cars/promote.astro` — подтверждение и покупка;
- `src/pages/dashboard/billing.astro` — баланс и ledger;
- `src/lib/publicCar.ts` — privacy-safe нормализация timestamps;
- `src/lib/publicCarCard.ts` — единая карточка и promotion badges;
- `src/pages/cars/index.astro` — единая сортировка каталога;
- `src/pages/index.astro` — premium-блок главной;
- `src/styles/promotions.css` и `src/styles/global.css` — desktop/mobile/a11y состояния.

Старые `purchaseCreate`, `checkout_url`, Stripe/PayPal и тестовое хранилище не используются экраном продвижения.

## Как проверить

Перед ручным тестом зафиксировать баланс и timestamps тестового объявления.

1. **Успех:** баланс 20+, купить `featured_14_days`; проверить `-12`, новый `featured_until`, одну completed-транзакцию и badge в `/cars/`.
2. **Недостаточно кредитов:** баланс 4, выбрать boost; UI должен отключить кнопку. Прямой API-запрос должен вернуть `INSUFFICIENT_CREDITS`, не меняя обе таблицы.
3. **Двойной запрос:** отправить два POST с одним UUID; баланс и ledger должны измениться один раз, второй запрос получить `DUPLICATE_OPERATION`.
4. **Чужое объявление:** отправить свой token и чужой ID; ожидать `403/NOT_LISTING_OWNER`, без изменений.
5. **Не опубликовано:** draft/pending ID; ожидать `409/LISTING_NOT_PUBLISHED`, без изменений.
6. **Blocked/deleted:** ожидать `409/LISTING_BLOCKED`, без изменений.
7. **Продление:** при остатке 5 дней купить boost на 7 дней; новая дата должна быть примерно через 12 дней.
8. **Истекший срок:** установить тестовый timestamp в прошлом; badge и повышенный приоритет должны исчезнуть.
9. **История:** открыть `/dashboard/billing/`; сумма, продукт, объявление и balance_after должны совпасть с ledger.
10. **Mobile/keyboard:** проверить ширины 390/768 px, Tab/Shift+Tab, Escape в dialog, focus ring, disabled-причины и `prefers-reduced-motion`.

Автоматически проверяются frontend-контракт, атомарность XanoScript, поддерживаемый timestamp-фильтр и отсутствие старого `add_days`. Реальный production POST для объявления `88` выполнен с явно указанными в задаче услугой и ожидаемым списанием; результат подтвержден независимым чтением всех трех таблиц и Xano Request History.

## Резервная копия и ручные действия

Backup до изменения находится в:

`/Users/david/Documents/Codex/2026-07-01/xana-api-metadata/outputs/live-promotions-20260722-195541`

Точечная резервная копия endpoint перед устранением production-ошибки `500`:

`/Users/david/Documents/Codex/2026-07-01/xana-api-metadata/outputs/promotion-500-fix-20260722-211200`

Версия endpoint перед добавлением точных `409/422` статусов:

`/Users/david/Documents/Codex/2026-07-01/xana-api-metadata/outputs/promotion-status-contract-20260722-before.json`

Там же сохранены результаты проверки таблиц и endpoint. Обязательных ручных действий в Xano не осталось: таблицы и endpoint опубликованы в `live`, реальная покупка, продление, точные статусы ошибок и защита от повторного списания подтверждены production-тестами.
