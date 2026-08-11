# Актуальный реестр Xano endpoints

Обновлено: 11 августа 2026 года

Workspace: `sitecraft.agency` (`115940`)

Production branch: `v1`

API group: `sitecraft-auto-market` (`421515`)

Публичный prefix: `api:jAAj839u`

## Как читать статусы

- `WORKING` — контракт выпускался в production и используется frontend/Worker.
- `PARTIAL` — endpoint существует, но у него есть известное ограничение или незакрытый риск.
- `RECORDED` — endpoint записан в предыдущем production-аудите; в этом проходе защищённый запрос не выполнялся.
- `MISSING` — frontend-идея или маршрут есть, но production backend не зафиксирован. Такая кнопка не должна показываться пользователю.
- `UNKNOWN` — числовой ID не был сохранён в репозитории; выдумывать его нельзя.

Числовые ID взяты из production-аудитов и журналов выпуска. 11 августа 2026 года без авторизации повторно проверены только безопасные публичные GET-запросы. Защищённые и изменяющие данные endpoints не вызывались без тестового сценария.

## Авторизация

| ID | Метод | Путь/назначение | Статус | Примечание |
| ---: | --- | --- | --- | --- |
| 3968548 | POST | `/auth/login` | PARTIAL | Работает; rate limit не подтверждён. |
| 3968549 | POST | `/auth/register` | PARTIAL | Конфликт существующей учётной записи исправлен; rate limit не подтверждён. |
| 3968077 | GET | `/auth/me` | WORKING | Проверка текущей сессии. |
| 3968076 | GET | Google OAuth init | PARTIAL | Рабочий вход; полный аудит state/PKCE не закрыт. |
| 3968099 | POST | Google OAuth continue | PARTIAL | Рабочее продолжение OAuth; allowlist требует отдельного аудита. |

## Публичный каталог, локали и контакты

| ID | Метод | Путь | Статус | Примечание |
| ---: | --- | --- | --- | --- |
| 3966698 | GET | `/cars` | WORKING | 11.08.2026: HTTP 200. `lang=de,ru,uk,en,ar,tr` — 200; `lang=fr` — 400. |
| 3966699 | GET | `/cars/{slug}` | WORKING | 11.08.2026: реальное объявление вернуло HTTP 200. |
| 3985671 | GET | `/cars/{slug}/seller-listings` | WORKING | 11.08.2026: HTTP 200. |
| 3999920 | GET | `/cars/{slug}/related` | WORKING | 11.08.2026: HTTP 200. |
| 4005564 | GET | `/locales` | WORKING | Возвращает шесть Xano-языков: `de,en,ru,uk,ar,tr`. |
| 4005565 | GET | `/taxonomies` | WORKING | 11.08.2026: HTTP 200. |
| UNKNOWN | GET | `/public/locale/cars?lang=de` | PARTIAL | HTTP 200, но список пуст; strict Release 4 ещё нельзя считать готовым каталогом. |
| UNKNOWN | GET | `/public/locale/cars/{slug}?lang=de` | PARTIAL | Контракт записан в Release 4, но для slug из legacy-каталога получен 404. |
| 3981281 | POST | `/analytics/listing-view` | WORKING | Публичная аналитика просмотра; повторно не вызывалась, чтобы не менять счётчики. |
| 3981451 | POST | `/ai/search/intent` | PARTIAL | Работает, но не закрыты rate limit и бюджет провайдера. |
| 3981320 | POST | `/saved-searches` | WORKING | Создание сохранённого поиска с авторизацией. |
| 3997833 | DELETE | `/favorites/{listing_id}` | WORKING | Удаление из избранного. |
| 3997834 | POST | `/favorites/{listing_id}` | WORKING | Добавление в избранное. |
| 3997835 | POST | `/favorites/status` | WORKING | Пакетная проверка избранного. |
| 3997836 | GET | `/favorites` | WORKING | Список избранного. |
| 3997837 | GET | `/me/contact-profile` | WORKING | Контакты продавца. |
| 3997838 | PATCH | `/me/contact-profile` | WORKING | Обновление контактов продавца. |

## Создание объявления и AI

| ID | Метод | Путь | Статус | Примечание |
| ---: | --- | --- | --- | --- |
| 3966700 | POST | `/cars` | WORKING | Ручное создание объявления. |
| 3966701 | PATCH | `/cars/{id}/submit` | WORKING | Отправка ручного объявления на модерацию. |
| 3974045 | POST | `/ai/generate-listing` | PARTIAL | Legacy-поток; оставлен только как совместимость. |
| 3979609 | POST | `/ai/listing/analyze-photos` | WORKING | Анализ фото и списание AI-кредита. |
| 3981498 | POST | `/ai/listing/generate-description` | PARTIAL | Нет единой подтверждённой политики списания. |
| 3981478 | POST | `/ai/listing/quality-score` | PARTIAL | Нет единой подтверждённой политики списания. |
| 3981578 | POST | `/ai/moderation/check-listing` | PARTIAL | Есть локальный fallback; провайдер требует наблюдаемости. |
| 3982637 | POST | `/listings/create-draft` | WORKING | Создание AI-черновика. |
| 3982675 | POST | `/listings/submit-moderation` | WORKING | Отправка AI-черновика на модерацию. |
| 3974028 | GET | `/dashboard/drafts/{id}` | WORKING | Чтение собственного черновика. |
| 3974029 | PATCH | `/dashboard/drafts/{id}` | WORKING | Редактирование собственного черновика. |
| 3974031 | POST | `/dashboard/drafts/{id}/publish` | WORKING | Legacy-публикация черновика. |

