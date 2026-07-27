# SiteCraft Auto Market: OpenAI prompt for AI car drafts

Используй это внутри Xano endpoint `POST /ai/generate-listing`.

Модель по умолчанию:

```text
gpt-5.6-luna
```

Fallback для сложных фото:

```text
gpt-5.5
```

## Developer Prompt

```text
Ты эксперт по подготовке объявлений автомобилей для маркетплейса SiteCraft Auto Market.

Твоя задача: проанализировать 1-4 фотографии автомобиля и вернуть только JSON по схеме car_listing_draft.

Правила:
- Не выдумывай факты, которых не видно на фото.
- VIN, пробег, цену, город, количество владельцев и дату первой регистрации возвращай null, если их нельзя надежно определить по фото.
- Марку, модель, тип кузова, цвет и примерное состояние можно определить визуально, но добавь confidence.
- Если модель автомобиля не уверена, укажи brand, а model оставь null или укажи наиболее вероятную модель с низким confidence.
- Описание пиши на русском языке.
- Описание должно быть честным, нейтральным и полезным покупателю.
- Не обещай идеальное состояние, гарантию, отсутствие ДТП или сервисную историю, если этого нет на фото.
- Если на фото видны повреждения, грязь, следы износа или нештатные элементы, мягко укажи это в description и ai_notes.
- Верни только JSON. Без markdown, без пояснений до или после JSON.
```

## User Prompt

```text
Создай черновик объявления автомобиля по этим фотографиям.

Нужно заполнить поля для формы подачи объявления.
Если поле нельзя определить по фото, верни null.
```

## JSON Schema

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "title": {
      "type": ["string", "null"],
      "description": "Короткое название объявления, например Audi A4 2020"
    },
    "brand": {
      "type": ["string", "null"]
    },
    "model": {
      "type": ["string", "null"]
    },
    "year": {
      "type": ["integer", "null"]
    },
    "mileage": {
      "type": ["integer", "null"]
    },
    "fuel_type": {
      "type": ["string", "null"],
      "enum": ["Бензин", "Дизель", "Гибрид", "Электро", "Газ", null]
    },
    "transmission": {
      "type": ["string", "null"],
      "enum": ["Механика", "Автомат", "Робот", "Вариатор", null]
    },
    "body_type": {
      "type": ["string", "null"]
    },
    "vehicle_type": {
      "type": ["string", "null"]
    },
    "engine_volume": {
      "type": ["string", "null"],
      "description": "Например 2.0 л. Верни null, если не видно или нельзя определить."
    },
    "first_registration": {
      "type": ["string", "null"],
      "description": "Дата первой регистрации. Обычно по фото не видна, поэтому чаще null."
    },
    "owners_count": {
      "type": ["integer", "null"],
      "description": "Количество владельцев. По фото почти всегда null."
    },
    "color": {
      "type": ["string", "null"]
    },
    "price": {
      "type": ["integer", "null"],
      "description": "Цена. Не выдумывать."
    },
    "city": {
      "type": ["string", "null"],
      "description": "Город. Не выдумывать."
    },
    "description": {
      "type": ["string", "null"],
      "description": "Готовое описание объявления на русском языке."
    },
    "confidence": {
      "type": ["number", "null"],
      "minimum": 0,
      "maximum": 1
    },
    "ai_notes": {
      "type": ["string", "null"],
      "description": "Короткие заметки для пользователя: что нужно проверить вручную."
    }
  },
  "required": [
    "title",
    "brand",
    "model",
    "year",
    "mileage",
    "fuel_type",
    "transmission",
    "body_type",
    "vehicle_type",
    "engine_volume",
    "first_registration",
    "owners_count",
    "color",
    "price",
    "city",
    "description",
    "confidence",
    "ai_notes"
  ]
}
```

## Xano response expected by frontend

Frontend ожидает один из этих форматов:

```json
{
  "draft_id": 123,
  "draft": {
    "id": 123,
    "title": "Audi A4 2020",
    "brand": "Audi",
    "model": "A4"
  },
  "images": [],
  "ai_credits": 9
}
```

или:

```json
{
  "id": 123
}
```

Лучше использовать первый формат.

## Moderation flow

1. Пользователь загружает фото.
2. Xano сохраняет фото в `car_draft_images`.
3. Xano отправляет фото в OpenAI Responses API.
4. Xano сохраняет JSON в `car_drafts`.
5. Frontend открывает `/dashboard/drafts/{id}`.
6. Пользователь проверяет и исправляет поля.
7. Пользователь нажимает “Отправить на модерацию”.
8. Xano создает объявление со статусом `pending_review`.
9. Модератор публикует объявление.
