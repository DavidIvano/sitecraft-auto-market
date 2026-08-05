# Аудит Xano перед мультиязычной миграцией

Дата проверки: 4 августа 2026 года. Workspace: `sitecraft.agency` (`115940`), ветка `v1`, API group `sitecraft-auto-market` (`421515`, canonical `jAAj839u`). Секреты в отчёт не включены.

## Что найдено

- В workspace доступна только live-ветка `v1`. Создание тестовой ветки `multilingual-stage-3` отклонено Xano с сообщением, что ветки доступны на платном тарифе.
- Таблицы `locales` (`873236`), `taxonomy_translations` (`873239`), `car_listing_translations` (`873240`), `translation_jobs` (`873241`) и `content_migration_logs` (`873242`) существуют.
- В `locales` есть `de`, `en`, `ru`, `uk`, `zh-Hans`; активны все пять, но `is_public=false`. Для сайта разрешены только `de`, `ru`, `uk`, `en`.
- `taxonomy_translations`, `car_listing_translations`, `translation_jobs` и `content_migration_logs` пустые.
- В `car_listings` 28 записей. У всех пустой `source_locale`, `translations_ready=false` и пустой `translation_source_hash`.
- Уже существует закрытый административный endpoint `GET /admin/listings/{id}/translations` (`4003322`), который читает реальные поля `locale_code` и связанные задания.

## Реальные имена полей

- `locales`: `code`, `native_name`, `english_name`, `direction`, `is_active`, `is_default`, `is_public`, `fallback_locale`, `sort_order`.
- `taxonomy_translations`: `taxonomy`, `value_code`, `locale_code`, `label`, `short_label`, `description`, `is_active`, `sort_order`.
- `car_listing_translations`: `car_listing_id`, `locale_code`, `title`, `description`, `seo_title`, `seo_description`, `image_alt_texts`, `search_keywords`, `translation_status`, `translation_source`, `source_locale`, `source_hash` и служебные поля качества/проверки.

Локальные XanoScript-файлы приведены к этим именам. Поля `city`, `ai_highlights`, `ai_recommendations` и `ai_warnings` не добавляются в translation DTO, потому что в текущей таблице переводов их нет.

## Защита production

Существующие published endpoints не изменены. Точные live XanoScript пяти связанных endpoints сохранены в `live-backup-2026-08-04/`.

Черновик `GET /cars/{slug}` (`3966699`) сохранён через Metadata API с `publish=false`. Xano принял и скомпилировал XanoScript со статусом `ok`, `draft_updated_at=2026-08-04T21:28:33.928Z`. Публичный endpoint после тестов отвечает `200` и продолжает возвращать прежний published-контракт (`source_locale=null` для контрольного объявления), то есть production не переключён на draft. Контрольная сумма резервной копии published XanoScript: `766e55bcbcdb94f76ee665787e1b57e855cc7b14a88dcf737ada715849d39a17`.

После входа через Google-аккаунт владельца открыт правильный UI-workspace `sitecraft.agency` (`115940`) и API group `sitecraft-auto-market` (`421515`). Черновик проверен через Xano Run & Debug без публикации и без изменения данных:

- запрос `slug=audi-80-2026-75`, `lang=de` завершился успешно за 700 мс; resolver определил `source_locale=ru`, вернул `translation=null` и исходный заголовок `Audi 80 2026`, что подтверждает fallback при отсутствующем переводе;
- запрос с `lang=fr` остановлен на precondition за 10 мс с `ERROR_CODE_INPUT_ERROR` и сообщением `Unsupported locale`;
- выполненные функции только читают данные; записи в таблицах переводов и объявлений не создавались и не изменялись.

## Контролируемый интеграционный перевод

После отдельного подтверждения продолжения миграции 4 августа 2026 года создана одна контрольная запись `car_listing_translations` (`id=1`) для объявления `car_listings.id=96`, slug `audi-80-2026-75`:

- `locale_code=de`, `source_locale=ru`, `translation_status=completed`, `translation_source=manual_test`;
- исходный SHA-256: `ab6eba507f2811851af55adef8ed3053db2e6f3d62207a3979471a7ab0ec4c6d`;
- немецкий заголовок `Audi 80 Baujahr 2026`, описание `Hallo`, SEO-поля, alt-текст и поисковые ключи;
- у объявления заполнены `source_locale=ru`, `translation_source_hash`, `translation_version=1`, `translations_ready=true` и `translation_updated_at`.

