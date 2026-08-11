# SiteCraft Translation Queue Worker

Управляемый Cloudflare Worker для малых последовательных пакетов переводов.

## Безопасные значения по умолчанию

- очередь выключена: `TRANSLATION_QUEUE_ENABLED=false`;
- каждый ручной запуск становится dry-run, пока `TRANSLATION_QUEUE_DRY_RUN=true`;
- cron имеет отдельный kill switch: `TRANSLATION_QUEUE_SCHEDULED_ENABLED=false`;
- максимум 2 задания за запуск, жёсткий предел — 3;
- разрешены только `en`, `fr`, `tr`, `ar`;
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

## Production state — 11 августа 2026

- английская волна завершена: 10/10 публичных объявлений;
- `fr`, `tr`, `ar`: по 10 подготовленных pending jobs, provider не запускался;
- production Worker снова `enabled=false`, `dry_run=true`, `scheduled_enabled=false`;
- Xano endpoint IDs и актуальные статусы записаны в `docs/xano/CURRENT_ENDPOINT_MANIFEST_RU.md`;
- подробный журнал: `docs/xano/multilingual/TRANSLATION_WORKER_STAGE_2_2026-08-11.md`.
