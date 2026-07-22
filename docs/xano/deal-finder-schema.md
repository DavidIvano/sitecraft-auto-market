# Xano schema: Deal Finder

**Статус 2026-07-16:** изолированные таблицы созданы через Xano Metadata API. Публичные таблицы и `car_listings` не менялись.

| Table | Xano table ID | Назначение |
| --- | ---: | --- |
| `deal_finder_emails` | 868285 | Optional/future email source; не участвует в primary pipeline |
| `deal_finder_sync_logs` | 868286 | Аудит ручных/будущих sync jobs |
| `deal_finder_searches` | 868287 | Search profiles для `kleinanzeigen_agent` |
| `deal_finder_listings` | 868288 | Изолированные внешние предложения |
| `deal_finder_analyses` | 868289 | Версионируемая очередь и история AI-анализов |
| `deal_finder_listing_translations` | Не создана | Owner-scoped очередь и кэш перевода описаний; blueprint подготовлен, provider отключён |

Полный переносимый blueprint находится в [deal-finder-tables.xs](deal-finder-tables.xs). Machine-readable contract: [deal-finder-schema.json](deal-finder-schema.json).

Очередь перевода вынесена в [deal-finder-translations.xs](deal-finder-translations.xs). Она не изменяет оригинальное `description`, не хранит raw provider response и не выполняет платный запрос.

## Migration notes

`automarket_users` должен иметь существующий role mechanism со значениями `admin` или `deal_finder_admin`; отдельный auth mechanism не создаётся. Для каждого search/listing сохраняется owner `user_id`.

Новые поля для Agent source уже добавлены в `deal_finder_searches`: `source_type`, `source_config`, `mileage_min`, `location_id`, `location_name`, `category_id`, `picture_required`, `seller_types`, `sync_enabled`, sync timestamps/status. В `deal_finder_listings` добавлены `source_images`, `data_level`, `provider_detail_loaded`, `provider_detail_fetched_at`; записи первого ingest (IDs 1-5) backfilled как подтверждённые detail-записи.

`deal_finder_analyses` мигрирована 2026-07-17 в версионируемую очередь. Добавлены `user_id`, `status`, `analysis_version`, `model`, `input_hash`, `listing_content_hash`, `provider_response_id`, token counters, безопасные timestamps/error code и `retry_count`. Уникальный индекс только по `listing_id` удалён: история сохраняется, а текущий результат выбирается по `completed_at/created_at`. `input_snapshot` хранится только внутри Xano/Worker контура и не возвращается browser endpoints.

## Endpoint status

Восемь Worker-only и десять authenticated frontend endpoints физически созданы в группе `sitecraft-auto-market`; IDs и контракты перечислены в [deal-finder-api.md](deal-finder-api.md). Analysis internal endpoints ограничены отдельной очередью и server-only secret. Frontend endpoints используют `automarket_users`, проверяют роль и применяют строгий owner scope.

Уникальный индекс таблицы `deal_finder_listings` обновлён до tenant-safe ключа `user_id + platform + external_id` (index ID `a0a993c6`). Это позволяет разным владельцам хранить один внешний ID без пересечения данных и сохраняет дедупликацию внутри владельца.