Черновик `GET /cars/{slug}` через Run & Debug вернул контрольный перевод за 360 мс: `translation.id=1`, `locale=de`, `status=completed`, совпадающий `source_hash` и весь разрешённый объект `content`. Опубликованный endpoint после операции по-прежнему отвечает `200`, возвращает исходные `title`/`description` и `translation=null`: draft не опубликован.

Для stale-сценария `translation_source_hash` объявления дважды кратковременно заменялся несовпадающим контрольным значением. Запуск Run & Debug не завершился из-за тайм-аута кнопки интерфейса Xano; после каждой попытки исходный hash и `translations_ready=true` были немедленно восстановлены и проверены прямым чтением через Developer MCP. Локальный контракт stale-fallback проходит автоматический тест.

Проверки проекта после интеграционного шага: `tests/i18n-migration.test.ts` — 14/14, `astro check` — 0 ошибок и предупреждений, production build — успешно.

## Draft каталога GET /cars

5 августа 2026 года в endpoint `GET /cars` (`3966698`) сохранён draft с `publish=false`:

- добавлен необязательный `lang` с default `ru` и allowlist `de`, `ru`, `uk`, `en`;
- все завершённые переводы выбранной локали читаются одним batch-запросом, без N+1 запросов на каждую карточку;
- сопоставление выполняется только по `car_listing_id + locale_code + source_locale + source_hash + translation_status=completed`;
- оригинальные поля карточки не заменяются в Xano, перевод возвращается вложенным DTO;
- опубликованный каталог отдельно проверен: HTTP `200`, 13 карточек, контрольная Audi продолжает возвращать исходный заголовок и `translation=null`.

Run & Debug draft прошёл полный locale smoke-набор:

- `de`: 13 карточек, 110 statements за 430 мс; Audi получила `translation.id=1`, немецкий контент и совпадающий SHA-256;
- `ru`: `source_locale=ru`, `translation=null`, оригинал сохранён;
- `uk` и `en`: при отсутствии готовых записей `translation=null`, оригинал сохранён;
- `fr`: `ERROR_CODE_INPUT_ERROR`, `Unsupported locale`.

После изменения: полный набор проекта — 271/271 тестов, `astro check` — 0 ошибок/предупреждений, production build — успешно.

Прямое соединение с Xano Developer MCP успешно инициализировано (`Xano Metadata API 1.0.0`). В draft добавлены два встроенных read-only unit-теста: fallback при отсутствующем переводе и отказ для `lang=fr`. Xano скомпилировал XanoScript со статусом `ok`. Metadata API не перечисляет unit-тесты, находящиеся только внутри неопубликованного endpoint draft, поэтому выполнить их через `runUnitTest` до публикации нельзя.

## Drafts карточек продавца и рекомендаций

5 августа 2026 года с `publish=false` сохранены drafts `GET /cars/{slug}/seller-listings` (`3985671`) и `GET /cars/{slug}/related` (`3999920`):

- оба принимают `lang=de|ru|uk|en`, читают переводы одним batch-запросом и применяют точное сопоставление по ID объявления, локали, исходной локали, исходному hash и статусу `completed`;
- исходные поля карточек сохранены, в DTO добавлены только `source_locale` и вложенный `translation`;
- detail-страница сайта переключена с загрузки полного каталога для рекомендаций на bounded endpoint `/related?lang={locale}`;
- Run & Debug для `seller-listings` подтвердил немецкий перевод контрольной Audi (`Audi 80 Baujahr 2026`), русский оригинал и fallback для `uk`/`en`; `fr` отклонён с `Unsupported locale`;
- Run & Debug для `related` успешно вернул карточки с `source_locale=ru` и `translation=null` для `de`/`ru`/`uk`/`en`, поскольку для выбранных рекомендаций готовых переводов нет; `fr` отклонён;
- опубликованные endpoints отдельно проверены и продолжают возвращать прежний контракт без `source_locale` и `translation`, то есть production не изменён.

