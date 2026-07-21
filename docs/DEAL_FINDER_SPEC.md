# SiteCraft Deal Finder

## Назначение и границы MVP

Deal Finder - закрытый внутренний инструмент для администратора, который помогает отслеживать внешние предложения автомобилей. Он изолирован от публичного каталога: записи **не** создают и не изменяют `car_listings`, не попадают в `/cars/` и не индексируются поисковыми системами.

На этом этапе основной путь данных подготовлен, но выключен:

```text
Kleinanzeigen Agent REST API
  -> Cloudflare Worker (ручной защищённый запуск; Cron выключен)
  -> Xano ingestion endpoints
  -> deal_finder_listings
  -> manual OpenAI analysis queue (disabled by default)
  -> /dashboard/deal-finder/
```

Рабочая безопасная часть MVP: `manual_json` или mock-данные -> Xano/закрытый интерфейс. `email` остаётся optional future source: Gmail OAuth, чтение почты, HTML parsing и автоматическая обработка писем не реализованы.

## Данные и статусы

Таблицы: `deal_finder_searches`, `deal_finder_listings`, `deal_finder_analyses`, `deal_finder_sync_logs`; `deal_finder_emails` сохранена только для будущего optional source. Подробная схема: [deal-finder-schema.md](xano/deal-finder-schema.md).

- Source type: `kleinanzeigen_agent` (primary), `manual_json`, `mock`, `email` (future).
- Source status: `active`, `source_removed`, `expired`, `unknown`.
- User status: `new`, `viewed`, `saved`, `hidden`, `contacted`, `rejected`.
- Analysis status: `pending`, `processing`, `completed`, `failed`, `cancelled`, `superseded`.
- Recommendation: `HOT_DEAL`, `CONTACT_NOW`, `REVIEW`, `WATCH`, `SKIP`, `INSUFFICIENT_DATA`.

При повторном поиске дедупликация идёт по `platform + external_id`. Search payload используется только для обнаружения ID. Новые ID получают provider detail и только успешно проверенные detail-записи идут в полный ingest. Существующие ID не получают повторный detail и отправляются только в `touch-seen`, который обновляет безопасные timestamps/source state. Search payload никогда не заменяет detail payload, `content_hash` вычисляется по нормализованным detail-данным, а пользовательские флаги `is_saved`, `is_hidden`, `is_viewed`, `is_new` и `user_status` не сбрасываются. После трёх подтверждённых недоступностей источник получает `source_removed`, запись скрывается, но не удаляется физически.

`deal_finder_listings.data_level` различает `search` и `detail`; `provider_detail_loaded` и `provider_detail_fetched_at` подтверждают успешное получение detail. Production Worker создаёт новые строки только с `data_level=detail`. Ошибка detail изолируется, увеличивает `detail_failures`, не создаёт урезанную запись и не останавливает остальные объявления.

## Изображения и безопасность

- Хранятся только нормализованные внешние `https` URL, включая `source_images`; R2 не используется.
- `javascript:`, `data:`, non-HTTPS и SVG не принимаются. Ошибка загрузки показывает локальный placeholder.
- Все Deal Finder routes используют `noindex, nofollow, noarchive` и отсутствуют в sitemap.
- Все Xano frontend endpoints требуют `automarket_users`; доступ проверяется server-side для `admin` или `deal_finder_admin`, затем применяется строгий owner scope. Cross-owner admin access не включён без отдельной политики.
- Tenant-safe дедупликация использует `user_id + platform + external_id`; клиентский `user_id` никогда не является источником владельца.
- Worker и внутренние ingestion endpoints дополнительно требуют `X-Deal-Finder-Secret`. Секреты существуют только в Worker/server environment, не в public env и не в логах.
- Автоматический поиск, Cron и OpenAI выключены по умолчанию. Нет scraping, CAPTCHA bypass, proxy rotation, автоматического входа в Kleinanzeigen или контакта с продавцами.

## Ручной AI-анализ

Detail page может только поставить owner-scoped задачу в `deal_finder_analyses`. Xano вычисляет `input_hash`, переиспользует одинаковые pending/processing/completed версии и никогда не вызывает модель напрямую. Protected Worker забирает максимум одну задачу, атомарно claim-ит её и использует `gpt-5.6-luna` через OpenAI Responses API со strict Structured Outputs. Без сравнительных объявлений confidence принудительно ограничен `0.70`. Подробный контракт: [DEAL_FINDER_OPENAI.md](integrations/DEAL_FINDER_OPENAI.md).

Deal score первой версии является эвристикой по сохранённым данным. Это не подтверждённая рыночная скидка, не диагностика, не гарантия покупки и не прогноз прибыли. Images, seller PII, provider raw data и secrets в AI input не входят.

## Detail route в static MVP

Закрытая детальная страница использует универсальный статический URL `/dashboard/deal-finder/listing/?id={positive_integer}`. ID читается и нормализуется только в браузере, после чего существующий authenticated Xano client загружает owner-scoped запись. Поэтому новые Xano listings доступны без новой Astro-сборки и без hardcoded ID.

Пустой, нулевой, отрицательный или нечисловой `id` не вызывает API и показывает безопасное состояние. Неизвестный положительный ID вызывает обычный закрытый detail endpoint и получает безопасный 404. Clean URL вида `/dashboard/deal-finder/listings/{id}` потребует SSR или Cloudflare Workers; такая миграция в текущем static Pages MVP не выполнена.

## Дальнейшие этапы

1. Сохранить `sync_enabled=false` и Cron выключенным до отдельного подтверждения.
2. Добавить mutation endpoints для управления профилями поиска только отдельным этапом.
3. Выполнять следующий provider sync только после отдельного подтверждения расхода API-кредитов.
4. После отдельного подтверждения выполнить один live AI analysis с лимитом 1 и проверить usage/cost audit.
5. После ручной проверки подключить один реальный `.eml`/HTML как optional source и только на его фактической структуре проектировать parser.
