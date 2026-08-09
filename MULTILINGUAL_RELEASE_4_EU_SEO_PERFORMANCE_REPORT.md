# SiteCraft Auto Market — Production GO, Multilingual Release 4

Дата: 9 августа 2026 года<br>
Основная папка: `sitecraft-auto-market`<br>
Единственная рабочая ветка: `main`

## Решение

**PRODUCTION GO для контрольной немецкой локали (`de`).**

Выполнены обязательные условия релиза: аддитивная схема Xano, строгие
локализованные публичные endpoints, проверка готовности переводов, SSR/SEO,
автовыбор языка устройства, sitemap, privacy-фильтрация, edge-cache и
production smoke-test в deployment workflow.

Это не означает массовую публикацию всех 29 настроенных локалей. В первом
безопасном релизе публичен только немецкий. Каждый следующий язык открывается
отдельно после полноты UI-словаря, переводов объявлений и собственного smoke-test.

## До Release 4

- `config.ts` и `locales.ts` задавали разные модели и разные default locale.
- Основной язык передавался через `?lang=`/`?locale=` и cookie.
- Middleware заменял текст уже готового HTML через `response.text()`.
- Browser-код обходил DOM и переводил найденные русские строки после загрузки.
- Немецкие страницы были физической копией `src/pages/de/**`.
- Canonical зависел от query, а hreflang мог ссылаться на несуществующий перевод.
- Sitemap был одним `urlset` и не масштабировался на 24+ языка.
- Detail мог блокировать первичный HTML дополнительными Xano-запросами.
- Release 3 использовал отдельные flags для одного языка.

## Обнаруженные проблемы

- две параллельные i18n-системы и закрытые TypeScript locale-union;
- смешивание query, cookie и pathname как SEO-источника языка;
- mixed-language initial HTML и лишняя серверная/браузерная работа;
- duplicate page implementations;
- неверная масштабируемость canonical, hreflang и sitemap;
- риск публикации fallback/stale translation;
- отсутствие отдельного строгого privacy-minimized Xano read contract;
- некэшируемый dynamic HTML (`cf-cache-status: DYNAMIC`);
- build workflow не включал новые global Release 4 flags;
- SEO builder заново собирал H1 из brand/model/year и терял reviewed title.

## Архитектура после

```text
Browser / Googlebot
  → /{locale}/...
  → Cloudflare Cache Rule + CDN
  → Astro SSR (locale registry + server dictionary)
  → strict locale-aware Xano endpoint
  → translation readiness/version/hash gate
  → localized initial HTML + metadata + JSON-LD
  → Cloudflare edge cache
```

## Что работает

### Единая языковая архитектура

- Реестр в `src/i18n/config.ts` содержит 29 локалей: 24 официальных языка ЕС,
  а также `ru`, `uk`, `tr`, `ar`, `zh-Hans`.
- Немецкий `de` — единственная публичная и индексируемая локаль текущего релиза.
- Английский, русский, украинский, турецкий, арабский, китайский и остальные
  языки активны для подготовки, но пока не создают публичных URL.
- Арабский уже имеет направление `rtl`; турецкий — `ltr`.
- Неизвестная или ещё не опубликованная локаль не показывает смешанный язык:
  прямой URL получает `404` и `no-store`.

### Язык устройства

Для корневой и старых публичных страниц middleware выбирает язык в порядке:

1. явный `?lang=`/`?locale=`;
2. сохранённый cookie переключателя;
3. `Accept-Language` устройства/браузера;
4. публичный English;
5. немецкий язык по умолчанию.

Сейчас публичен только `de`, поэтому немецкое устройство получает `/de/`, а
арабское, турецкое, Hindi или неизвестное устройство безопасно получает
немецкий fallback. После публикации `en`, `ar` или `tr` тот же алгоритм начнёт
выбирать их без изменения middleware.

Автотест проверяет `de-DE`, `ar-SA` и `hi-IN`. Locale-prefixed URL всегда имеет
приоритет: `/de/...` остаётся немецким независимо от cookie и языка устройства.

### Универсальные публичные URL

Работают единые динамические маршруты:

- `/{locale}/`;
- `/{locale}/cars/`;
- `/{locale}/cars/{slug}/`;
- `/{locale}/cars/brand/{brand}/`;
- `/{locale}/cars/brand/{brand}/{model}/`;
- `/{locale}/{sell|pricing|support|privacy|impressum}/`.

Старые физические копии `src/pages/de/**` удалены. Legacy catalog/detail URL
сохранены до появления ready target для каждого объявления. Временный `302`
используется только для root и полностью локализованных статических страниц.
Переход на `308` будет отдельным SEO-этапом после наблюдения в Search Console.

Redirect map текущего controlled rollout:

| Старый URL | Новый URL | Статус |
|---|---|---|
| `/` | `/de/` | временный `302` |
| `/cars/` | без изменения | legacy `200` до полного readiness |
| `/cars/{slug}/` | без изменения | legacy `200` до ready target |
| `/{pricing|sell|support|privacy|impressum}` | `/de/{same}/` | временный `302` |
| `/{nonpublic-locale}/...` | controlled not-found | `404`, `no-store` |

### Xano production

В live workspace Xano проверены таблицы и индексы:

- `locales` с уникальным `code`;
- `car_listing_translations` с уникальным
  `(car_listing_id, locale_code)`, status/hash индексами;
- `translation_jobs` с idempotency и queue индексами;
- поля source locale, source hash, version, readiness и timestamps в объявлениях.

Состояние публичного реестра Xano синхронизировано с frontend: публичен только
`de`; `ar` и `tr` оставлены активными, но непубличными до готовности данных.

Опубликованы отдельные строгие endpoints:

