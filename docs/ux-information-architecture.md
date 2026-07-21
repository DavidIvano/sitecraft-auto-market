# UX information architecture

Updated: 2026-07-15

## Navigation model

### Public pages

Use one compact header:

1. Главная
2. Автомобили
3. Продать автомобиль
4. Тарифы
5. Войти or Кабинет

`Добавить объявление` is the single primary navigation action. `Модерация` is rendered only after confirmed admin identity.

### Seller workspace

Use the sidebar as the primary navigation. The header contains context, profile/session controls, and at most one page-specific primary action. Do not repeat the full seller navigation in the header.

Recommended order:

1. Обзор
2. Мои объявления
3. Добавить объявление
4. Оплата и услуги
5. Дилерский профиль, when applicable

### Admin workspace

Keep admin tasks separate from buyer and seller navigation:

1. Модерация
2. Дилеры
3. Покупки
4. Платные продукты

Admin routes remain authorization-protected. Hiding links is presentation only, never the security boundary.

### Mobile and tablet

Use one fixed bottom navigation with no more than four primary destinations:

1. Главная
2. Авто
3. Продать
4. Кабинет

The bar respects left, right, and bottom safe-area insets. Secondary and admin destinations live inside the contextual menu or workspace page, not the buyer navigation.

## Page hierarchy

Every page follows:

1. Location or compact breadcrumb.
2. One literal page title.
3. One sentence explaining the task, only when needed.
4. One primary action.
5. Supporting content in descending importance.

## Seller listing flow

1. Add 1-8 photos.
2. Create an AI-assisted draft.
3. Confirm required vehicle and seller data.
4. Save the latest values.
5. Submit for moderation.
6. See `На модерации` in own listings.

The draft remains editable until submission. AI suggestions never replace explicit confirmation for contact, VIN, TÜV/HU, ownership, first registration, or seller type.

## Status language

| Internal value | User-facing label | Next step |
| --- | --- | --- |
| `draft`, `ai_draft` | Черновик | Завершить и отправить |
| `pending_review` | На модерации | Дождаться проверки |
| `needs_fix` | Нужно исправить | Открыть отмеченные поля |
| `approved`, `published` | Опубликовано | Просмотреть или продвинуть |
| `rejected` | Отклонено | Прочитать причину |
| `sold` | Продано | Объявление завершено |

## Terminology

Use `Автомобили` as the canonical section name and `Авто` only in compact mobile navigation. Avoid endpoint, payload, fallback, moderation status, draft ID, Finder, Settings, Installer, Featured, and AI Generated in user-facing copy.
