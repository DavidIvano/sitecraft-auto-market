# Актуальный реестр Xano endpoints

Обновлено: 22 августа 2026 года

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

Числовые ID взяты из production-аудитов и журналов выпуска. 22 августа 2026 года materializer snapshot подтвердил 11/11 публичных объявлений для каждой из 28 локалей: 24 языков ЕС плюс `ru/uk/ar/tr`. Секреты Worker/Xano в Git не записываются.

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
| 4005564 | GET | `/locales` | PARTIAL | Legacy-контракт по-прежнему возвращает только `de,en,ru,uk,ar,tr`; французский опубликован через strict Stage 3 registry, но ещё не добавлен в этот старый список. |
| 4005565 | GET | `/taxonomies` | WORKING | 11.08.2026: HTTP 200. |
| 4009274 | GET | `/public/locale/cars?lang={locale}` | WORKING | 16.08.2026: все 28 пользовательских локалей возвращают по 10/10. Source-ветка исправлена: отсутствующие `car_listings.seo_*` больше не читаются. |
| 4009273 | GET | `/public/locale/cars/{slug}?lang={locale}` | WORKING | Все 28 пользовательских локалей используют актуальный source hash без fallback; русский detail возвращает source, остальные языки — готовый перевод. |
| 4020327 | GET | `/public/locale/catalog?lang={locale}&page={page}&limit=24` | WORKING | Production-authoritative bounded-каталог читает только generation активного manifest pointer. Materializer parity: 11/11 для всех 28 локалей; compatibility fallback выключен. |
| 4020328 | GET | `/public/locale/sitemap/listings?lang={locale}&generation={generation}&page={page}&limit=10000` | WORKING | 20.08.2026: slug/lastmod-only shard. Slug-наборы совпали с каталогом, приватные поля отсутствуют; invalid generation/page дают 404. |
| 4020329 | GET | `/public/seo/sitemap/manifest` | WORKING | Единственный атомарный указатель активной immutable generation; требует все 28 публичных локалей. |
| 4020380 | GET | `/public/locale/taxonomies/counts` | WORKING | 20.08.2026: bounded counts для sitemap/navigation. Canary `de`: 30 существующих facets, 24 indexable; Cloudflare production source `xano_pages_only`. |
| 4020381 | GET | `/public/locale/taxonomy/{type}/{slug}/related` | WORKING | Precomputed overlap из активной generation; materializer сохраняет до трёх разных релевантных направлений на фасет. Embedded и отдельный related-контракты проверены для всех 7 типов. |
| 4020382 | GET | `/public/locale/taxonomy/{type}/{slug}` | WORKING | Bounded page до 24 карточек читает только активную generation. Все 7 типов, RU/AR, thin `noindex` и отрицательные 404 пройдены; source `xano_bounded`, compatibility fallback выключен. |
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

### Управляемая очередь переводов

Все маршруты ниже закрыты отдельным Worker secret, не принимают OpenAI key от браузера и выпущены 11 августа 2026 года.

| ID | Метод | Путь | Статус | Назначение |
| ---: | --- | --- | --- | --- |
| 4011152 | POST | `/translations/internal/prepare` | WORKING | Идемпотентная подготовка source hash, original row и заданий одной локали; allowlist включает все 27 целевых языков кроме исходного `ru`. Placeholder-secret получает 403. |
| 4011153 | POST | `/translations/internal/jobs/pending` | WORKING | Не более трёх pending/queued/failed jobs; allowlist включает все 27 целевых языков кроме исходного `ru`. Placeholder-secret получает 403. |
| 4011154 | POST | `/translations/internal/jobs/{id}/claim` | WORKING | Атомарный claim; stale и непубличные задания закрываются без provider. |
| 4011155 | POST | `/translations/internal/jobs/{id}/translate` | WORKING | Server-side OpenAI Responses API со strict JSON schema. |
| 4011156 | POST | `/translations/internal/jobs/{id}/complete` | WORKING | Идемпотентный upsert перевода и завершение job. |
| 4011157 | POST | `/translations/internal/jobs/{id}/fail` | WORKING | Безопасный error code и возврат job в retryable failed. |
| 4011158 | POST | `/translations/internal/sources/{id}` | WORKING | Read-only сверка канонического и сохранённого source hash. |
| 4011167 | POST | `/translations/internal/locales/prepare` | WORKING | Идемпотентная подготовка registry для всех 28 пользовательских локалей; локаль не публикуется автоматически. |
| 4011207 | POST | `/translations/internal/locales/release` | WORKING | Dry-run-first release-gate: публикует локаль только при 100% готовности. Все 28 пользовательских локалей выпущены отдельными волнами после проверки 10/10. |

### Production SEO materializer

Защищённые маршруты доступны только Cloudflare Worker. Таблица очереди `seo_refresh_queue` имеет ID `880813`; задания создаются непосредственно в approve/edit/sold/block/delete и translation-complete endpoints, потому что table triggers недоступны на текущем тарифе Xano.

| ID | Метод | Путь | Статус | Назначение |
| ---: | --- | --- | --- | --- |
| 4021120 | POST | `/seo/internal/queue/claim` | WORKING | Транзакционный claim до 100 идемпотентных событий. |
| 4021121 | POST | `/seo/internal/snapshot/page` | WORKING | Privacy-minimized snapshot публичных объявлений, переводов и 28 локалей. |
| 4021122 | POST | `/seo/internal/generation/facets` | WORKING | Транзакционная staging-запись taxonomy facets пакетами до 100. |
| 4021123 | POST | `/seo/internal/generation/rows` | WORKING | Staging listing index, edges, stats, related и manifest rows пакетами до 100. |
| 4021124 | POST | `/seo/internal/generation/activate` | WORKING | Проверяет точные количества и атомарно меняет 28 active manifest pointers. |
| 4021125 | POST | `/seo/internal/queue/fail` | WORKING | Возвращает retryable job в pending; после лимита переводит в failed. |
| 4021126 | POST | `/seo/internal/queue/enqueue` | WORKING | Идемпотентный ручной/операционный enqueue по `event_key`. |
| 4021173 | POST | `/seo/internal/queue/checkpoint` | WORKING | Сохраняет deterministic generation и batch cursor, затем безопасно возвращает задание в pending для следующей фазы без расходования error-attempt. |

Mutation hooks с маркером `SEO_MATERIALIZER_QUEUE_HOOK_V1` выпущены в endpoints `3966703`, `3969714`, `3975051`, `3975107`, `3979595`, `3983598`, `4011156`. Ошибка очереди не блокирует основную пользовательскую мутацию.

22.08.2026 атомарно активирована generation `seo-3f1553ad7f6cae700283c1adf05fb9f3`: 28 manifest pointers, 11 объявлений на локаль, 308 locale/listing rows, 32 facets, 2576 edges, 896 stats и 2688 related rows. Публичные catalog и sitemap shards всех 28 локалей вернули HTTP 200, одинаковый generation и 11/11 без fallback. Materializer выполняет не более 36 batch-запросов за вызов и продолжает через checkpoint, чтобы не превышать лимит внешних subrequest Cloudflare Worker.

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
