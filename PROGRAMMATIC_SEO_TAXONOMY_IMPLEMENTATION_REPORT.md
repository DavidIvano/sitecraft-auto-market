# Programmatic SEO Taxonomy Implementation Report

Дата: 20 августа 2026 г.
Ветка: `main`
Исходный commit: `80efdb1`
Production origin: `https://automarket.sitecraft.agency`

## 1. Состояние до изменений

В проекте уже существовали:

- SSR-маршруты объявления, бренда, модели и города;
- общий компонент `LocalizedTaxonomyCatalog.astro`;
- динамический sitemap index `/sitemap.xml` и локальные sitemap `/sitemaps/{locale}.xml`;
- locale registry с 28 публичными SEO-локалями;
- canonical, `hreflang`, `x-default` и `<html lang>` в общем layout;
- `Vehicle`, `Offer` и `BreadcrumbList` JSON-LD на странице объявления;
- централизованная vehicle taxonomy со стабильными кодами топлива и кузова;
- строгая проверка готовности перевода объявления перед публичной индексацией.

Brand/model/city-маршруты при этом независимо загружали полный каталог и фильтровали его в Astro. URL строились преимущественно из отображаемых строк. Общего indexability gate, фиксированных ценовых bucket, region/fuel/body/price landing pages, пагинации и полной HTML-перелинковки не было. Произвольные query-фильтры каталога могли наследовать индексируемое состояние основной страницы.

## 2. Найденные проблемы

- Повторяющаяся route-логика brand/model/city и разные правила существования страницы.
- Отсутствие централизованного порога качества: тонкие города могли индексироваться наравне с наполненными страницами.
- Разные регистры и локализованные варианты города могли создавать разные URL-сущности.
- Отсутствие стабильных SEO routes для региона, топлива, кузова и цены.
- Sitemap не знал о новых типах таксономий и не применял общий gate.
- На detail page не было полного crawlable-графа `brand → model`, `city → region`, fuel, body и price.
- Taxonomy pages не содержали полезных related links и crawlable pagination.
- Пользовательские filter query не были архитектурно отделены от SEO landing pages.
- Повторные запросы одного локализованного каталога в пределах Worker instance не использовали fresh/stale cache.
- Текущий Xano public catalog endpoint возвращает полный каталог; это приемлемо для сегодняшнего объёма, но не для 10 000–100 000+ объявлений.

## 3. Изменённые и добавленные файлы

Главный общий слой:

- `src/lib/seo/taxonomies.ts` — типы, нормализация, fixed price buckets, metadata, gate, paths, breadcrumbs, related links и listing links;
- `src/lib/seo/taxonomyPage.ts` — чистый route resolver, canonical redirect, 404/noindex, пагинация;
- `src/lib/seo/taxonomyRoute.ts` — один загрузчик каталога для SSR-маршрутов;
- `src/lib/seo/locationSeo.ts` — canonical city aliases и безопасный registry регионов Германии.

Маршруты и UI:

- `src/pages/[locale]/cars/[taxonomy]/[slug].astro`;
- `src/pages/[locale]/cars/brand/[brand].astro`;
- `src/pages/[locale]/cars/brand/[brand]/[model].astro`;
- `src/pages/[locale]/cars/city/[city].astro`;
- `src/pages/[locale]/cars/[slug].astro`;
- `src/pages/[locale]/cars/index.astro`;
- `src/pages/cars/index.astro`;
- `src/components/catalog/LocalizedTaxonomyCatalog.astro`;
- `src/components/catalog/SeoTaxonomyLinks.astro`;
- `src/styles/components/catalog.css`.

SEO, данные и инфраструктура:

- `src/pages/sitemaps/[locale].xml.ts`;
- `src/layouts/BaseLayout.astro`;
- `src/lib/seo/vehicleSeo.ts`;
- `src/lib/publicCache.ts`;
- `src/lib/xano.ts`;
- `src/lib/publicCar.ts`;
- `src/lib/types.ts`;
- `src/i18n/publicListing.ts`;
- `scripts/http-public-seo-integration.mjs`.

