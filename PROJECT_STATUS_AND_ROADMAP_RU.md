# SiteCraft Auto Market: правдивое состояние и roadmap

Обновлено: 11 августа 2026 года

Production: <https://automarket.sitecraft.agency>

Предыдущий production baseline, от которого выполнен аудит: `main`, commit `30e76f7`

## Назначение документа

Это основной русскоязычный контекст проекта. В новом рабочем чате сначала читать этот файл, затем проверять `git status`, текущий commit `main`, последний GitHub Actions run и production.

Секреты, токены Xano, ключи Cloudflare и содержимое `.env` сюда не записываются.

## Правила workflow

- Единственная рабочая и публикуемая ветка — `main`; новую ветку без отдельного разрешения не создавать.
- Push в `main` запускает `.github/workflows/cloudflare-pages.yml`.
- Workflow выполняет установку, проверки, тесты, сборку и deploy Cloudflare Pages.
- Frontend release и Xano release — разные операции. Перед изменением Xano обязателен backup затрагиваемого endpoint или таблицы.
- Локальные `.env.local` и `.xano.mcp.token` исключены из Git.
- Наличие страницы или кнопки не означает наличие backend. Production-функцией считается только проверенный полный контракт.

## Архитектура

```mermaid
flowchart LR
  U["Пользователь"] --> CF["Cloudflare Pages / Astro"]
  CF --> PF["Pages Functions"]
  CF --> X["Xano API"]
  PF --> X
  PF --> R2["Cloudflare R2: фотографии"]
  X --> TR["Таблицы и очередь переводов"]
  GH["GitHub main"] --> CI["GitHub Actions"]
  CI --> CF
```

- Astro: страницы, UI, язык, SEO, клиентские сценарии.
- Xano: auth, объявления, модерация, кредиты, справочники и данные переводов.
- Cloudflare R2: фотографии объявлений.
- GitHub `main`: единственный источник production frontend.

## Статусы возможностей

| Статус | Значение |
| --- | --- |
| `WORKING` | Есть backend и рабочий пользовательский сценарий. |
| `PARTIAL` | Основной сценарий есть, но известны ограничения или незакрытые риски. |
| `LOCAL_UI` | Функция работает только в браузере/localStorage и не синхронизируется между устройствами. |
| `UI_PROTOTYPE` | Это макет будущей функции, не production-возможность. |
| `MISSING/HIDDEN` | Backend отсутствует; действие не должно быть доступно пользователю. |

## Что работает

### Marketplace и продавец

- `WORKING`: главная, каталог, карточки списка и страница автомобиля.
- `WORKING`: публичные автомобили из Xano, связанные объявления и объявления продавца.
- `WORKING`: регистрация/вход, кабинет, контакты продавца, избранное.
- `WORKING`: ручное создание объявления, загрузка фото в R2, сохранение и отправка на модерацию.
- `WORKING`: AI-анализ фото, AI-черновик и отправка AI-черновика на модерацию.
- `WORKING`: редактирование и удаление собственного объявления.
- `WORKING`: модерация — approve, reject, block, delete, sold.
- `WORKING`: продвижение объявления за внутренние кредиты через `/dashboard/listings/{id}/promote`.
- `WORKING`: баланс и история кредитных операций.

### Deal Finder

- `WORKING`: лента, статистика, карточка, просмотр, save/unsave, hide/restore и перевод описания.
- `PARTIAL`: AI analyze не имеет подтверждённой единой политики списания кредита.
- `PARTIAL`: профили поиска читаются с сервера, но создание/редактирование/удаление backend пока отсутствуют.
- `LOCAL_UI`: workspace, comparison и notification settings используют локальное состояние браузера. Это не серверная синхронизация.

### Production и доставка

- `WORKING`: GitHub Actions → Cloudflare Pages.
- `WORKING`: фотографии через Cloudflare R2.
- `WORKING`: device-language resolver на первом посещении.

Полный реестр backend: [`docs/xano/CURRENT_ENDPOINT_MANIFEST_RU.md`](docs/xano/CURRENT_ENDPOINT_MANIFEST_RU.md).

## Правдивое состояние мультиязычности

### Выбор языка устройства уже работает

Устаревшее утверждение «язык устройства не определяется» удалено. Production повторно проверен 11 августа 2026 года:

| Вход | Результат |
| --- | --- |
| `Accept-Language: de-DE,de` | `lang="de"`, LTR |
| `Accept-Language: ru-RU,ru` | `lang="ru"`, LTR |
| `Accept-Language: tr-TR,tr` | `lang="tr"`, LTR |
| неизвестный `hi-IN,hi` | fallback `lang="en"`, LTR |
| арабский | resolver и тесты выбирают `ar`, HTML использует RTL |

Приоритет выбора:

1. валидный явный `?lang=` или locale-prefixed URL;
2. ручной выбор, сохранённый в cookie;
3. первый поддерживаемый язык из `Accept-Language`;
4. английский для неизвестной ситуации.

Ручной выбор сохраняется при переходах и не должен сбрасываться на английский.

### Языковые уровни нельзя смешивать

