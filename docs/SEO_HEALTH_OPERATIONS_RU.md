# SEO Health: эксплуатация и оповещения

Обновлено: 22 августа 2026 года

Этот документ описывает управляемый production-контур продвижения SiteCraft Auto Market: Search Console, Xano materializer, sitemap, автоматический аудит и уведомления.

## Что уже работает

- URL-prefix property: `https://automarket.sitecraft.agency/`.
- Production sitemap: `https://automarket.sitecraft.agency/sitemap.xml`.
- Search Console обработал sitemap index 22 августа 2026 года со статусом «Успешно» и обнаружил 1 282 страницы.
- Базовые показатели Search Console за последние 28 дней на момент проверки: 7 кликов, 40 показов, CTR 17,5%, средняя позиция 23,6.
- Xano `GET /seo/internal/health` отдаёт server-only snapshot очереди и активной materialized generation.
- Администратор получает единую панель `/admin/seo-health/`.
- `.github/workflows/seo-health.yml` ежедневно запускает read-only аудит production.

## Архитектура

1. Мутации объявления и готовность перевода создают идемпотентное событие в `seo_refresh_queue`.
2. Cloudflare Worker забирает пакет, собирает immutable generation и активирует её только при parity 28 × N.
3. Xano health endpoint сообщает состояние очереди, manifests и materialized таблиц, не отдавая секреты и приватные данные объявления.
4. Cloudflare Pages Function `/api/admin/seo-health` проверяет Xano, production sitemap и, после подключения service account, Search Console API.
5. Страница `/admin/seo-health/` доступна только роли `admin` и ничего не изменяет.
6. GitHub Actions независимо проверяет каждый из 28 locale sitemap, первый detail URL, canonical, self-hreflang и schema.

## Пороговые состояния dashboard

| Проверка | Healthy | Warning | Critical |
| --- | --- | --- | --- |
| Очередь | Нет exhausted и actionable job моложе 30 минут | Старейшее actionable job 30–60 минут | Exhausted job, актуальная failed после последнего completed или backlog старше 60 минут |
| Generation | Ровно 28 manifests, одна generation, одинаковое N и `listing_index = 28 × N` | — | Любое нарушение parity |
| Sitemap | HTTP 200, 28 locale maps, не менее 28 listing shards | — | Недоступность или неполный index |
| Search Console | API подключён, sitemap найден, errors = 0 | Service account не подключён или есть предупреждение sitemap | Настроенный API не отвечает |

Историческая failed-запись не считается текущей ошибкой, если после неё есть более новый успешный completed.

## Автоматический аудит

Локальный запуск:

```bash
npm run seo:health
```

Отчёт сохраняется в `artifacts/seo-health/latest.json`. Скрипт:

- соблюдает паузу между production-запросами;
- повторяет только временные `429/502/503/504`;
- не выполняет мутаций;
- требует один generation ID во всех 28 listing shards;
- проверяет `Product + Car + Offer + BreadcrumbList` и отсутствие `noindex` на detail.

GitHub workflow выполняется ежедневно в 03:17 UTC. При нарушении он:

1. сохраняет JSON artifact на 30 дней;
2. создаёт один issue `[SEO Health] Production audit requires attention` либо добавляет комментарий в существующий;
3. завершает run ошибкой, чтобы проблема была заметна в Actions.

## Подключение Search Console API

Код уже использует официальный read-only scope `https://www.googleapis.com/auth/webmasters.readonly`. Для завершения подключения нужен отдельный Google service account.

1. В Google Cloud создать service account и JSON key. Это постоянная учётная запись; создавать её только с явным разрешением владельца.
2. Email service account добавить пользователем URL-prefix property `https://automarket.sitecraft.agency/` с правом чтения.
3. Полный JSON сохранить как encrypted secret `GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON`:
   - в Cloudflare Pages production;
   - в GitHub Actions repository secrets.
4. Установить `GOOGLE_SEARCH_CONSOLE_SITE_URL=https://automarket.sitecraft.agency/`.
5. Проверить dashboard, затем установить GitHub variable `SEO_HEALTH_REQUIRE_SEARCH_CONSOLE=true`.

JSON key нельзя записывать в `.env.example`, документацию, commit, issue или artifact.

## Recovery очереди

- `POST /seo/internal/queue/recover-exhausted` возвращает исчерпанные pending jobs в очередь и безопасен при повторе.
- `POST /seo/internal/queue/reconcile-active` закрывает orphaned processing jobs, которые уже покрыты активной generation.
- Оба маршрута доступны только с server secret и не вызываются из браузера.
- Нормальное завершение, checkpoint и fail теперь выбирают пакет по `worker_id`, поэтому соседнее выполнение не может изменить чужие jobs.

Перед ручным recovery сначала сохранить health snapshot и убедиться, что Worker не выполняет активный пакет. После recovery проверить `pending`, дождаться activation и подтвердить `pending=0`, `processing=0`, `exhausted=0`.

## Следующее развитие

1. Завершить service account и обязательный Search Console API gate.
2. Добавить недельную динамику запросов и landing pages: клики, показы, CTR, позиция, новые и потерянные запросы.
3. Подключить Index Coverage/URL Inspection для выборочной сверки новых и изменённых карточек, не пытаясь принудительно индексировать каждую страницу.
4. Добавить Core Web Vitals и алерт по падению производительности.
5. Подключить внешний канал оповещений поверх GitHub issue: email, Telegram или Slack.

Главный принцип: sitemap и индексирование не являются разовой публикацией. Каждая публичная мутация должна пройти цепочку `Xano → materializer → sitemap → canonical page → Search Console metrics` и быть видимой в health dashboard.
