# Translation Worker — этап 2

Дата: 11 августа 2026 года. Xano workspace `115940`, branch `v1`, API group `421515`.

## Результат

- Создан управляемый Cloudflare Worker `sitecraft-translation-queue`.
- Безопасные production-флаги после работы: `enabled=false`, `dry_run=true`, `scheduled_enabled=false`.
- Ручной запуск и Xano backend защищены двумя разными секретами; значения не записаны в Git.
- Batch последовательный: обычный размер 2, жёсткий предел 3, после первой внешней ошибки пакет останавливается.
- OpenAI вызывается только внутри Xano; browser и Worker не получают provider key.
- Английские переводы завершены для всех 10 публичных объявлений.
- Публичный `GET /cars?lang=en` вернул 10 объявлений и 10 hash-matched completed translation envelopes.
- Production catalog/detail отдали `html lang="en"` и английский перевод seller description.
- Для `fr`, `tr`, `ar` подготовлено по 10 pending jobs; AI для этих локалей не запускался.

## Исправленная системная ошибка source hash

Dry-run обнаружил одинаковый hash у разных объявлений. Причиной был обратный порядок аргументов Xano `regex_replace`: subject ошибочно передавался слева вместо regex. Дополнительно endpoint редактирования использовал raw binary `sha256:true` для текстового поля.

Исправлены:

- `POST /listings/submit-moderation` (`3982675`);
- `PATCH /dashboard/listings/{id}` (`3969714`);
- Worker prepare/claim/source endpoints.

После исправления Xano hash совпадает с TypeScript canonical source hash. Для объявлений 94 и 95 версия источника увеличена до 2; старые задания закрыты как `SOURCE_HASH_CHANGED`.

Rollback и исходные checksums: `migration-backups/2026-08-11-source-hash-regression.before.md`.

## Английская волна

- Актуальные jobs: `21–30`, все `completed`.
- Переводы: 10 current rows `locale_code=en`, `translation_status=completed`.
- Missing/stale среди публичных объявлений: 0.
- Задание №2 удалённого объявления закрыто `LISTING_NOT_PUBLIC`.
- Старые английские №5 и №8 закрыты `SOURCE_HASH_CHANGED`.
- При кратком `TOO_MANY_REQUESTS` задания были безопасно повторены по одному и завершены; лимит попыток не исчерпан.

## Подготовленные следующие волны

| Локаль | Job IDs | Состояние |
| --- | --- | --- |
| `fr` | 31–40 | 10 pending, registry создан, public flag выключен |
| `tr` | 41–50 | 10 pending публичных объявлений |
| `ar` | 51–60 | 10 pending публичных объявлений, RTL registry уже существовал |

Следующий безопасный порядок: французский canary → французские пакеты → турецкий canary/пакеты → арабский canary/пакеты. После каждой локали отдельно проверять Xano row, source hash, catalog, detail и только затем обсуждать public flag/SEO.

## Остаток первого исторического batch

- №3, `de`, listing 95 — completed.
- №6, `de`, listing 94 — queued и ещё не обработано.
- №4/7, `uk`, listings 95/94 — queued и актуальны.
- №1, `uk`, listing 96 — относится к удалённому объявлению и должен быть закрыт без provider.
- №2/5/8, `en` — outdated; заменены новой актуальной завершённой волной.

## Проверки

- XanoScript validator: 8/8 Worker scripts valid.
- Полный Node suite: 448/448 tests passed.
- `astro check`: 0 errors; остаются только 18 существующих deprecation hints.
- Production build и проверка 49 asset references прошли.
- Public production smoke прошёл: sitemap, немецкие routes, французский закрытый route, device locale и сохранение legacy inventory.