- В frontend настроено 29 локалей.
- Полностью вручную проверяемый UI-пакет сейчас есть для `de`, `ru`, `uk`, `en`, `ar`, `tr`, `fr`.
- Остальные европейские локали присутствуют в selector/URL, но значительная часть UI использует английский fallback. Их нельзя называть полностью переведёнными.
- Xano-данные сейчас поддерживают только шесть локалей: `de`, `ru`, `uk`, `en`, `ar`, `tr`.
- `GET /cars?lang=` отвечает 200 для этих шести языков и 400 для `fr`.
- Strict Release 4 endpoint `/public/locale/cars?lang=de` существует, но 11 августа вернул пустой список; strict detail для legacy slug вернул 404. Значит strict data contract ещё `PARTIAL`.
- Индексируемые locale-prefixed SEO-страницы сейчас полноценно выпущены только для немецкого `/de/`; `/fr/` пока 404.

Итог: язык оболочки определяется и переключается, но «29 полностью переведённых языков с переведёнными данными» ещё не готово.

## UI-прототипы и скрытые действия

В рамках этапа 1 UI приведён в соответствие с backend:

- скрыта навигация в кабинет дилера; direct-страница явно помечена `UI-прототип` и ничего не сохраняет;
- на pricing скрыты кнопки покупки и выбора Dealer Plan; страница не заявляет, что checkout доступен;
- скрыта покупка AI-кредитов из формы объявления;
- payment success больше не предлагает применить несуществующую покупку;
- в модерации скрыты archive/restore и добавление/удаление/назначение главного фото, потому что endpoints отсутствуют;
- admin dealers, purchases и paid products явно помечены как прототипы и не делают запросы к отсутствующим endpoints.

Рабочие действия не скрыты: создание объявления, модерация approve/reject/block/delete/sold, избранное, Deal Finder actions и продвижение за внутренние кредиты остаются доступны.

## Что не закончено

### Мультиязычные данные

- Не завершён массовый перевод свободных текстов объявлений и справочников.
- После canary-проверки одной translation job оставшаяся очередь не зафиксирована как полностью обработанная.
- Нужно повторно инвентаризировать `translation_jobs`, зависшие статусы и неизвестные legacy-значения.
- Нет полного Xano data contract для `fr` и остальных европейских языков.
- Нет locale-prefixed SEO routes, canonical/hreflang и sitemap для всех готовых локалей.

### Backend-продукты

- Нет checkout, webhook, purchase state machine, refund/reconciliation.
- Нет dealer profile, dealer subscription и server-side entitlement.
- Нет moderation archive/restore и CRUD изображений модератором.
- Нет серверных записей Deal Finder workspace/comparison/notifications/inbox/sync logs и write-контрактов search profiles.

### Качество и безопасность

- Нужны rate limits и бюджеты для публичных/provider-backed AI endpoints.
- Нужен единый ledger и политика списаний AI-кредитов.
- Нужен автоматический contract test, сравнивающий frontend routes с экспортом Xano.
- Защищённые endpoints из реестра нужно периодически проверять отдельным staging/integration suite, а не только статическими тестами frontend.

## Следующий план

### Этап 2 — закрыть мультиязычный data contract

1. Получить свежий export Xano endpoints и таблиц, сверить его с текущим реестром.
2. Проверить `translation_jobs`: queued/running/failed/completed, source hash, locale и идемпотентность.
3. Повторить canary на одном безопасном объявлении и проверить запись + публичное отображение.
4. Выпустить пакетную обработку сначала для шести Xano-языков.
5. Инвентаризировать неизвестные значения справочников без молчаливой подмены.
6. Добавлять новую Xano-локаль только вместе со справочниками, свободными текстами, fallback и тестами.

### Этап 3 — SEO локалей

1. Сделать strict catalog/detail непустыми и стабильными.
2. Выпускать locale-prefixed маршруты по одному проверенному языку.
3. Для каждого языка одновременно добавить canonical, hreflang и sitemap.
4. Не индексировать язык, пока его UI и данные используют массовый английский fallback.

### Этап 4 — server-backed функции

1. Выбрать следующий продукт: commerce/dealer либо Deal Finder collaboration.
2. Сначала описать Xano schema, auth, idempotency, error contract и тесты.
3. Выпустить backend и проверить negative cases.
4. Только после этого показывать кнопку в production UI.

## Условия Production Go для новой функции

- Есть документированный Xano endpoint с ID, method, path и auth.
- Frontend не подменяет server authorization.
- Ошибки конкретны и ведут пользователя к исправлению.
- Мутации идемпотентны там, где возможен повторный запрос.
- Есть автоматические тесты и production smoke без изменения реальных данных, если это возможно.
- Документация и endpoint manifest обновлены в том же release.

## Инструкция для нового чата

> Прочитай `PROJECT_STATUS_AND_ROADMAP_RU.md` и `docs/xano/CURRENT_ENDPOINT_MANIFEST_RU.md`. Затем проверь `git status`, commit ветки `main`, последний GitHub Actions deploy и production. Не создавай новую ветку. Не считай UI-прототип backend-функцией и не показывай пользователю действие до выпуска проверенного endpoint.

Этот документ фиксирует состояние на дату обновления, но не заменяет повторную проверку production.