Тесты:

- `tests/programmatic-seo-taxonomies.test.ts`;
- `tests/public-taxonomy-ssr.test.ts`;
- `tests/multilingual-release-stage3.test.ts`.

## 4. Добавленные и унифицированные routes

Все маршруты универсальны для `/{locale}/...`; отдельных деревьев на каждый язык нет.

- `/{locale}/cars/brand/{brand_slug}/`
- `/{locale}/cars/brand/{brand_slug}/{model_slug}/`
- `/{locale}/cars/city/{city_slug}/`
- `/{locale}/cars/region/{region_slug}/`
- `/{locale}/cars/fuel/{fuel_code}/`
- `/{locale}/cars/body/{body_code}/`
- `/{locale}/cars/price/{price_bucket}/`

Новые `region`, `fuel`, `body` и `price` обслуживаются одним generic route. Brand/model/city переведены на тот же resolver без изменения назначения публичных страниц.

Неканонический регистр и legacy display slug, если сущность может быть однозначно определена, получают один прямой `301` на canonical URL. Например `/de/cars/brand/Audi/` перенаправляется на `/de/cars/brand/audi/`. Неизвестное значение возвращает настоящий `404`, а не soft 404.

## 5. Поддерживаемые taxonomy

Поддерживаются семь SEO-типов:

1. brand;
2. model, связанная с brand;
3. city, связанный с region;
4. region;
5. fuel;
6. body;
7. price.

Price URL ограничены централизованным списком:

- `under-3000`;
- `under-5000`;
- `under-10000`;
- `10000-20000`;
- `20000-30000`;
- `30000-plus`.

Произвольные значения `price_min`/`price_max` не создают SEO pages.

## 6. Indexability thresholds

Пороговые значения находятся в `SEO_TAXONOMY_MIN_LISTINGS`:

| Entity | Минимум публичных локализованных объявлений |
|---|---:|
| Brand | 1 |
| Model | 1 |
| City | 3 |
| Region | 3 |
| Fuel | 3 |
| Body | 3 |
| Price | 3 |

Для taxonomy page требуется одновременно:

- strict/public locale;
- существующая нормализованная сущность;
- хотя бы одно объявление, иначе `404`;
- количество объявлений не ниже порога;
- доступный локализованный label;
- отсутствие preview noindex и произвольных filter query.

Страница существующей, но тонкой сущности доступна для UX с `noindex, follow` и отсутствует в sitemap. Пустая или неизвестная сущность возвращает `404` с fail-closed robots headers. Объявления продолжают использовать существующий более строгий gate: approved/public listing, валидный slug, public locale и готовый, не stale/fallback перевод.

## 7. Нормализация

На frontend/backend boundary добавлена поддержка аддитивных полей:

- `brand_id`, `brand_slug`;
- `model_id`, `model_slug`;
- `city_id`, `city_slug`;
- `region_id`, `region_slug`, `region`;
- `postal_code`.

Если Xano уже возвращает стабильный slug, он имеет приоритет. Для legacy records используется детерминированный normalization layer. Legacy поля не удалялись и production data не переписывались.

Fuel и body используют существующие стабильные backend codes и существующий multilingual taxonomy label registry. Поэтому URL остаётся `/fuel/petrol/`, а видимая подпись локализуется как `Benzin`, `Petrol`, `Бензин` и т. д.

Города приводятся к единому canonical identity независимо от регистра; тесты покрывают `Peine`, `peine`, `PEINE`. Для известных legacy-вариантов добавлены явные aliases, включая `Ilsede` и русские написания. Регион не угадывается по произвольной строке: используется аддитивный Xano region slug либо безопасное точное сопоставление известного города. Это исключает ошибочные SEO-регионы.

## 8. Internal linking

Detail page теперь server-side выводит обычные `<a href>` на доступные сущности объявления:

- brand;
- model;
- city;
- region;
- fuel;
- body;
- основной фиксированный price bucket.