## Кабинет продавца, кредиты и продвижение

| ID | Метод | Путь | Статус | Примечание |
| ---: | --- | --- | --- | --- |
| 3968100 | GET | `/dashboard/listings` | WORKING | Объявления текущего пользователя. |
| 3995774 | GET | `/dashboard/listings/{id}` | WORKING | Owner-scoped карточка. |
| 3969714 | PATCH | `/dashboard/listings/{id}` | WORKING | Редактирование объявления. |
| 3983598 | PATCH | `/dashboard/listings/{id}/delete` | WORKING | Мягкое удаление. |
| 3995775 | POST | `/dashboard/listings/{id}/promote` | WORKING | Продвижение за внутренние кредиты; транзакция и ledger. |
| 3995777 | GET | `/dashboard/summary` | PARTIAL | Работает, но инициализация пустого кошелька расходится с другими endpoints. |
| 3974027 | GET | `/me/credits` | PARTIAL | Чтение баланса; политика кошелька ещё упрощённая. |
| 3995776 | GET | `/dashboard/credits/transactions` | WORKING | История кредитных операций. |

## Модерация и переводы

| ID | Метод | Путь | Статус |
| ---: | --- | --- | --- |
| 3966702 | GET | `/admin/moderation` | WORKING |
| 3966703 | PATCH | `/admin/cars/{id}/approve` | WORKING |
| 3966704 | PATCH | `/admin/cars/{id}/reject` | WORKING |
| 3979595 | PATCH | `/admin/cars/{id}/block` | WORKING |
| 3975051 | PATCH | `/admin/cars/{id}/delete` | WORKING |
| 3975107 | PATCH | `/admin/cars/{id}/sold` | WORKING |
| 3968561 | PATCH | `/admin/cars/{id}/assign-owner` | WORKING |
| 4003322 | GET | `/admin/listings/{id}/translations` | WORKING |

## Deal Finder: Worker API

| ID | Метод | Назначение | Статус |
| ---: | --- | --- | --- |
| 3988244 | GET | Активные поиски | RECORDED |
| 3988250 | GET | Существующие source IDs | RECORDED |
| 3988251 | POST | Ingest объявления | RECORDED |
| 3988644 | POST | Touch seen | RECORDED |
| 3990129 | GET | Pending analyses | RECORDED |
| 3990130 | POST | Claim analysis | RECORDED |
| 3990131 | POST | Complete analysis | RECORDED |
| 3990132 | POST | Fail analysis | RECORDED |
| 3991402 | GET | Preflight | RECORDED |

## Deal Finder: frontend API

| ID | Метод | Путь/действие | Статус |
| ---: | --- | --- | --- |
| 3988688 | GET | `/deal-finder/stats` | WORKING |
| 3988689 | GET | `/deal-finder/listings` | PARTIAL: N+1 lookup |
| 3988690 | GET | `/deal-finder/listings/{id}` | WORKING |
| 3988692 | POST | `/deal-finder/listings/{id}/view` | WORKING |
| 3988693 | POST | `/deal-finder/listings/{id}/save` | WORKING |
| 3988694 | POST | `/deal-finder/listings/{id}/unsave` | WORKING |
| 3988695 | POST | `/deal-finder/listings/{id}/hide` | WORKING |
| 3988696 | POST | `/deal-finder/listings/{id}/restore` | WORKING |
| 3990128 | POST | `/deal-finder/listings/{id}/analyze` | PARTIAL: списание кредита не подтверждено |
| 3988691 | GET | `/deal-finder/searches` | PARTIAL: только чтение |
| 3997839 | POST | `/deal-finder/listings/{id}/translate-description` | WORKING |

## Не существующие backend-контракты

Эти маршруты не считаются функциями production. Соответствующие действия скрыты или явно помечены как локальный UI-прототип.

| Область | Отсутствующие контракты |
| --- | --- |
| Покупки | `POST /purchases/create`, `POST /purchases/apply`, `GET /me/purchases`, checkout, webhook, refund/reconciliation |
| Дилеры | `GET /dealer-profile`, `POST /dealer-profile/update`, `GET /admin/dealers`, subscription entitlement |
| Админка товаров/покупок | `GET/CRUD /admin/paid-products`, `GET/actions /admin/purchases` |
| Модерация | archive/restore объявления; add/delete/primary изображения |
| Deal Finder searches | `POST /deal-finder/searches`, `PATCH/DELETE /deal-finder/searches/{id}` |
| Deal Finder workspace | server workspace, comparison storage, notification preferences/deliveries, sync logs, inbox/email |

## Источник правды

1. Этот файл — текущий человекочитаемый реестр.
2. `src/lib/apiRoutes.ts` — пути, используемые frontend, но наличие константы не доказывает наличие backend.
3. `docs/release/XANO_PRODUCTION_ENDPOINT_IDS.md` — короткий журнал последних отдельно выпущенных ID.
4. `API_ENDPOINT_AUDIT.md` — исторический глубокий аудит от 23 июля 2026 года; отдельные выводы в нём уже устарели.

После каждого Xano release нужно обновлять этот реестр: ID, метод, путь, auth, статус, дату проверки и ссылку на backup/release report.
