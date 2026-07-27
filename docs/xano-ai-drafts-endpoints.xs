// SiteCraft Auto Market: AI drafts from car photos.
// Вставляй блоками в Xano: сначала таблицы, потом endpoints.
// Важно:
// - OPENAI_API_KEY должен быть только в Xano Environment Variables.
// - Frontend отправляет multipart/form-data:
//   photos[] и дублирующие поля photo_1, photo_2, photo_3, photo_4.
// - Новое объявление после AI не публикуется сразу: статус pending_review.
// - Если твоя auth-таблица называется automarket_users, оставь auth = "automarket_users".
// - Если у тебя auth-таблица user, замени auth = "automarket_users" на auth = "user".

// ---------------------------------------------------------------------------
// 00_ENVIRONMENT_VARIABLES
// ---------------------------------------------------------------------------
// Создай в Xano -> Keys & Variables:
//
// OPENAI_API_KEY = sk-...
// OPENAI_BEARER_TOKEN = Bearer sk-...
// Примечание: OPENAI_BEARER_TOKEN нужен только если твой XanoScript не умеет
// склеивать "Bearer " и OPENAI_API_KEY в header Authorization.
// OPENAI_DEFAULT_MODEL = gpt-5.6-luna
// OPENAI_LISTING_MODEL = gpt-5.6-luna
// AI_MAX_PHOTOS = 4
// AI_MAX_PHOTO_BYTES = 8388608
// AI_DAILY_LIMIT_PRIVATE = 5
// AI_MONTHLY_LIMIT_PRIVATE = 30
// AI_MIN_CONFIDENCE = 0.72

// ---------------------------------------------------------------------------
// 01_TABLE_car_drafts
// ---------------------------------------------------------------------------
table car_drafts {
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    int user_id
    int car_id?
    text status?="draft" filters=trim
    bool is_ai_generated?=true
    text source?="openai_responses" filters=trim

    text title? filters=trim
    text brand? filters=trim
    text model? filters=trim
    int year?
    int mileage?
    text fuel_type? filters=trim
    text transmission? filters=trim
    text body_type? filters=trim
    text vehicle_type? filters=trim
    text color? filters=trim
    text engine_volume? filters=trim
    text first_registration? filters=trim
    int owners_count?
    int price?
    text city? filters=trim
    text description?

    decimal confidence?
    json ai_payload?
    json ai_raw_response?
    text ai_notes?
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "user_id", op: "asc"}]}
    {type: "btree", field: [{name: "status", op: "asc"}]}
    {type: "btree", field: [{name: "created_at", op: "desc"}]}
  ]
}

// ---------------------------------------------------------------------------
// 02_TABLE_car_draft_images
// ---------------------------------------------------------------------------
table car_draft_images {
  schema {
    int id
    timestamp created_at?=now
    int user_id
    int draft_id
    int sort_order?=0
    bool is_primary?=false
    file image?
    text image_url?
    text mime_type?
    text original_filename?
    int size_bytes?
    json image_metadata?
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "draft_id", op: "asc"}]}
    {type: "btree", field: [{name: "user_id", op: "asc"}]}
    {type: "btree", field: [{name: "sort_order", op: "asc"}]}
  ]
}

// ---------------------------------------------------------------------------
// 03_TABLE_ai_generation_logs
// ---------------------------------------------------------------------------
table ai_generation_logs {
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    int user_id
    int draft_id?
    text endpoint?="ai/generate-listing" filters=trim
    text model?
    text status?="started" filters=trim
    int photo_count?=0
    int total_photo_bytes?=0
    int credits_before?=0
    int credits_after?=0
    text error_code?
    text error_message?
    json request_summary?
    json raw_response?
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "user_id", op: "asc"}]}
    {type: "btree", field: [{name: "draft_id", op: "asc"}]}
    {type: "btree", field: [{name: "created_at", op: "desc"}]}
    {type: "btree", field: [{name: "status", op: "asc"}]}
  ]
}