Taxonomy pages и основной локализованный каталог показывают related groups, построенные из того же набора данных без дополнительных запросов. Ссылка появляется только если целевая сущность существует, пересекается по реальным объявлениям и проходит indexability gate. Для каждого типа действует ограничение числа ссылок, чтобы HTML не разрастался бесконтрольно.

В результате Googlebot может пройти по SSR HTML от объявления к model/brand, city/region, fuel, body и price и вернуться через карточки релевантных объявлений.

## 9. Sitemap

Сохранена существующая архитектура:

```text
/sitemap.xml
└── /sitemaps/{locale}.xml
```

Локальный sitemap теперь строит единый taxonomy graph из одного локализованного Xano response и добавляет brand, model, city, region, fuel, body и price только через общий indexability gate. `lastmod` таксономии берётся из самого свежего подходящего объявления.

В sitemap отсутствуют:

- thin/noindex taxonomy;
- пустые и неизвестные taxonomy;
- query URL;
- произвольные комбинации фильтров;
- непубличные locale routes;
- объявления со stale/fallback/unready переводом.

На актуальных немецких данных smoke test обнаружил индексируемые страницы для 6 брендов, 10 моделей, города `ilsede`, региона `niedersachsen`, топлива `petrol` и `diesel`, кузова `hatchback`, а также price buckets `under-3000`, `under-5000`, `under-10000`. `suv` отсутствует, поэтому `/de/cars/body/suv/` корректно возвращает `404` и не попадает в sitemap.

## 10. Canonical, hreflang и metadata

- Каждая taxonomy page имеет self canonical; page 1 не дублируется через `?page=1`.
- Canonical страницы пагинации включает только `?page=N`.
- Произвольный query-filter получает `noindex, follow`, но canonical указывает на чистую SEO landing page.
- `hreflang` публикуется только для локалей, где эквивалентная сущность имеет достаточное число готовых локализованных объявлений.
- `x-default` соответствует текущей default-locale архитектуре и не публикуется для noindex taxonomy.
- H1, title и description формируются детерминированно из типа, локализованного label, количества объявлений и номера страницы.
- OpenGraph использует те же уникальные title, description и canonical через `BaseLayout`.
- Никакой runtime AI на публичном GET не используется.

`BreadcrumbList` совпадает с canonical hierarchy:

- listing: Home → Cars → Brand → Model → Listing;
- model: Home → Cars → Brand → Model;
- city: Home → Cars → Region → City;
- brand/region/fuel/body/price: Home → Cars → Entity.

`Vehicle` и `Offer` JSON-LD на detail сохранены. На taxonomy cards не создаётся массив `Vehicle` schema; используется компактный `CollectionPage` + `ItemList` и отдельный `BreadcrumbList`.

## 11. Xano changes

Production Xano schema и данные не изменялись. API compatibility сохранена.

Frontend normalizer готов принимать новые canonical ID/slug/region fields, когда они будут добавлены в Xano. Для локализованного каталога добавлен in-memory fresh/stale cache и coalescing параллельных запросов; публичный контракт ответа не изменён.

Рекомендуемые аддитивные endpoints для следующего масштаба:

```text
GET /public/locale/taxonomy/{type}/{slug}?lang={locale}&page={page}&limit={limit}
GET /public/locale/taxonomies/counts?lang={locale}
GET /public/locale/taxonomy/{type}/{slug}/related?lang={locale}
```

Ответы должны содержать canonical IDs/slugs, total, bounded listing page, готовность переводов и агрегированные related counts. Старый catalog endpoint следует сохранить на период миграции.

## 12. Performance implications

- Один Xano catalog request строит карточки, counts, related groups и sitemap taxonomy; N+1 запросов нет.
- Повторные localized catalog reads в Worker instance используют fresh/stale cache и один общий in-flight promise.
- SSR ограничен 24 карточками на taxonomy page.
- Pagination использует crawlable HTML links и не пытается отдать десятки тысяч карточек одним response.
- Related links вычисляются из уже загруженного graph.
- Публичные cache headers и Cloudflare edge-cache policy сохранены.
- Новые страницы не добавляют client-side framework или runtime AI.