- `GET /public/locale/cars?lang={locale}`;
- `GET /public/locale/cars/{slug}?lang={locale}`.

Legacy `GET /cars` и `GET /cars/{slug}` не заменялись: экспериментальное
расширение было полностью откатано после обнаружения несовместимости старой
response-схемы. Это защищает действующий сайт от регрессии.

Строгие endpoints:

- возвращают только approved listing с готовым переводом нужной локали;
- проверяют locale, status, readiness, version и совпадение source hash;
- detail отдаёт `available_locales`;
- не раскрывают `user_id`, телефон, email, VIN, seller и AI/job payload;
- не вызывают runtime AI;
- возвращают `404` для непубличного языка, неизвестного slug или неготового
  перевода.

Контрольная немецкая запись: `audi-80-2026-75`. Готовность выбранного немецкого
sitemap — **1 из 1 (100%)**. Запись с переводом, но без listing-readiness,
публично не выдаётся.

### SSR, SEO и данные объявления

- Видимый текст, `<title>`, description и JSON-LD готовы в первом HTML.
- Исправлена потеря переведённого заголовка: SSR, H1, metadata и Vehicle JSON-LD
  используют `Audi 80 Baujahr 2026`, а не заново собранный исходный заголовок.
- `html lang="de" dir="ltr"`, self-canonical и `x-default` проверены HTTP-тестом.
- `hreflang` создаётся только для реально готовых `available_locales`.
- Detail делает один frontend-запрос Xano; related content не блокирует SSR.
- Runtime AI на публичном GET отсутствует.

### Sitemap и кэш

- `/sitemap.xml` — sitemap index.
- `/sitemaps/de.xml` содержит только строгие ready URL, включая brand, model и
  detail контрольного объявления.
- Непубличные локали отсутствуют в sitemap.
- Публичные страницы возвращают browser revalidation и отдельный
  `Cloudflare-CDN-Cache-Control` с TTL/SWR.
- В Cloudflare включено активное Cache Rule только для host
  `automarket.sitecraft.agency`, методов GET/HEAD и путей `/de/*`,
  `/sitemap.xml`, `/sitemaps/*`, `/robots.txt`.
- Legacy, auth, кабинет и API этим правилом не кэшируются.
- Повторный запрос `/sitemap.xml` подтверждён как `cf-cache-status: HIT`.

## Автоматическая проверка deployment

GitHub Actions на push в `main` выполняет:

1. `npm ci`;
2. проверку обязательных GitHub secrets/variables;
3. `npm run check`;
4. все unit/integration tests;
5. production build с Release 4 flags;
6. deploy в Cloudflare Pages project `sitecraft-auto-market`;
7. production HTTP smoke-test с повторами до распространения deployment;
8. обязательную проверку edge-cache HIT.

Smoke-test проверяет sitemap index, немецкий sitemap, home, catalog, brand,
model, detail, непубличный `404`, canonical, H1, JSON-LD, `lang/dir`, cache
headers, один detail query, готовый немецкий заголовок, hreflang и device-locale
redirects.

Локальный итог перед production deploy:

- `npm run check`: 0 ошибок, 0 предупреждений;
- `npm test`: 419 из 419 тестов пройдены;
- production build: успешно, 55 ссылок на assets проверены;
- Cloudflare Advanced Mode HTTP smoke-test: успешно для всех inventory routes;
- Xano strict read/privacy matrix: успешно;
- Cloudflare Cache Rule: активно, edge HIT подтверждён.

## Основные изменённые файлы

- `src/i18n/config.ts`, `locale.ts`, `locales.ts`, `publicListing.ts`,
  `publicRoutes.ts`, `release4.ts`, `staticPages.ts`;
- `src/pages/[locale]/**`, `src/pages/sitemap.xml.ts`,
  `src/pages/sitemaps/[locale].xml.ts`, `src/pages/robots.txt.ts`;
- `src/middleware.ts`, `src/layouts/BaseLayout.astro`, Header и LocaleSwitcher;
- `src/lib/xano.ts`, `publicCar.ts`, `listingTranslation.ts`,
  `publicCache.ts`, `seo/vehicleSeo.ts`;
- Cloudflare build/HTTP scripts и `.github/workflows/cloudflare-pages.yml`;
- Release 4 tests и Xano live contract в
  `docs/xano/multilingual-release-4/`.

Удалены только дублирующие page implementations `src/pages/de/**`; production
данные, auth и legacy endpoints не удалялись.

## Оставшиеся риски и ограничения

- Реальный контент Xano всё ещё содержит legacy taxonomy/city значения на
  русском; известные taxonomy значения переводятся словарём, неизвестные нужно
  постепенно нормализовать, не угадывая их значение.
- Проверка заголовков устройства автоматизирована, но физические iPhone/Android
  остаются полезным ручным UX-check после deployment.
- `302` намеренно не заменён на `308` до периода наблюдения и Search Console.
- `en`, `ar`, `tr` и остальные языки нельзя делать public до readiness gate.
- Массовая генерация переводов безопасна только асинхронным bounded batch через
  translation jobs; runtime и production-wide AI остаются выключенными.

## Следующий этап после GO

1. Наблюдать production логи и Search Console, не меняя `302` на `308` сразу.
2. Завершить английский UI/SEO и переводы данных; сделать `en` публичным.
3. Подготовить турецкий и арабский; отдельно проверить RTL интерфейс арабского.
4. Для каждого нового языка получить 100% readiness выбранного sitemap и пройти
   тот же production smoke-test.
5. После периода наблюдения утвердить постоянную redirect matrix и перейти на
   `308` без цепочек редиректов.

Ни ключи Xano, ни Cloudflare/GitHub tokens в репозиторий не добавлены.