// ---------------------------------------------------------------------------
// 04_NOTE_existing_tables_fields
// ---------------------------------------------------------------------------
// Проверь, что в существующей таблице user_credits есть поля:
// - user_id
// - ai_credits
// - ai_daily_generations
// - ai_monthly_generations
// - ai_daily_reset_date
// - ai_monthly_reset_date
//
// Проверь, что в таблице cars / car_listings есть поля:
// - user_id
// - title, brand, model, year, mileage, fuel_type, transmission, body_type
// - vehicle_type, engine_volume, first_registration, owners_count
// - color, price, city, description
// - status, moderation_status, slug
// - is_ai_generated, draft_id
//
// Проверь, что в таблице car_images / car_listing_images есть поля:
// - car_id
// - sort_order
// - is_primary
// - image или image_url
// - mime_type, original_filename, size_bytes

// ---------------------------------------------------------------------------
// 05_ENDPOINT_POST_ai_generate_listing
// ---------------------------------------------------------------------------
query "ai/generate-listing" verb=POST {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    file? photo_1
    file? photo_2
    file? photo_3
    file? photo_4
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "Войдите в кабинет, чтобы создать AI-черновик."
    }

    var $max_photos {
      value = 4
    }

    var $max_photo_bytes {
      value = 8388608
    }

    var $model {
      value = $env.OPENAI_LISTING_MODEL
    }

    conditional {
      if (($model == null) || ($model == "")) {
        var.update $model {
          value = $env.OPENAI_DEFAULT_MODEL
        }
      }
    }
    conditional { if (($model == null) || ($model == "")) { var.update $model { value = "gpt-5.6-luna" } } }

    var $photos {
      value = []
    }

    conditional {
      if ($input.photo_1 != null) {
        array.push $photos {
          value = $input.photo_1
        }
      }
    }

    conditional {
      if ($input.photo_2 != null) {
        array.push $photos {
          value = $input.photo_2
        }
      }
    }

    conditional {
      if ($input.photo_3 != null) {
        array.push $photos {
          value = $input.photo_3
        }
      }
    }

    conditional {
      if ($input.photo_4 != null) {
        array.push $photos {
          value = $input.photo_4
        }
      }
    }

    precondition ($photos|count > 0) {
      error_type = "inputerror"
      error = "Добавьте хотя бы одно фото автомобиля."
    }

    precondition ($photos|count <= $max_photos) {
      error_type = "inputerror"
      error = "Для AI-черновика можно загрузить максимум 4 фото."
    }

    var $total_photo_bytes {
      value = 0
    }

    foreach ($photos) {
      each as $photo {
        precondition ($photo.size <= $max_photo_bytes) {
          error_type = "inputerror"
          error = "Фото слишком большое. Максимум 8 MB."
        }

        math.add $total_photo_bytes {
          value = $photo.size
        }
      }
    }

    db.get user_credits {
      field_name = "user_id"
      field_value = $auth.id
    } as $credits

    conditional {
      if ($credits == null) {
        db.add user_credits {
          data = {
            user_id: $auth.id
            ai_credits: 0
            ai_daily_generations: 0
            ai_monthly_generations: 0
            ai_daily_reset_date: now
            ai_monthly_reset_date: now
          }
        } as $credits
      }
    }

    precondition ($credits.ai_credits > 0) {
      error_type = "paymentrequired"
      error = "Недостаточно AI-кредитов. Пополните баланс и попробуйте снова."
    }

    precondition ($credits.ai_daily_generations < 5) {
      error_type = "accessdenied"
      error = "Дневной лимит AI-генераций исчерпан."
    }

    precondition ($credits.ai_monthly_generations < 30) {
      error_type = "accessdenied"
      error = "Месячный лимит AI-генераций исчерпан."
    }

    db.add ai_generation_logs {
      data = {
        user_id: $auth.id
        model: $model
        status: "started"
        photo_count: $photos|count
        total_photo_bytes: $total_photo_bytes
        credits_before: $credits.ai_credits
      }
    } as $log

    // Сохраняем черновик до вызова OpenAI, чтобы изображения уже имели draft_id.
    db.add car_drafts {
      data = {
        user_id: $auth.id
        status: "draft"
        is_ai_generated: true
        source: "openai_responses"
      }
    } as $draft

    var $image_urls {
      value = []
    }

    foreach ($photos) {
      each as $photo {
        storage.upload {
          file = $photo
        } as $uploaded_image

        array.push $image_urls {
          value = $uploaded_image.url
        }

        db.add car_draft_images {
          data = {
            user_id: $auth.id
            draft_id: $draft.id
            sort_order: $index
            is_primary: ($index == 0)
            image: $uploaded_image
            image_url: $uploaded_image.url
            mime_type: $photo.type
            original_filename: $photo.name
            size_bytes: $photo.size
            image_metadata: $uploaded_image
          }
        } as $draft_image
      }
    }

    var $prompt {
      value = "Ты эксперт по объявлениям автомобилей. Проанализируй фото автомобиля и верни только JSON по схеме. Не выдумывай VIN, пробег, цену и город, если их нельзя понять по фото. Для неуверенных полей используй null. Пиши описание на русском языке, честно и без гарантированных утверждений."
    }

    // Если Xano не принимает вложенный JSON в api.request, создай переменную body через Object Builder.
    api.request {
      url = "https://api.openai.com/v1/responses"
      method = "POST"
      headers = {
        Authorization: $env.OPENAI_BEARER_TOKEN
        Content-Type: "application/json"
      }
      body = {
        model: $model
        store: false
        input: [
          {
            role: "developer"
            content: [
              {
                type: "input_text"
                text: $prompt
              }
            ]
          }
          {
            role: "user"
            content: [
              {
                type: "input_text"
                text: "Создай черновик объявления по этим фотографиям. Верни strict JSON без markdown."
              }
              {
                type: "input_image"
                image_url: $image_urls.0
              }
              {
                type: "input_image"
                image_url: $image_urls.1
              }
              {
                type: "input_image"
                image_url: $image_urls.2
              }
              {
                type: "input_image"
                image_url: $image_urls.3
              }
            ]
          }
        ]
        text: {
          format: {
            type: "json_schema"
            name: "car_listing_draft"
            strict: true
            schema: {
              type: "object"
              additionalProperties: false
              properties: {
                title: {type: ["string", "null"]}
                brand: {type: ["string", "null"]}
                model: {type: ["string", "null"]}
                year: {type: ["integer", "null"]}
                mileage: {type: ["integer", "null"]}
                fuel_type: {type: ["string", "null"]}
                transmission: {type: ["string", "null"]}
                body_type: {type: ["string", "null"]}
                vehicle_type: {type: ["string", "null"]}
                engine_volume: {type: ["string", "null"]}
                first_registration: {type: ["string", "null"]}
                owners_count: {type: ["integer", "null"]}
                color: {type: ["string", "null"]}
                price: {type: ["integer", "null"]}
                city: {type: ["string", "null"]}
                description: {type: ["string", "null"]}
                confidence: {type: ["number", "null"]}
                ai_notes: {type: ["string", "null"]}
              }
              required: [
                "title"
                "brand"
                "model"
                "year"
                "mileage"
                "fuel_type"
                "transmission"
                "body_type"
                "vehicle_type"
                "engine_volume"
                "first_registration"
                "owners_count"
                "color"
                "price"
                "city"
                "description"
                "confidence"
                "ai_notes"
              ]
            }
          }
        }
      }
    } as $openai_response

    // В Xano извлеки output_text из ответа Responses API.
    // Если у тебя поле называется иначе, посмотри raw_response в ai_generation_logs.
    var $draft_json {
      value = $openai_response.body.output_text|json_decode
    }

    db.edit car_drafts {
      field_name = "id"
      field_value = $draft.id
      data = {
        title: $draft_json.title
        brand: $draft_json.brand
        model: $draft_json.model
        year: $draft_json.year
        mileage: $draft_json.mileage
        fuel_type: $draft_json.fuel_type
        transmission: $draft_json.transmission
        body_type: $draft_json.body_type
        vehicle_type: $draft_json.vehicle_type
        engine_volume: $draft_json.engine_volume
        first_registration: $draft_json.first_registration
        owners_count: $draft_json.owners_count
        color: $draft_json.color
        price: $draft_json.price
        city: $draft_json.city
        description: $draft_json.description
        confidence: $draft_json.confidence
        ai_notes: $draft_json.ai_notes
        ai_payload: $draft_json
        ai_raw_response: $openai_response.body
        updated_at: now
      }
    } as $draft

    math.subtract $credits.ai_credits {
      value = 1
    } as $credits_after

    math.add $credits.ai_daily_generations {
      value = 1
    } as $daily_after

    math.add $credits.ai_monthly_generations {
      value = 1
    } as $monthly_after

    db.edit user_credits {
      field_name = "id"
      field_value = $credits.id
      data = {
        ai_credits: $credits_after
        ai_daily_generations: $daily_after
        ai_monthly_generations: $monthly_after
        updated_at: now
      }
    } as $credits

    db.add credit_transactions {
      data = {
        user_id: $auth.id
        type: "usage"
        amount: -1
        balance_after: $credits_after
        notes: "AI listing draft"
      }
    } as $transaction

    db.edit ai_generation_logs {
      field_name = "id"
      field_value = $log.id
      data = {
        status: "success"
        draft_id: $draft.id
        credits_after: $credits_after
        raw_response: $openai_response.body
        updated_at: now
      }
    } as $log

    db.query car_draft_images {
      where = ($db.car_draft_images.draft_id == $draft.id)
      sort = {sort_order: "asc"}
    } as $images
  }

  response = {
    draft_id: $draft.id
    draft: $draft
    images: $images
    ai_credits: $credits_after
  }

  tags = ["sitecraft-auto-market", "ai", "drafts"]
}