Оставшееся ограничение: текущий public Xano endpoint всё ещё передаёт Astro весь локализованный каталог. Для десятков тысяч объявлений нужно перейти на предложенные server-side listing/count/related endpoints. Новый общий resolver позволяет сделать это без изменения URL и UI-контракта.

## 13. `npm run check`

Результат: успешно.

```text
Result (316 files):
- 0 errors
- 0 warnings
- 20 hints
```

Hints относятся к существующим deprecated/unused API и не появились как блокирующие ошибки этой реализации.

## 14. Tests

Результат `npm test`: успешно.

```text
tests 490
pass 490
fail 0
duration ~2.99 s
```

Новые тесты проверяют routes, thresholds, 404, thin-page noindex, canonical redirects, locale/hreflang contracts, BreadcrumbList, SSR cards, SSR related links, fixed price buckets, sitemap eligibility, normalization регистра и защиту query filters.

## 15. Build и production-style smoke

`npm run build`: успешно.

```text
Astro server build: success
Cloudflare Worker compilation: success
Advanced Mode bundle: success
Verified 55 built asset references from 90 SSR Worker files
```

`HTTP_TEST_LOCALES=de npm run test:http:local`: успешно после передачи локальных Xano env variables в Wrangler.

- 44 URL проверены через собранный Cloudflare Pages Worker;
- все URL немецкого sitemap получили ожидаемые status, canonical и robots;
- проверены JSON-LD type, H1, SSR cards, self hreflang и x-default;
- sitemap index, locale sitemap и legacy inventory доступны;
- `/de/cars/brand/Audi/` → один `301` на lowercase canonical;
- `/de/cars/region/niedersachsen/` → `200`, index;
- `/de/cars/fuel/petrol/` → `200`, index;
- `/de/cars/body/hatchback/` → `200`, index;
- `/de/cars/body/suv/` → `404`, так как реальной indexable сущности нет;
- `/de/cars/price/under-5000/` → `200`, index;
- `/de/cars/fuel/petrol/?transmission=automatic` → `200`, `noindex, follow`, clean canonical;
- `/sitemap.xml`, `/sitemaps/de.xml`, `/robots.txt` → `200`.

## 16. Оставшиеся риски

1. Xano должен со временем хранить canonical IDs/slugs и region explicitly; legacy normalization не должен становиться постоянной заменой data model.
2. Без server-side taxonomy endpoint объём полного catalog response станет узким местом при 10 000+ объявлений.
3. Текущий безопасный city→region registry содержит только подтверждённые соответствия. Новые города без `region_slug` намеренно не получат region SEO link до расширения данных.
4. Полный localized catalog page всё ещё использует существующий режим загрузки каталога; отдельная bounded pagination API нужна на следующем этапе масштабирования.
5. Сборка сохраняет существующее предупреждение Vite о chunk > 500 kB. Оно не вызвано taxonomy SSR HTML, но требует отдельного bundle/performance этапа.
6. Production URL не проверялся на новые routes до deployment, потому что текущая задача изменяет только локальный `main`; smoke выполнен на production-equivalent Cloudflare Worker с актуальными Xano данными.

## 17. Следующий SEO-этап

1. Аддитивно добавить в Xano canonical taxonomy tables/fields и безопасно backfill IDs/slugs/regions с dry-run и collision report.
2. Реализовать bounded taxonomy listings, counts и related endpoints; включить их за feature flag и сохранить fallback на текущий endpoint.
3. Добавить cache tags и selective purge при публикации/снятии объявления, чтобы taxonomy counts быстро обновлялись.
4. Подключить Google Search Console и отслеживать indexed/not indexed, crawl stats, duplicate canonical и soft 404 по каждому taxonomy type.
5. После накопления данных пересматривать thresholds по реальному search demand и качеству inventory, не снижая их ради количества URL.
6. Добавлять новые curated landing types только при наличии устойчивой taxonomy и достаточного inventory; не индексировать произвольные filter combinations.
