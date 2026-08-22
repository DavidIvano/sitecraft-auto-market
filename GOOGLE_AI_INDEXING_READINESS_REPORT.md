# Google & AI Search Indexing Readiness Report

Дата аудита: 22 августа 2026 г.
Production: `https://automarket.sitecraft.agency`

## 1. Реальное состояние Google Search Console

Проверка выполнена в подтверждённом URL-prefix property production-домена.

- Sitemap `/sitemap.xml` отправлен и обработан Google 22 августа 2026 г.
- Статус sitemap: **Успешно**.
- Выявлено Google через sitemap: **1 282 URL**.
- Индексируется: **75 страниц**.
- Не индексируется: **931 страница** по состоянию отчёта от 17 августа 2026 г.
- Разбивка исключений:
  - 891 — обнаружено, но пока не проиндексировано;
  - 27 — просканировано, но пока не проиндексировано;
  - 4 — `noindex`;
  - 3 — `404`;
  - 3 — заблокировано `robots.txt`;
  - 3 — вариант страницы с canonical.
- Ручные меры: **проблем нет**.
- Проблемы безопасности: **проблем нет**.
- HTTPS: production работает по HTTPS; Search Console не показывает HTTP-ошибок.

Главный вывод: сайт не находится под санкциями и sitemap принимается. Текущая проблема — большое число недавно открытых мультиязычных URL, конкурирующие legacy-сигналы и недостаточный приоритет обхода, а не запрет Googlebot.

## 2. Найденные технические проблемы

### Некорректный `lastmod`

Taxonomy sitemap получал от Xano Unix timestamp в миллисекундах и печатал его как:

```xml
<lastmod>1786831248000</lastmod>
```

Это не соответствует формату sitemap. Google мог игнорировать сигнал свежести.

### Устаревший `SearchAction`

Глобальная JSON-LD разметка создавала шаблон:

```text
?q={search_term_string}
```

Именно этот буквальный URL уже появился в Search Console как canonical-вариант. Разметка удалена, потому что она создаёт crawl trap и больше не даёт полезного поискового результата.

### Нестабильный `x-default`

Homepage, каталог, listing и static pages указывали `x-default` на нелокализованные маршруты (`/`, `/cars/`, `/cars/{slug}/`). Эти страницы зависят от query/cookie language и становились дополнительными членами canonical-кластера.

Теперь `x-default` всегда ведёт на стабильный эквивалент default locale `de`, например:

```text
/en/cars/audi-a3-1/ -> x-default /de/cars/audi-a3-1/
```

### Legacy-ссылки в общей навигации

Footer и cookie notice на локализованных страницах ссылались обратно на `/cars`, `/privacy`, `/pricing` и другие legacy URL. Footer также публично ссылался на `/dashboard` и `/admin/moderation`, из-за чего Google обнаруживал закрытые служебные маршруты.

Теперь публичные ссылки сохраняют текущую locale, а admin/dashboard удалены из публичного footer.

### Старые brand/model URL

Legacy URL с исходным регистром или пробелами, например `/cars/brand/Audi/` и `/cars/brand/Mercedes-Benz/A 170/`, могли завершаться 404. Для реально существующих facets они теперь нормализуются и одним постоянным `308` перенаправляются на локализованный canonical. Несуществующие facets по-прежнему возвращают настоящий 404.

### Слишком широкая подача utility pages в sitemap

Для каждого из 28 языков sitemap подавал также sell, pricing, support, privacy и impressum. Несколько таких страниц уже появились в группе «просканировано, но не проиндексировано».

Эти страницы остаются доступными обычными HTML-ссылками, но sitemap теперь использует только два seed URL на locale:

- `/{locale}/`;
- `/{locale}/cars/`.

Остальные URL sitemap — реальные индексируемые taxonomies и объявления, прошедшие существующие gates.

## 3. Реализованные изменения

- `src/lib/seo/sitemapPolicy.ts`
  - централизован список приоритетных seed pages.
- `src/lib/seo/sitemapXml.ts`
  - финальная нормализация всех `lastmod` в ISO 8601.
- `src/lib/seo/taxonomyApi.ts`
  - нормализация и fail-closed проверка `lastmod` на Xano boundary.
- `src/pages/sitemaps/[locale].xml.ts`
  - utility pages исключены из sitemap; inventory/taxonomy architecture сохранена.
- `src/i18n/routes.ts`
  - единый stable default-locale path для `x-default`.
- локализованные homepage/catalog/listing/static/taxonomy routes
  - `x-default` больше не создаёт legacy-дубликаты.
- `src/components/Footer.astro`
  - locale-aware публичные ссылки; admin/workspace links удалены из crawlable footer.