// ---------------------------------------------------------------------------
// 06_ENDPOINT_GET_dashboard_drafts_id
// ---------------------------------------------------------------------------
query "dashboard/drafts/{id}" verb=GET {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    int id
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "Войдите в кабинет, чтобы открыть AI-черновик."
    }

    db.get car_drafts {
      field_name = "id"
      field_value = $input.id
    } as $draft

    precondition ($draft != null) {
      error_type = "notfound"
      error = "AI-черновик не найден."
    }

    precondition ($draft.user_id == $auth.id) {
      error_type = "accessdenied"
      error = "У вас нет доступа к этому AI-черновику."
    }

    db.query car_draft_images {
      where = ($db.car_draft_images.draft_id == $draft.id)
      sort = {sort_order: "asc"}
    } as $images
  }

  response = {
    draft: $draft
    images: $images
  }

  tags = ["sitecraft-auto-market", "ai", "drafts"]
}

// ---------------------------------------------------------------------------
// 07_ENDPOINT_PATCH_dashboard_drafts_id
// ---------------------------------------------------------------------------
query "dashboard/drafts/{id}" verb=PATCH {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    int id
    text? title
    text? brand
    text? model
    int? year
    int? mileage
    text? fuel_type
    text? transmission
    text? body_type
    text? vehicle_type
    text? engine_volume
    text? first_registration
    int? owners_count
    text? color
    int? price
    text? city
    text? description
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "Войдите в кабинет, чтобы сохранить AI-черновик."
    }

    db.get car_drafts {
      field_name = "id"
      field_value = $input.id
    } as $draft

    precondition ($draft != null) {
      error_type = "notfound"
      error = "AI-черновик не найден."
    }

    precondition ($draft.user_id == $auth.id) {
      error_type = "accessdenied"
      error = "У вас нет доступа к этому AI-черновику."
    }

    precondition ($draft.status == "draft") {
      error_type = "inputerror"
      error = "Этот черновик уже отправлен на модерацию."
    }

    db.edit car_drafts {
      field_name = "id"
      field_value = $draft.id
      data = {
        title: $input.title
        brand: $input.brand
        model: $input.model
        year: $input.year
        mileage: $input.mileage
        fuel_type: $input.fuel_type
        transmission: $input.transmission
        body_type: $input.body_type
        vehicle_type: $input.vehicle_type
        engine_volume: $input.engine_volume
        first_registration: $input.first_registration
        owners_count: $input.owners_count
        color: $input.color
        price: $input.price
        city: $input.city
        description: $input.description
        updated_at: now
      }
    } as $draft

    db.query car_draft_images {
      where = ($db.car_draft_images.draft_id == $draft.id)
      sort = {sort_order: "asc"}
    } as $images
  }

  response = {
    draft: $draft
    images: $images
  }

  tags = ["sitecraft-auto-market", "ai", "drafts"]
}