После этапа: полный набор проекта — 271/271 тестов, `astro check` — 0 ошибок/предупреждений, production build — успешно.

## Активация production 5 августа 2026 года

После успешных draft-проверок по одному опубликованы четыре read-only endpoint:

- `GET /cars/{slug}` (`3966699`);
- `GET /cars` (`3966698`);
- `GET /cars/{slug}/seller-listings` (`3985671`);
- `GET /cars/{slug}/related` (`3999920`).

После каждого publish выполнены production smoke-тесты для `de`, `ru`, `uk`, `en`, отказа `fr` и `404` для отсутствующего slug. Контрольный немецкий перевод Audi применяется в detail, каталоге и карточках продавца. Related сохраняет bounded-выборку без дублей и возвращает fallback, когда готового перевода нет. Metadata API подтвердил для каждого endpoint `compile=ok`, отсутствие незавершённого draft и ровно один batch-запрос `car_listing_translations`.

Дополнительно созданы и опубликованы `GET /locales` (`4005564`) и `GET /taxonomies` (`4005565`). `/locales` возвращает верхнеуровневый контракт `default_locale=ru`, `fallback_locale=de` и четыре разрешённых языка. `/taxonomies` принимает четыре локали, отклоняет `fr`; массивы пока пусты, потому что `taxonomy_translations` ещё не заполнена.

Локальный SSR с фактическим публичным Xano URL вернул `200` для немецких detail и catalog, отрисовал `Audi 80 Baujahr 2026` и блок похожих автомобилей. Полный набор проекта — 271/271 тестов, `astro check` — 0 ошибок/предупреждений, production build — успешно.

## Legacy dry-run и translation batch 01

5 августа 2026 года проверены все 28 объявлений по колонкам и структурированным значениям старых описаний. Единственные неизвестные значения — `Не указано` в `fuel_type` и `transmission` у удалённых объявлений 48 и 54. Среди 13 публичных кандидатов неизвестных значений нет.

Для объявлений 96, 95 и 94 рассчитан канонический SHA-256 `car_listing_translation_source_v1`, заполнены `source_locale=ru`, hash и `translation_version=1`. Hash контрольного немецкого перевода Audi синхронизирован с новым каноническим hash; production detail продолжает возвращать завершённый перевод.

В `translation_jobs` создано восемь уникальных задач со статусом `queued`, `max_attempts=3`, provider `openai`, model `gpt-5.6-luna`, prompt `listing-translation-v1`. Для 94 и 95 созданы цели `de/uk/en`, для 96 — `uk/en`; готовый `de` не дублируется. В `content_migration_logs` добавлена запись `i18n-batch-01`. Тексты и legacy-категории объявлений не изменялись.

После записи повторно проверены detail, каталог, seller-listings и related в production. Полный набор проекта — 274/274 теста, `astro check` — 0 ошибок/предупреждений, production build — успешно.

## Следующий безопасный шаг

1. Сохранить контрольные суммы и live XanoScript затрагиваемых endpoints.
2. Подготовить draft только для существующего `GET /cars/{slug}` с параметром `lang` и read-only resolver — выполнено.
3. Проверить, что публичный URL всё ещё отдаёт прежнюю published-версию — выполнено.
4. Протестировать draft в правильном Xano workspace через Run & Debug: fallback при отсутствующем переводе и отказ для неподдерживаемой локали — выполнено.
5. Подготовить одну контролируемую тестовую запись перевода и проверить готовый перевод — выполнено. Stale-fallback подтверждён локальным тестом; повторный живой Run & Debug остаётся открытым из-за тайм-аута UI Xano, исходные данные восстановлены.
6. Добавить `lang` и batch-resolver в draft списка `/cars`, выполнить smoke-набор `de/ru/uk/en/fr` без публикации — выполнено.
7. Добавить тот же контракт в drafts `GET /cars/{slug}/seller-listings` и `GET /cars/{slug}/related`, затем проверить карточки рекомендаций — выполнено.
8. Опубликовать согласованный набор read-only endpoints и выполнить production smoke-тест — выполнено.
9. Выполнить legacy dry-run и создать первый идемпотентный пакет translation jobs — выполнено.
10. Следующий этап: реализовать worker очереди, выполнить одну canary-задачу и только после проверки переводов обработать остальные семь.
