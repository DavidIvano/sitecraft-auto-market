# Seller Contact System Stage 6

Дата завершения: 2026-07-29

Production: https://automarket.sitecraft.agency

Cloudflare Pages project: `sitecraft-auto-market`

## Причина проблемы

Форма контактов зависела от наличия auth token во время первого выполнения
клиентского скрипта. При более позднем восстановлении сессии обработчик формы и
загрузка профиля могли не активироваться. Временные ошибки API также смешивались
с истёкшей сессией.

Публичная карточка частично полагалась на legacy-поля объявления и не имела
единого безопасного seller DTO. Из-за этого профиль владельца не был надёжным
источником актуальных контактов для всех объявлений.

Дополнительно workflow отправки на модерацию использовал fallback на email входа.
Это нарушало требование явного согласия на публикацию контакта.

## Резервные копии

Frontend до изменений:

`.backups/seller-contact-system-stage-6/`

Live Xano до изменений, вне repository:

`/Users/david/.codex/audits/sitecraft-auto-market/seller-contact-system-stage-6-live-before-2026-07-29-01`

Live Xano после первого production patch, вне repository:

`/Users/david/.codex/audits/sitecraft-auto-market/seller-contact-system-stage-6-live-after-2026-07-29-01`

Backup содержит endpoint, table, schema, index и workspace definitions. Production
records, auth cookies, tokens, passwords, `.env` и `.dev.vars` не копировались в
repository.

## Изменённые файлы

- `src/components/dashboard/ContactProfileForm.astro`
- `src/components/ContactSellerModal.astro`
- `src/pages/dashboard/new.astro`
- `src/pages/dashboard/listings/edit.astro`
- `src/pages/cars/[slug].astro`
- `src/lib/contactProfile.ts`
- `src/lib/types.ts`
- `src/lib/validation/listingValidation.ts`
- `src/lib/aiDraftSubmission.ts`
- `src/lib/publicCar.ts`
- `src/styles/global.css`
- `tests/contact-profile.test.ts`
- `tests/seller-contact-stage6.test.ts`
- `docs/xano/seller-contact-system-stage-6/PATCH_me_contact_profile.after.xs`
- `docs/xano/seller-contact-system-stage-6/GET_cars_slug.after.xs`
- `docs/xano/seller-contact-system-stage-6/POST_listings_submit_moderation.after.xs`

## Модель данных

Основной источник истины: `automarket_users`.

Поля профиля:

- `first_name`
- `last_name`
- `display_name`
- `contact_phone`
- `contact_email`
- `show_phone`
- `show_email`
- `preferred_contact_method`

Поля `seller_name`, `seller_phone`, `seller_email` в `car_listings` сохранены как
legacy snapshot. Они не обходят текущие `show_phone` и `show_email`.

Порядок публичного имени:

1. `display_name`
2. `first_name + last_name`
3. legacy `seller_name`
4. `Продавец автомобиля`

Email входа не используется вместо имени или публичного contact email.

## Dashboard

`ContactProfileForm.astro` теперь:

- всегда подключает submit listener и защищён от повторного подключения;
- вызывает `getAuthToken()` непосредственно перед GET и PATCH;
- ждёт завершения восстановления auth;
- различает истёкшую сессию и временную сетевую ошибку;
- выполняет bounded retry GET: сразу, примерно через 1 и 3 секунды;
- не повторяет PATCH автоматически;
- сохраняет введённые значения при ошибке;
- поддерживает состояния кнопки `Проверяю вход…`, `Сохранить контакты`,
  `Сохраняю…`, `Сохранено`, `Повторить`;
- после успеха обновляет форму, показывает toast и отправляет
  `seller-contact-profile-updated`.

Общая валидация находится в `src/lib/contactProfile.ts`. Телефон приводится к
E.164, email обрезается и переводится в lowercase. CR/LF и противоречивые
visibility/preferred настройки отклоняются.

## Публикация

Оба режима `/dashboard/new/` используют одну canonical contact model.

- Профиль загружается после auth restore.
- AI и manual формы заполняются одинаковыми значениями.
- Изменённый профиль сохраняется перед сохранением объявления.
- Черновик допускается без публичного контакта.
- Отправка на модерацию блокируется без разрешённого валидного телефона или email.
- AI не создаёт телефон, email, имя или visibility flags.
- Контактные значения не добавляются в AI description и локальный AI draft.

