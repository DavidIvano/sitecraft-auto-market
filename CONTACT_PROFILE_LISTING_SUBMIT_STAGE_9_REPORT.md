# Contact Profile Listing Submit Stage 9

## Статус

Локальный frontend hotfix проверен и опубликован в существующий Cloudflare Pages project. Xano contact/draft patch и последующее исправление phone-regex опубликованы транзакционно. Авторизованный production E2E пока заблокирован зависшей управляемой Chrome-вкладкой.

## Корневая причина

Подтвержденная production-последовательность до исправления:

```text
POST /api/upload-listing-images -> 200
OPTIONS /me/contact-profile -> 200
PATCH /me/contact-profile -> 400
```

Frontend собирал скрытый или незаполненный email как пустую строку:

```json
{
  "contact_phone": "+49*********543",
  "contact_email": "",
  "show_phone": true,
  "show_email": false,
  "preferred_contact_method": "phone"
}
```

Live Xano-контракт endpoint `3997838` объявлял `contact_email` как optional `email`. Пустая строка не равна отсутствующему значению или `null` и может быть отклонена входным parser до выполнения существующей empty-to-null логики. Телефон соответствует E.164 и не является основанием автоматически считать его источником ошибки.

Исправленный canonical payload:

```json
{
  "contact_phone": "+49*********543",
  "contact_email": null,
  "show_phone": true,
  "show_email": false,
  "preferred_contact_method": "phone"
}
```

Фактический старый response body (`code`, `field`, `message`) не зафиксирован: Chrome показал нужную авторизованную вкладку, но дважды завис при попытке получить управление. Поэтому вывод о поле основан на точном сравнении старого frontend payload builder и экспортированного live XanoScript, а не выдается за прочитанный Network response.

### Подтвержденная финальная причина PHONE_INVALID

После первого deploy пользовательский Network и UI показали `PATCH /me/contact-profile -> 400` и field-error `Введите корректный телефон` для валидного номера `+4916096556543`. В live XanoScript был перепутан порядок аргументов фильтра:

```text
$next_phone | regex_matches: pattern
```

Рабочий синтаксис Xano, используемый остальными endpoint:

```text
pattern | regex_matches: $next_phone
```

Guard endpoint `3997838` исправлен на:

```text
"/^\\+[1-9][0-9]{7,14}$/" | regex_matches: $next_phone
```

Именно этот дефект отклонял корректный `+49` номер после того, как frontend/email payload уже был исправлен.

## Workflow

Старый порядок:

```text
validate -> upload images -> PATCH contacts -> create listing -> moderation
```

Новый порядок:

```text
validate listing and contacts
-> GET/compare current contact profile
-> PATCH contacts only when changed
-> upload or reuse images
-> create/reuse draft using idempotency key
-> submit the same draft to moderation
-> redirect to /dashboard/listings?submitted=1
```

Фазы процесса: `idle`, `validating`, `saving_contacts`, `uploading_images`, `creating_listing`, `submitting_moderation`, `success`, `error`.

## Frontend

- `src/lib/contactProfile.ts`: единая нормализация телефона/email, canonical nullable payload, сравнение профилей и typed API errors.
- `src/lib/listingSubmissionWorkflow.ts`: фазовый оркестратор, fingerprint файлов и стабильный idempotency key.
- `src/pages/dashboard/new.astro`: контакты до upload, guarded submit, сохранение формы/контактов/draft ID, повторное использование upload, retry только незавершенной moderation, field errors и понятные статусы.
- `src/components/dashboard/ContactProfileForm.astro`: общий parser response body без отдельного несовместимого builder.
- `tests/contact-profile-listing-submit-stage9.test.ts`: payload, validation, server errors, порядок операций, reuse и idempotency.
- `tests/seller-workflow-stage-3.test.ts`: старый запрет восстановления contact draft заменен проверкой нового Stage 9 контракта.

Контактный PATCH теперь пропускается, если нормализованный профиль не изменился. Ошибка не очищает форму, фотографии, preview, local draft или созданный draft ID. Повторный клик блокируется через running guard и disabled/`aria-busy`.

## Xano

Опубликованы транзакционно ограниченными batch:

- `PATCH /me/contact-profile`, endpoint ID `3997838`: nullable text input, empty-to-null, email/phone validation и структурированные field errors.
- `POST /listings/create-draft`: optional `idempotency_key`, owner-scoped lookup и повторное использование существующего draft.
- `car_drafts`: nullable `idempotency_key` и unique composite index `(user_id, idempotency_key)`.

Xano dry-run затронул только 3 документа: одну таблицу и два endpoint. Records, environment, secrets и остальные endpoint не включены.

Фактический push:

```text
workspace: 115940
branch: v1
documents: 3
result: success
```

Второй dry-run и push затронули только `PATCH /me/contact-profile`: исправлен порядок `regex_matches` для телефона. Records, environment, schema и другие endpoint не менялись.

Live backup до изменений:

```text
/Users/david/.codex/audits/sitecraft-auto-market/xano-live-stage-9-before-2026-07-30
```

Patch working copy:

```text
/Users/david/.codex/audits/sitecraft-auto-market/xano-live-stage-9-patch-2026-07-30
```

Live confirmation export после push:

```text
/Users/david/.codex/audits/sitecraft-auto-market/xano-live-stage-9-confirmed-2026-07-30
```

Phone-regex rollback и live confirmation:

```text
/Users/david/.codex/audits/sitecraft-auto-market/xano-live-stage-9-phone-regex-before-2026-07-30
/Users/david/.codex/audits/sitecraft-auto-market/xano-live-stage-9-phone-regex-after-2026-07-30
```

Frontend backup:

```text
.backups/contact-profile-listing-submit-stage-9/
```

## Фотографии и дубли

- При contact validation/PATCH error upload не начинается.
- Успешные uploads кэшируются по `name:size:lastModified` и повторно используются, пока набор файлов не изменен.
- Draft ID сохраняется после create; moderation retry не создает новый draft.
- Стабильный idempotency key привязан к пользователю и локальному submission ID.
- Текущий upload endpoint удаляет созданные им файлы при частичном batch failure. Отдельный публичный delete endpoint не добавлен.

## Проверки

```text
npm install             exit 0, 0 vulnerabilities
npm run check           exit 0, 0 errors, 1 existing hint
npm test                exit 0, 337 passed, 0 failed
npm run build           exit 0
npm run verify:assets   exit 0, 32 references / 33 HTML files
```

Cloudflare-compatible local runtime:

```text
GET http://127.0.0.1:8789/dashboard/new/ -> 200
GET http://127.0.0.1:8789/dashboard/     -> 200
```

## Production E2E

Не выполнен и не заявляется как выполненный.

```text
contact status:       not captured after patch
upload status:        not run after patch
draft create status:  not run after patch
moderation status:    not run after patch
listing ID:           none
final URL:            none
duplicate count:      not measured
```

Chrome discovery успешно нашел авторизованную вкладку `/dashboard/new/`, но claim страницы дважды завершился таймаутом. Cookies, local storage и auth tokens не читались и не экспортировались.

## Публикация

```text
Cloudflare project: sitecraft-auto-market
deployment ID:      4a14f340
deployment URL:     https://4a14f340.sitecraft-auto-market.pages.dev
production URL:     https://automarket.sitecraft.agency
Xano push:          completed, 3 documents
```

Post-deploy HTTP smoke:

```text
GET https://4a14f340.sitecraft-auto-market.pages.dev/dashboard/new/ -> 200
GET https://automarket.sitecraft.agency/dashboard/new/              -> 200
Stage 9 client asset on both origins: new.astro_astro_type_script_index_0_lang.BKR_ZAo5.js
```

Для завершения нужен один управляемый авторизованный прогон: сначала зафиксировать старый `400` response body, затем применить ограниченный Xano batch, проверить contact contracts, развернуть собранный `dist/client` и подтвердить полную цепочку с одним тестовым объявлением без дублей.

## Public contact projection hotfix

После успешного сохранения профиля production `GET /cars/bmw-520-2004-73` возвращал разрешённый `contact.phone`, но `contact.phone_href` был `null`. Нормализатор frontend считал контакт доступным только при наличии готового href, поэтому SSR скрывал кнопку связи, несмотря на сохранённый номер.

Исправлено:

- `GET /cars/{slug}` теперь отдельно формирует `$phone_href` и `$email_href`, без nullable ternary внутри response object;
- frontend восстанавливает только безопасные `tel:` и `mailto:` из валидных уже разрешённых значений;
- скрытые значения по-прежнему не возвращаются и не используются как fallback;
- manual/AI публикация сохраняет профиль до создания черновика, а публичная карточка читает актуальный профиль владельца для старых и новых объявлений.

Production contract после исправления:

```text
listing:       bmw-520-2004-73 (ID 94)
seller:        Davyd
phone:         present
phone_href:    valid tel:
email:         hidden
HTTP status:   200
```

Новые Xano backup и confirmation export:

```text
/Users/david/.codex/audits/sitecraft-auto-market/xano-live-public-contact-before-2026-07-30
/Users/david/.codex/audits/sitecraft-auto-market/xano-live-public-contact-patch-2026-07-30
/Users/david/.codex/audits/sitecraft-auto-market/xano-live-public-contact-after-2026-07-30
```

Финальная проверка и публикация hotfix:

```text
npm run check      exit 0, 0 errors, 1 existing hint
npm test           exit 0, 339 passed, 0 failed
npm run build      exit 0
Cloudflare project sitecraft-auto-market
deployment ID      25fc54eb
deployment URL     https://25fc54eb.sitecraft-auto-market.pages.dev
production URL     https://automarket.sitecraft.agency
```

Production HTTP QA подтвердил, что SSR содержит видимую кнопку `Связаться с продавцом`, `data-contact-phone-value`, валидный `data-phone-href` и скрытую заметку об отсутствии контакта. Авторизованный E2E с созданием нового тестового объявления не выполнялся: реальная запись не создавалась, поэтому этот пункт не выдан за подтверждённый production E2E.