// ---------------------------------------------------------------------------
// 08_ENDPOINT_POST_dashboard_drafts_id_publish
// ---------------------------------------------------------------------------
query "dashboard/drafts/{id}/publish" verb=POST {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    int id
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "Войдите в кабинет, чтобы отправить объявление на модерацию."
    }

    db.get car_drafts {
      field_name = "id"
      field_value = $input.id
    } as $draft

    precondition ($draft != null) {
      error_type = "notfound"
      error = "AI-черновик не найден."
    }

    precondition ($draft.user_id == $auth.id) {
      error_type = "accessdenied"
      error = "У вас нет доступа к этому AI-черновику."
    }

    precondition ($draft.status == "draft") {
      error_type = "inputerror"
      error = "Этот черновик уже был отправлен."
    }

    precondition ($draft.title != null) {
      error_type = "inputerror"
      error = "Добавьте название объявления."
    }

    precondition ($draft.brand != null) {
      error_type = "inputerror"
      error = "Добавьте марку автомобиля."
    }

    precondition ($draft.model != null) {
      error_type = "inputerror"
      error = "Добавьте модель автомобиля."
    }

    var $slug_source {
      value = $draft.title
    }

    util.slugify {
      value = $slug_source
    } as $slug

    db.add car_listings {
      data = {
        user_id: $auth.id
        draft_id: $draft.id
        title: $draft.title
        brand: $draft.brand
        model: $draft.model
        year: $draft.year
        mileage: $draft.mileage
        fuel_type: $draft.fuel_type
        transmission: $draft.transmission
        body_type: $draft.body_type
        vehicle_type: $draft.vehicle_type
        engine_volume: $draft.engine_volume
        first_registration: $draft.first_registration
        owners_count: $draft.owners_count
        color: $draft.color
        price: $draft.price
        city: $draft.city
        description: $draft.description
        slug: $slug
        status: "pending_review"
        moderation_status: "pending_review"
        is_ai_generated: true
      }
    } as $car

    db.query car_draft_images {
      where = ($db.car_draft_images.draft_id == $draft.id)
      sort = {sort_order: "asc"}
    } as $draft_images

    foreach ($draft_images) {
      each as $draft_image {
        db.add car_listing_images {
          data = {
            car_id: $car.id
            sort_order: $draft_image.sort_order
            is_primary: $draft_image.is_primary
            image: $draft_image.image
            image_url: $draft_image.image_url
            mime_type: $draft_image.mime_type
            original_filename: $draft_image.original_filename
            size_bytes: $draft_image.size_bytes
            image_metadata: $draft_image.image_metadata
          }
        } as $car_image
      }
    }

    db.edit car_drafts {
      field_name = "id"
      field_value = $draft.id
      data = {
        status: "pending_review"
        car_id: $car.id
        updated_at: now
      }
    } as $draft
  }

  response = {
    car: $car
    slug: $car.slug
    status: $car.status
  }

  tags = ["sitecraft-auto-market", "ai", "drafts", "moderation"]
}

// ---------------------------------------------------------------------------
// 09_OPTIONAL_ALIAS_ENDPOINTS
// ---------------------------------------------------------------------------
// Если тебе удобнее короткий путь, создай такие же endpoints:
// GET   /drafts/{id}          -> та же логика, что GET /dashboard/drafts/{id}
// PATCH /drafts/{id}          -> та же логика, что PATCH /dashboard/drafts/{id}
// POST  /drafts/{id}/publish  -> та же логика, что POST /dashboard/drafts/{id}/publish
//
// Frontend уже умеет fallback:
// если /dashboard/drafts/{id} вернул 404, он пробует /drafts/{id}.