- `src/components/CookieNotice.astro`
  - locale-aware privacy URL.
- `src/layouts/BaseLayout.astro`
  - удалён crawl-trap `SearchAction`;
  - `WebSite` связан с реальным publisher через `@id`;
  - отдельно описан бренд SiteCraft Auto Market и издатель SiteCraft Agency.
- `src/pages/robots.txt.ts`
  - явно разрешён `OAI-SearchBot` для ChatGPT Search;
  - private/auth/payment routes остались закрыты;
  - Googlebot продолжает получать публичный сайт через wildcard `Allow`.
- legacy brand/model routes
  - постоянный one-hop redirect только после подтверждения существования facet.
- `package-lock.json`
  - совместимо обновлены Cloudflare/Wrangler и транзитивные зависимости;
  - устранены найденные `npm audit` уязвимости в `js-yaml`, `nanoid` и `undici`.

## 4. Подготовка к AI search

Для Google AI Overviews/AI Mode не требуется отдельный AI-файл или специальная разметка: используются обычная индексация, доступный текст, корректный canonical и соответствующая видимому контенту structured data.

Для ChatGPT Search явно разрешён `OAI-SearchBot`. Политика обучения отделена от поисковой доступности: Cloudflare в production сейчас запрещает training crawlers, но разрешает search/reference. Это не мешает участию в ChatGPT Search при доступном `OAI-SearchBot`.

Файл `llms.txt` намеренно не добавлен как «SEO-фактор»: нет подтверждения, что он повышает позиции Google или является обязательным для AI search. Приоритет отдан индексируемому SSR HTML, publisher identity, sitemap, canonical, hreflang и реальным данным автомобилей.

## 5. Что не изменялось

- Xano production schema и данные не переписывались.
- Существующие listing/taxonomy quality gates сохранены.
- `Vehicle`, `Offer` и `BreadcrumbList` на listing pages сохранены.
- Произвольные фильтры остаются `noindex,follow` и не попадают в sitemap.
- Protected routes остаются закрыты от поисковых ботов.
- Публикация в GitHub/Cloudflare в рамках этого аудита не выполнялась.

## 6. Проверки

- `npm run check`: **успешно**, 0 ошибок; 22 существующих Astro hints без блокирующих диагностик.
- `npm test`: **успешно**, 532/532 теста пройдены.
- `npm run build`: **успешно**, Cloudflare Worker собран; проверено 56 asset references из 100 SSR Worker files.
- `npm audit --omit=dev`: **0 уязвимостей** после совместимого обновления lockfile.
- local production-like HTTP smoke с публичным Xano inventory: **успешно** для sitemap index, locale sitemap, listing shard, `/de/`, `/de/cars/`, реального объявления и существующих brand/model/city/region/fuel/body/price taxonomies.
- production smoke текущей опубликованной версии: **успешно**; это baseline до данного локального набора изменений, поэтому новая версия потребует повторного smoke после deploy.

## 7. Действия после публикации

1. Проверить новый production `robots.txt`, locale sitemap и несколько canonical pages.
2. Убедиться, что taxonomy `lastmod` стал ISO 8601.
3. Повторно проверить `/de/`, `/de/cars/` и одно объявление через URL Inspection.
4. После подтверждения production не отправлять сотни URL вручную — sitemap уже зарегистрирован и успешно обрабатывается.
5. Запустить validation только для действительно исправленных legacy/noindex групп.
6. Через 7–14 дней сравнить discovered/crawled/indexed counts и логи `Googlebot`/`OAI-SearchBot`.

## 8. Оставшиеся риски и следующий этап

- 891 discovered URL могут индексироваться постепенно; исправления не дают гарантии включения каждой страницы в Google.
- Для 28 языков нужно регулярно контролировать фактическую ценность/спрос. Язык без готового качественного inventory должен сниматься с public release gate, а не оставаться пустым.
- Legal trust можно усилить после подтверждения реальных реквизитов: единый support email, полный postal address и регистрационные данные. Неподтверждённые сведения в schema добавлять нельзя.
- Следующий контентный приоритет: полезные SSR category intros на главных brand/model/city pages, уникальные факты из реальных listings и внешние качественные ссылки на marketplace.
- Нужен серверный лог/analytics отчёт по Googlebot и OAI-SearchBot, чтобы отличать discovery от фактического crawl.

## 9. Официальные ориентиры

- Google: AI features and your website — `https://developers.google.com/search/docs/appearance/ai-features`
- Google: Build and submit a sitemap — `https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap`
- Google: Localized versions — `https://developers.google.com/search/docs/specialty/international/localized-versions`
- OpenAI: Overview of OpenAI Crawlers — `https://developers.openai.com/api/docs/bots`
