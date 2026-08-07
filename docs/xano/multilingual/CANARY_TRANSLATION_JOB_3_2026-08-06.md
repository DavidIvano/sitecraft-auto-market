# Проверка canary-перевода: job 3

Дата проверки: 2026-08-06
Workspace Xano: `115940`, live branch: `v1`

## Выполненная задача

- `translation_jobs.id`: `3`
- объявление: `car_listings.id=95`, `mercedes-benz-vito-2006-74`
- направление: `ru -> de`
- source hash: `cbc8983bf23721e881716955deb2e2525a0b99425e4accce27fc3f3e4b4e64e2`
- созданная запись: `car_listing_translations.id=2`
- итоговый статус задачи: `completed`
- число попыток: `1`
- `last_error`: `null`

Перед записью source hash задачи был повторно сопоставлен с текущим
`car_listings.translation_source_hash`. Пара `car_listing_id=95 + locale_code=de`
не существовала, поэтому дубликат не создавался.

## Результаты проверки

- Xano `GET /cars/{slug}?lang=de` возвращает completed-перевод с точным source hash.
- Xano `GET /cars?lang=de` возвращает тот же перевод в карточке объявления.
- Русский detail продолжает использовать исходный текст.
- Для ещё не готового английского перевода сохраняется безопасный fallback на русский оригинал.
- Публичный список языков содержит `de`, `en`, `ru`, `uk`; default — `ru`.
- Остальные семь задач первого пакета остались `queued` с `attempt_count=0`.

Локальный frontend правильно выводит немецкие title и description на detail и
немецкий title в каталоге. Общий renderer карточек исправлен: ссылки карточек
теперь сохраняют выбранный параметр `lang`.

## Проверки проекта

- `npm test`: 275/275 успешно.
- `npm run check`: 0 ошибок, 0 предупреждений.
- `npm run build`: Cloudflare production bundle собран успешно.

## Известный разрыв

Домен `automarket.sitecraft.agency` всё ещё обслуживает предыдущую frontend-сборку:
запрос detail с `?lang=de` возвращает русский HTML. Xano уже готов и локальная
сборка работает; для публичного отображения нового поведения требуется развернуть
текущую frontend-сборку.
