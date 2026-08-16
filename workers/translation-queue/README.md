# SiteCraft Translation Queue Worker

Управляемый Cloudflare Worker для малых последовательных пакетов переводов.

## Безопасные значения по умолчанию

- очередь выключена: `TRANSLATION_QUEUE_ENABLED=false`;
- каждый ручной запуск становится dry-run, пока `TRANSLATION_QUEUE_DRY_RUN=true`;
- cron имеет отдельный kill switch: `TRANSLATION_QUEUE_SCHEDULED_ENABLED=false`;
- максимум 2 задания за запуск, жёсткий предел — 3;
- разрешены только подготовленные волны `de`, `en`, `fr`, `tr`, `ar`, `uk`, `nl`, `da`, `sv`, `fi`, `es`, `pt`, `it`, `pl`, `cs`, `sk`, `sl`, `bg`, `hr`, `ro`, `hu`, `el`, `et`, `lv`, `lt`, `mt`, `ga`;
- Worker не хранит OpenAI key: provider вызывается защищённым Xano endpoint;
- `/run` и Xano endpoints используют разные секреты;
- задания выполняются последовательно.

## Secrets

Никогда не записывать значения в Git:

```sh
wrangler secret put TRANSLATION_WORKER_TRIGGER_SECRET
wrangler secret put XANO_TRANSLATION_WORKER_SECRET
```

Первый секрет защищает ручной `/run`, второй совпадает с секретом защищённых Xano endpoints.

## Rollout

1. Deploy с выключенной очередью и dry-run.
2. Проверить `/health`.
3. Вызвать `/run` для `en`, `limit=1`, `dry_run=true`.
4. Включить live только для одного canary.
5. Проверить Xano row, source hash и публичный ответ.
6. Обрабатывать английский пакетами по 2; другие языки запускать отдельными волнами.

Немецкий запускается отдельной strict SEO-волной: сначала `dry_run`, затем
идемпотентные пакеты максимум по 2 задания и release-gate 100% перед включением
индексируемых маршрутов.

## Production state — 16 августа 2026

- все 27 целевых локалей обработаны отдельными волнами; исходный русский не требует provider-перевода;
- для каждой из 28 пользовательских локалей strict Xano catalog/detail подтверждает 10/10 публичных объявлений без fallback;
- финальная EU-волна `pl/cs/sk/sl/bg/hr/ro/hu/el/et/lv/lt/mt/ga` обработана заданиями `172–311` пакетами максимум по три;
- каждый язык прошёл dry-run release-gate до включения `is_public=true`;
- production Worker после миграции должен оставаться `enabled=false`, `dry_run=true`, `scheduled_enabled=false`, пока не согласован постоянный режим;
- Xano endpoint IDs и актуальные статусы записаны в `docs/xano/CURRENT_ENDPOINT_MANIFEST_RU.md`;
- подробный журнал: `docs/xano/multilingual/TRANSLATION_WORKER_STAGE_2_2026-08-11.md`.