Страница редактирования использует актуальный глобальный профиль и ведёт на
`/dashboard/#contact-profile` для изменения контактов сразу во всех объявлениях.

## Публичная карточка

Публичный `seller` DTO нормализован:

```json
{
  "name": "David",
  "type": "private",
  "city": "Peine",
  "active_listings_count": 3,
  "contact": null
}
```

`contact` содержит только явно разрешённые значения. Скрытые поля отсутствуют,
а не возвращаются с `null` или fallback.

`ContactSellerModal.astro` показывает видимое значение телефона/email, безопасные
`tel:`/`mailto:` ссылки, copy actions и Lucide icons. Реализованы Escape,
backdrop close и возврат focus. При отсутствии контактов основная кнопка скрыта,
показывается пояснение.

Client seller refresh использует `cache: "no-store"` и обновляет name, visible
values, href, preferred method и visibility. Удалённый контакт очищается из DOM.

## Безопасность

Подтверждено:

- login/OAuth email не публикуется автоматически;
- fallback `contact_email || auth_email` удалён из moderation workflow;
- `show_phone=false` не раскрывает телефон;
- `show_email=false` не раскрывает email;
- legacy listing contact не обходит настройки профиля;
- публичный DTO не содержит auth token, password, Google ID, role или credits;
- private profile endpoints требуют авторизацию;
- публичная карточка с `contact:null` не содержит скрытых контактных значений.

## Xano

Подтверждённые live endpoint IDs:

- `3997837` — GET `/me/contact-profile`
- `3997838` — PATCH `/me/contact-profile`
- `3966699` — GET `/cars/{slug}`
- `3982637` — POST `/listings/create-draft`
- `3982675` — POST `/listings/submit-moderation`
- `3969714` — PATCH `/dashboard/listings/{id}`

Изменены три live endpoint:

- `3997838`: server-side normalization/validation профиля;
- `3966699`: безопасная проекция seller/contact и тип `private|dealer`;
- `3982675`: проверка контакта по текущему профилю без login email fallback.

Production smoke:

- анонимный GET profile: `401`;
- анонимный PATCH profile: `401`;
- анонимный submit moderation: `401`;
- публичный GET `bmw-520-2004-73`: `200`;
- seller DTO для этой карточки: `type="private"`, `contact=null`.

## Автоматические проверки

- `npm install`: exit code 0, 0 vulnerabilities.
- `npm run check`: exit code 0, 0 errors, 0 warnings.
- `npm test`: exit code 0, 319/319 tests passed.
- `npm run build`: exit code 0.
- `npm run test:http:local`: exit code 0.

Локальный HTTP runtime проверил sitemap, каталог, brand/model routes, реальную
карточку и 404 route. Это не выдаётся за авторизованный production E2E.

## Production HTTP smoke

- `https://automarket.sitecraft.agency/dashboard/`: `200`
- `https://automarket.sitecraft.agency/dashboard/new/`: `200`
- `https://automarket.sitecraft.agency/cars/bmw-520-2004-73/`: `200`
- deployment dashboard URL: `200`

## Production E2E

Авторизованная Chrome-вкладка `Мои объявления` была обнаружена, но управление
вкладкой дважды остановилось по тайм-ауту до чтения формы. Резервная in-app
browser session находилась на Google sign-in и не была авторизована.

Поэтому следующие сценарии не отмечаются как выполненные:

- phone enabled;
- email enabled;
- phone hidden;
- сохранение contact profile после reload;
- modal с реальными `tel:` и `mailto:`;
- изменение контактов при production listing publication.

Production contact settings не изменялись и тестовое объявление не создавалось.

## Публикация

- Cloudflare project: `sitecraft-auto-market`
- deployment ID: `4dd922b0-71f0-41a4-b469-d9be4e70ce10`
- deployment URL: `https://4dd922b0.sitecraft-auto-market.pages.dev`
- production URL: `https://automarket.sitecraft.agency`
- deploy выполнен напрямую из `dist/client`, без Git.

## Итог

Frontend, Xano contracts, privacy model, validation, tests, build, local runtime,
Cloudflare deployment и публичный production smoke завершены.

Единственная неподтверждённая часть Definition of Done — управляемый
авторизованный production E2E с реальным сохранением контактов. Для его завершения
нужна доступная управляемая авторизованная вкладка; после этого следует выполнить
сценарии phone, email, hiding и publication, затем восстановить исходные настройки.
