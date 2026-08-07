# SiteCraft Auto Market: системный UI/UX-редизайн

Дата: 2026-08-02
Статус: локальная реализация завершена, production не изменялся.

## 1. Исходное состояние

- В `global.css` одновременно жили несколько поколений компонентов и media queries.
- Публичная карточка имела устаревшие ограничения высоты, повторяющиеся характеристики и разные представления между разделами.
- Каталог не имел стабильной схемы `filters + results`, а AI-блок отнимал слишком много вертикального места.
- Public и workspace использовали пересекающиеся header/sidebar правила.
- Формы, кнопки, панели, модальные окна и состояния использовали разные размеры, радиусы и focus styles.
- Promotion CSS менял структуру карточки вместо декоративного модификатора.
- Mobile header кабинета наследовал абсолютное позиционирование старого меню и мог накрывать контент.

Исходные проверки:

- `npm install`: успешно, 0 vulnerabilities.
- `npm run check`: 0 errors, 0 warnings, 1 существующий TypeScript hint.
- `npm test`: 353/353.
- `npm run build`: успешно.

## 2. Архитектура решения

CSS разделён на слои:

```text
legacy -> tokens -> base -> layout -> components -> routes -> modifiers
```

Основные файлы:

- `src/styles/tokens.css` — цвета, поверхности, отступы, радиусы, размеры контролов и темы.
- `src/styles/base.css` — reset, типографика, focus, reduced motion.
- `src/styles/layout.css` — public/workspace shell, containers, sections, sidebar.
- `src/styles/components/` — buttons, forms, header, cards, catalog, dashboard, dialogs, states и public pages.
- `src/styles/promotions.css` — только border/tint/badge/sold modifiers.
- `src/styles/global.css` — прежние правила изолированы в низкоприоритетном `legacy`-слое; `!important` удалены из legacy CSS.

`design-system.css` оставлен только как совместимый пустой entry point и больше не импортирует вторую дизайн-систему. Активная система подключается централизованно из `BaseLayout.astro`.

## 3. Public и workspace

- `BaseLayout.astro` по-прежнему использует реальное определение workspace route.
- Public страницы рендерят верхний header, public container и footer без dashboard sidebar.
- Dashboard/admin рендерят desktop sidebar и компактную нижнюю мобильную навигацию.
- Header получил варианты `public` и `workspace` без дублирования компонента.
- Mobile public menu использует drawer, backdrop, body scroll lock, `aria-expanded`, Escape и возврат фокуса.
- Mobile workspace header теперь статичен и не накрывает содержимое.

## 4. Каноническая карточка

Единая SSR/client-разметка формируется через `renderPublicCarCardMarkup()` и используется на главной, в каталоге, избранном, похожих предложениях и других публичных списках.

- Вся карточка — нативная ссылка.
- Favorite — отдельная sibling-кнопка 44x44 с `aria-pressed`.
- Фото использует `aspect-ratio: 16 / 10` и `object-fit: cover`.
- Нет искусственного `min-height: 548px`.
- Название ограничено двумя строками.
- Характеристики: год, пробег, топливо и коробка в сетке 2x2.
- Footer показывает дату слева и просмотры справа только один раз.
- Просмотры берутся из нормализованного реального поля `views_total`; отдельные N+1-запросы не добавлены.
- Promotion меняет только визуальный акцент и не увеличивает карточку.

Lucide registry уже содержал и продолжает регистрировать `Heart`, `Calendar`, `Gauge`, `Fuel`, `Settings2`, `Eye`, `MapPin`, `Menu`, `X`, `Sun`, `Moon`, `SlidersHorizontal`, `Grid2X2`, `List`, `UserRound` и `Plus`. Новая ручная SVG-разметка не добавлялась.

## 5. Каталог

- Desktop: sticky filters `272px` слева, toolbar и три компактные карточки справа.
- Small desktop/tablet: две колонки; mobile: одна колонка.
- AI-подбор встроен компактно в панель фильтров.
- Grid/list используют одну HTML-структуру и CSS modifier.
- Mobile filter работает как drawer с backdrop, Escape, `aria-expanded`, scroll lock и focus return.
- Toolbar, sort и view switch имеют стабильные размеры; горизонтальный scroll отсутствует.

## 6. Публичные страницы

