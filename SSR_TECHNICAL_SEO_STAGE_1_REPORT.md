# Этап 1: SSR и техническое SEO карточек автомобилей

Дата проверки и публикации: 28 июля 2026 года.

## Обнаруженные проблемы

| Приоритет | Файл | Причина | Влияние |
| --- | --- | --- | --- |
| Critical | `src/pages/cars/index.astro`, `public/_routes.json` | Каталог не был включен как отдельный on-demand SSR route, а ошибка Xano могла выглядеть как пустой успешный каталог. | Роботы могли получать неполный HTML или ложный `200`. |
| High | `src/pages/cars/[slug].astro` | Публичная карточка использовала `no-store`; статус и robots headers устанавливались до окончательной проверки результата. | Слабое edge-кэширование и риск неправильной индексации ошибок. |
| High | `src/pages/sitemap.xml.ts` | Ошибка Xano превращалась в успешный пустой XML, а статические `lastmod` менялись при каждом запросе. | Выпадение карточек из sitemap и ложные сигналы об обновлении страниц. |
| High | `src/pages/cars/[slug].astro` | SEO и JSON-LD собирались внутри большой страницы без единой нормализации приватного текста. | Риск несогласованных метаданных и попадания контактов/VIN в description. |
| Medium | `src/pages/index.astro` | Новые автомобили появлялись только после client-side fetch. | На главной не было crawlable-ссылок на новые карточки без JavaScript. |
| Medium | `src/pages/404.astro`, `src/pages/service-unavailable.astro` | Не все error responses имели явные `noindex` и `Retry-After`. | Поисковый робот мог неверно интерпретировать временные и постоянные ошибки. |

## Измененные локальные файлы

- `src/lib/seo/vehicleSeo.ts` (создан)
- `src/lib/xano.ts`
- `src/pages/cars/index.astro`
- `src/pages/cars/[slug].astro`
- `src/layouts/BaseLayout.astro`
- `src/pages/sitemap.xml.ts`
- `src/pages/404.astro`
- `src/pages/service-unavailable.astro`
- `src/pages/index.astro`
- `public/_routes.json`
- `tests/vehicle-seo.test.ts` (создан)
- `tests/public-car-on-demand.test.ts`
- `SSR_TECHNICAL_SEO_STAGE_1_REPORT.md` (создан)

Список составлен вручную без Git.

## Выполненные изменения

- `/cars`, `/cars/[slug]` и `/sitemap.xml` работают как on-demand SSR при сохранении гибридного `output: "static"`.
- Каталог и главная отдают crawlable-карточки и ссылки в первоначальном HTML.
- Основной запрос карточки определяет ее HTTP status; вторичные запросы продавца и похожих машин используют независимый fallback.
- Публичные карточки получают `200/index`, непубличные и отсутствующие — `404/noindex`, сбой источника — `503/noindex` с `Retry-After: 300`.
- Добавлен edge cache: 120 секунд для каталога, 300 секунд для карточек и sitemap, со `stale-while-revalidate`.
- Единый SEO helper формирует Title, Description, canonical, image metadata и отдельные схемы `Vehicle`, `Offer`, `BreadcrumbList`.
- Из SEO-текста удаляются email, телефон и VIN; пустые и нечисловые поля не попадают в JSON-LD.
- Проданные публичные объявления сохраняют `200`, отметку продажи и `Offer.availability = SoldOut`.
- Sitemap содержит только production URL, уникальные публичные slug и стабильный `lastmod` из `updated_at`/`created_at`; при отказе Xano возвращается `503`.
- LCP-изображение находится в SSR HTML, имеет alt, width/height и не использует lazy loading.

## Результаты команд

- `npm install` — успешно, зависимости актуальны, 0 уязвимостей.
- `npm run check` — успешно, exit code 0.
- `npm test` — успешно, все тесты пройдены, exit code 0.
- `npm run build` — успешно, exit code 0; Cloudflare Advanced Mode Worker собран.
- Проверка пробелов в концах строк измененных файлов — совпадений нет.
- В `dist/client` нет `.env` или `.dev.vars`; найдены `dist/client/_worker.js/index.js` и Astro server entry.

## Локальная SSR-проверка

Cloudflare-compatible runtime: `http://127.0.0.1:4331`.

| URL | Status | Cache-Control | Robots | H1 | JSON-LD |
| --- | --- | --- | --- | --- | --- |
| `/cars/mercedes-benz-a-170-2008-49` | 200 | `s-maxage=300` | `index, follow` | Mercedes-Benz A 170 2008 | Vehicle, Offer, BreadcrumbList |
| `/cars/mercedes-benz-vito-2006-74` | 200 | `s-maxage=300` | `index, follow` | Mercedes-Benz Vito 2006 | Vehicle, Offer, BreadcrumbList |
| `/cars/audi-a3-1998-1783696859` | 200 | `s-maxage=300` | `index, follow` | Audi A3 1998 | Vehicle, Offer, BreadcrumbList |
| `/cars/does-not-exist-seo-qa` | 404 | `no-store` | `noindex, nofollow` | Объявление не найдено | Нет Vehicle/Offer |

У каждой проверенной карточки в исходном response найдены цена, описание, canonical, Open Graph image, главное изображение и обычные внутренние ссылки. `/cars` вернул 11 ссылок на карточки; главная — 8. Query-фильтры canonicalized на `/cars`. Sitemap валиден как XML.

Во время локальной проверки краткий отказ Xano корректно дал `503` вместо пустого `200`; после восстановления тот же URL снова вернул `200`.

## Публикация и production QA

- Команда: `npx wrangler pages deploy dist/client --project-name sitecraft-auto-market --branch main --commit-message "Stage 1 SSR and technical vehicle SEO"`
- Pages project: `sitecraft-auto-market`
- Deployment ID: `2c458dc7-f399-4c49-b60f-bd4bcae46258`
- Deployment URL: `https://2c458dc7.sitecraft-auto-market.pages.dev`
- Production: `https://automarket.sitecraft.agency`

Production-проверка подтвердила:

- `/` — `200`, 8 SSR-ссылок на карточки;
- `/cars` — `200`, 11 SSR-ссылок, правильный cache и canonical;
- три карточки выше — `200`, уникальные H1/canonical, цена, описание, изображение и все три требуемые схемы;
- несуществующий slug — `404`, `no-store`, `noindex`, без Vehicle/Offer;
- `/sitemap.xml` — `200`, валидный XML, 18 URL, из них 11 карточек, без query URL;
- публичные SEO responses не содержат placeholder API URL;
- фильтрованный `/cars?...` указывает canonical на `https://automarket.sitecraft.agency/cars`.

## Резервные копии

`/Users/david/Documents/Codex/2026-06-27/first-install-this-skill-npx-skills/sitecraft-auto-market/.backups/seo-ssr-stage-1/`

Секреты, `.env`, `.dev.vars`, `dist` и `node_modules` в backup не копировались.

## Следующий этап

Добавить ограниченный публичный Xano endpoint похожих автомобилей, чтобы карточка не читала полный каталог для вторичного блока. Затем можно переходить к SEO-страницам марок/моделей и автоматизированным HTTP integration-тестам Cloudflare runtime.