- Главная, каталог, detail, sell, pricing, login и register приведены к общим surfaces, spacing и typography.
- Detail использует gallery + summary на desktop и последовательный mobile layout.
- Связанные автомобили используют каноническую карточку.
- SSR, canonical, Open Graph, JSON-LD, breadcrumbs и нативные ссылки не удалялись.

## 7. Dashboard, формы и состояния

- Dashboard summary, listings, favorites, billing, promotion, Deal Finder и moderation используют общие panels и controls.
- Поля имеют видимые labels, единый focus ring, высоту не менее 44px и совместимые error/help states.
- `/dashboard/new/` сохраняет существующий workflow, uploader, AI и публикационную логику; изменено только представление.
- Empty/error/loading/dialog patterns унифицированы.
- Исправлен mobile workspace header: действия больше не рендерятся абсолютным слоем поверх формы.

## 8. Изменённые файлы

- `src/components/Header.astro`
- `src/layouts/BaseLayout.astro`
- `src/lib/publicCarCard.ts`
- `src/pages/index.astro`
- `src/pages/cars/index.astro`
- `src/styles/global.css`
- `src/styles/promotions.css`
- `src/styles/design-system.css`
- `tests/image-lightbox.test.ts`
- `tests/public-car-card-compact.test.ts`
- `tests/public-car-card-links.test.ts`
- `tests/critical-workspace-stage8.test.ts`
- `tests/full-design-system-stage-7.test.ts`

## 9. Созданные CSS-файлы

- `src/styles/tokens.css`
- `src/styles/base.css`
- `src/styles/layout.css`
- `src/styles/components/buttons.css`
- `src/styles/components/forms.css`
- `src/styles/components/header.css`
- `src/styles/components/car-card.css`
- `src/styles/components/catalog.css`
- `src/styles/components/public-pages.css`
- `src/styles/components/dashboard.css`
- `src/styles/components/dialogs.css`
- `src/styles/components/states.css`

## 10. Проверки

Финальный результат:

- `npm run check`: успешно, 0 errors, 0 warnings, 1 hint в `publicCarCardsClient.ts`.
- `npm test`: успешно, 353 passed, 0 failed.
- `npm run build`: успешно; Worker compiled; Pages Advanced Mode bundle подготовлен; 32 asset references в 33 HTML проверены.
- Browser console на финальных ключевых страницах: ошибок нет.
- Пустых SVG на проверенных маршрутах: 0.
- `scrollWidth === innerWidth` подтверждено для public catalog, detail, dashboard и new listing на mobile; desktop catalog/detail/dashboard также без overflow.
- Public sidebar отсутствует; workspace navigation не появляется в public shell.
- Menu/filter drawer, Escape и grid/list переключатель проверены интерактивно.

Browser QA выполнялся на контрольных размерах `360x800`, `390x844`, `430x932`, `768x1024`, `1024x768`, `1280x800`, `1440x900`. Для динамических защищённых маршрутов часть повторных batch-навигаций завершалась browser timeout, поэтому результат не выдаётся за независимый production E2E; layout contracts дополнительно покрыты 353 тестами и финальной сборкой.

`git diff --check` отдельно сообщает ранее существующие trailing spaces в `docs/xano-endpoint-get-cars-slug.xs` и `docs/xano-endpoint-get-cars.xs`. Эти Xano-документы в UI-этапе не изменялись.

## 11. Скриншоты

В `artifacts/ui-redesign/` сохранены:

1. `home-desktop.png`
2. `home-mobile.png`
3. `catalog-desktop.png`
4. `catalog-tablet.png`
5. `catalog-mobile.png`
6. `catalog-list-desktop.png`
7. `car-detail-desktop.png`
8. `car-detail-mobile.png`
9. `dashboard-desktop.png`
10. `dashboard-mobile.png`
11. `new-listing-desktop.png`
12. `new-listing-mobile.png`

## 12. Резервная копия

Изменяемые базовые файлы сохранены в:

```text
.backups/ui-redesign-stage-11/
```

## 13. Ограничения и подтверждения

- Новых Xano-полей или endpoint для редизайна не требуется; блокеров по данным не найдено.
- Xano не изменялся.
- Пользовательские данные не изменялись.
- Cloudflare production deployment не выполнялся.
- Cloudflare production settings не изменялись.
- Новая Git-ветка не создавалась.
- `git push` не выполнялся.
