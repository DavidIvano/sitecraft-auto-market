query "ai/listing/analyze-photos" verb=POST {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    text r2_images? filters=trim
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "unauthorized"
      error = "Войдите в кабинет, чтобы создать AI-черновик."
    }

    var $model {
      value = $env.OPENAI_CAR_AI_MODEL
    }

    conditional {
      if (($model == null) || ($model == "")) {
        var.update $model {
          value = "gpt-5.4-mini"
        }
      }
    }

    var $r2_images {
      value = []
    }

    conditional {
      if (($input.r2_images != null) && ($input.r2_images != "")) {
        var.update $r2_images {
          value = $input.r2_images|json_decode
        }
      }
    }

    var $photo_count {
      value = $r2_images|count
    }

    precondition ($photo_count > 0) {
      error_type = "inputerror"
      error = "Фото должны быть сначала загружены в Cloudflare R2."
    }

    precondition ($photo_count <= 8) {
      error_type = "inputerror"
      error = "Для AI-черновика можно загрузить максимум 8 фото."
    }

    db.get automarket_users {
      field_name = "id"
      field_value = $auth.id
    } as $auth_user

    precondition ($auth_user != null) {
      error_type = "unauthorized"
      error = "Пользователь не найден."
    }

    db.get user_credits {
      field_name = "user_id"
      field_value = $auth.id
    } as $credits

    conditional {
      if ($credits == null) {
        db.add user_credits {
          data = {
            user_id               : $auth.id
            ai_credits            : 10
            ai_daily_generations  : 0
            ai_monthly_generations: 0
            ai_daily_reset_date   : now
            ai_monthly_reset_date : now
          }
        } as $credits

        db.add credit_transactions {
          data = {
            user_id      : $auth.id
            type         : "free_grant"
            amount       : 10
            balance_after: 10
            notes        : "Welcome demo AI credits"
          }
        } as $credit_transaction
      }
    }

    precondition ($credits.ai_credits > 0) {
      error_type = "accessdenied"
      error = "Недостаточно AI-кредитов."
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
        user_id          : $auth.id
        model            : $model
        status           : "started"
        photo_count      : $photo_count
        total_photo_bytes: 0
        credits_before   : $credits.ai_credits
      }
    } as $log

    db.add car_drafts {
      data = {
        user_id        : $auth.id
        status         : "ai_draft"
        is_ai_generated: true
        source         : "openai_responses"
        created_at     : "now"
        updated_at     : "now"
      }
    } as $draft

    var $user_content {
      value = []
    }

    array.push $user_content {
      value = {
        type: "input_text"
        text: "Проанализируй фотографии автомобиля и верни JSON для автозаполнения формы объявления. Нужно определить марку, модель, примерный год, цвет, кузов, тип транспорта, топливо, коробку, двери, места, заголовок и описание. Если поле нельзя определить по фото, верни null или 'Не указано'. Не выдумывай VIN, пробег, цену, город, владельцев, TÜV/HU, сервисную историю и факт 'без ДТП'."
      }
    }

    var $sort_order {
      value = 0
    }

    foreach ($r2_images) {
      each as $r2_image {
        array.push $user_content {
          value = {type: "input_image", image_url: $r2_image.url}
        }

        db.add car_draft_images {
          data = {
            user_id          : $auth.id
            draft_id         : $draft.id
            sort_order       : $sort_order
            is_primary       : ($sort_order == 0)
            image_url        : $r2_image.url
            mime_type        : $r2_image.contentType
            original_filename: $r2_image.key
            size_bytes       : $r2_image.size
            image_metadata   : $r2_image
            created_at       : "now"
            updated_at       : "now"
          }
        } as $draft_image

        var.update $sort_order {
          value = $sort_order + 1
        }
      }
    }

    var $openai_auth_header {
      value = "Authorization: Bearer "|concat:$env.OPENAI_API_KEY
    }

    api.request {
      url = "https://api.openai.com/v1/responses"
      method = "POST"
      params = {
        model: $model
        input: [
          {
            role: "developer"
            content: [
              {
                type: "input_text"
                text: "Ты эксперт по автомобильным объявлениям и распознаванию автомобилей по фото. Верни только JSON по схеме. Нормализуй значения под русские dropdown options. Не выдумывай данные. По фото можно предложить тип транспорта, марку, модель, примерный год, кузов, цвет, двери, места, вероятное топливо, коробку, видимое состояние, title и description. Пробег, объем двигателя, привод, первую регистрацию, VIN, владельцев, TÜV/HU и состояние как юридический факт заполняй только при четком визуальном подтверждении документом или приборной панелью; всегда auto_fill_allowed=false. Цена, город, страна, валюта и данные продавца всегда null, confidence=0, source=manual_required, auto_fill_allowed=false. Не утверждай ДТП, сервисную историю, гарантию, техническую исправность или действующий TÜV без документа. Для каждого поля верни confidence 0..1. Автозаполнение разрешено только при confidence >= 0.85 и для несensitive полей."
              }
            ]
          }
          {
            role: "user"
            content: $user_content
          }
        ]
        text : {
            format: {
              type: "json_schema"
              name: "car_ai_form_autofill"
              strict: true
              schema: {
                type: "object"
                additionalProperties: false
                properties: {
                  normalized_fields: {
                    type: "object"
                    additionalProperties: false
                    properties: {
                      title: {
                        type: ["string", "null"]
                      }
                      brand: {
                        type: ["string", "null"]
                      }
                      model: {
                        type: ["string", "null"]
                      }
                      year: {
                        type: ["integer", "null"]
                      }
                      color: {
                        type: ["string", "null"]
                        enum: [
                          "Черный",
                          "Белый",
                          "Серый",
                          "Серебристый",
                          "Синий",
                          "Красный",
                          "Зеленый",
                          "Коричневый",
                          "Бежевый",
                          "Желтый",
                          "Оранжевый",
                          "Другой",
                          "Не указано",
                          null
                        ]
                      }
                      body_type: {
                        type: ["string", "null"]
                        enum: [
                          "Седан",
                          "Хэтчбек",
                          "Универсал",
                          "Купе",
                          "Кабриолет",
                          "Внедорожник",
                          "Кроссовер",
                          "Минивэн",
                          "Фургон",
                          "Пикап",
                          "Не указано",
                          null
                        ]
                      }
                      vehicle_type: {
                        type: ["string", "null"]
                        enum: [
                          "Легковой автомобиль",
                          "Электромобиль",
                          "Мотоцикл",
                          "Коммерческий транспорт",
                          "Не указано",
                          null
                        ]
                      }
                      fuel_type: {
                        type: ["string", "null"]
                        enum: [
                          "Бензин",
                          "Дизель",
                          "Гибрид",
                          "Электро",
                          "Газ / LPG",
                          "Не указано",
                          null
                        ]
                      }
                      transmission: {
                        type: ["string", "null"]
                        enum: [
                          "Механика",
                          "Автомат",
                          "Полуавтомат",
                          "Вариатор",
                          "Не указано",
                          null
                        ]
                      }
                      doors: {
                        type: ["integer", "null"]
                      }
                      seats: {
                        type: ["integer", "null"]
                      }
                      engine_volume: {
                        type: ["string", "null"]
                      }
                      drivetrain: {type: ["string", "null"]}
                      owners_count: {type: ["integer", "null"]}
                      first_registration: {type: ["string", "null"]}
                      vehicle_condition: {type: ["string", "null"]}
                      seller_type: {type: ["string", "null"]}
                      seller_name: {type: ["string", "null"]}
                      seller_phone: {type: ["string", "null"]}
                      seller_email: {type: ["string", "null"]}
                      vin: {type: ["string", "null"]}
                      has_valid_tuv: {type: ["boolean", "null"]}
                      tuv_valid_until: {type: ["string", "null"]}
                      mileage: {type: ["integer", "null"]}
                      price: {type: ["number", "null"]}
                      currency: {type: ["string", "null"]}
                      city: {type: ["string", "null"]}
                      country: {type: ["string", "null"]}
                      description: {
                        type: ["string", "null"]
                      }
                    }
                    required: [
                      "title",
                      "brand",
                      "model",
                      "year",
                      "color",
                      "body_type",
                      "vehicle_type",
                      "fuel_type",
                      "transmission",
                      "doors",
                      "seats",
                      "engine_volume",
                      "drivetrain",
                      "owners_count",
                      "first_registration",
                      "vehicle_condition",
                      "seller_type",
                      "seller_name",
                      "seller_phone",
                      "seller_email",
                      "vin",
                      "has_valid_tuv",
                      "tuv_valid_until",
                      "mileage",
                      "price",
                      "currency",
                      "city",
                      "country",
                      "description"
                    ]
                  }

                  field_confidence: {
                    type: "object"
                    additionalProperties: false
                    properties: {
                      title: {type: "number"}
                      brand: {type: "number"}
                      model: {type: "number"}
                      year: {type: "number"}
                      color: {type: "number"}
                      body_type: {type: "number"}
                      vehicle_type: {type: "number"}
                      fuel_type: {type: "number"}
                      transmission: {type: "number"}
                      doors: {type: "number"}
                      seats: {type: "number"}
                      engine_volume: {type: "number"}
                      drivetrain: {type: "number"}
                      owners_count: {type: "number"}
                      first_registration: {type: "number"}
                      vehicle_condition: {type: "number"}
                      seller_type: {type: "number"}
                      seller_name: {type: "number"}
                      seller_phone: {type: "number"}
                      seller_email: {type: "number"}
                      vin: {type: "number"}
                      has_valid_tuv: {type: "number"}
                      tuv_valid_until: {type: "number"}
                      mileage: {type: "number"}
                      price: {type: "number"}
                      currency: {type: "number"}
                      city: {type: "number"}
                      country: {type: "number"}
                      description: {type: "number"}
                    }
                    required: [
                      "title",
                      "brand",
                      "model",
                      "year",
                      "color",
                      "body_type",
                      "vehicle_type",
                      "fuel_type",
                      "transmission",
                      "doors",
                      "seats",
                      "engine_volume",
                      "drivetrain", "owners_count", "first_registration", "vehicle_condition", "seller_type",
                      "seller_name", "seller_phone", "seller_email", "vin", "has_valid_tuv", "tuv_valid_until",
                      "mileage", "price", "currency", "city", "country",
                      "description"
                    ]
                  }

                  auto_fill_allowed: {
                    type: "object"
                    additionalProperties: false
                    properties: {
                      title: {type: "boolean"}
                      brand: {type: "boolean"}
                      model: {type: "boolean"}
                      year: {type: "boolean"}
                      color: {type: "boolean"}
                      body_type: {type: "boolean"}
                      vehicle_type: {type: "boolean"}
                      fuel_type: {type: "boolean"}
                      transmission: {type: "boolean"}
                      doors: {type: "boolean"}
                      seats: {type: "boolean"}
                      engine_volume: {type: "boolean"}
                      drivetrain: {type: "boolean"}
                      owners_count: {type: "boolean"}
                      first_registration: {type: "boolean"}
                      vehicle_condition: {type: "boolean"}
                      seller_type: {type: "boolean"}
                      seller_name: {type: "boolean"}
                      seller_phone: {type: "boolean"}
                      seller_email: {type: "boolean"}
                      vin: {type: "boolean"}
                      has_valid_tuv: {type: "boolean"}
                      tuv_valid_until: {type: "boolean"}
                      mileage: {type: "boolean"}
                      price: {type: "boolean"}
                      currency: {type: "boolean"}
                      city: {type: "boolean"}
                      country: {type: "boolean"}
                      description: {type: "boolean"}
                    }
                    required: [
                      "title",
                      "brand",
                      "model",
                      "year",
                      "color",
                      "body_type",
                      "vehicle_type",
                      "fuel_type",
                      "transmission",
                      "doors",
                      "seats",
                      "engine_volume",
                      "drivetrain", "owners_count", "first_registration", "vehicle_condition", "seller_type",
                      "seller_name", "seller_phone", "seller_email", "vin", "has_valid_tuv", "tuv_valid_until",
                      "mileage", "price", "currency", "city", "country",
                      "description"
                    ]
                  }

                  field_sources: {
                    type: "object"
                    additionalProperties: false
                    properties: {
                      title: {type: ["string", "null"]}
                      brand: {type: ["string", "null"]}
                      model: {type: ["string", "null"]}
                      year: {type: ["string", "null"]}
                      color: {type: ["string", "null"]}
                      body_type: {type: ["string", "null"]}
                      vehicle_type: {type: ["string", "null"]}
                      fuel_type: {type: ["string", "null"]}
                      transmission: {type: ["string", "null"]}
                      doors: {type: ["string", "null"]}
                      seats: {type: ["string", "null"]}
                      engine_volume: {type: ["string", "null"]}
                      drivetrain: {type: ["string", "null"]}
                      owners_count: {type: ["string", "null"]}
                      first_registration: {type: ["string", "null"]}
                      vehicle_condition: {type: ["string", "null"]}
                      seller_type: {type: ["string", "null"]}
                      seller_name: {type: ["string", "null"]}
                      seller_phone: {type: ["string", "null"]}
                      seller_email: {type: ["string", "null"]}
                      vin: {type: ["string", "null"]}
                      has_valid_tuv: {type: ["string", "null"]}
                      tuv_valid_until: {type: ["string", "null"]}
                      mileage: {type: ["string", "null"]}
                      price: {type: ["string", "null"]}
                      currency: {type: ["string", "null"]}
                      city: {type: ["string", "null"]}
                      country: {type: ["string", "null"]}
                      description: {type: ["string", "null"]}
                    }
                    required: [
                      "title",
                      "brand",
                      "model",
                      "year",
                      "color",
                      "body_type",
                      "vehicle_type",
                      "fuel_type",
                      "transmission",
                      "doors",
                      "seats",
                      "engine_volume",
                      "drivetrain", "owners_count", "first_registration", "vehicle_condition", "seller_type",
                      "seller_name", "seller_phone", "seller_email", "vin", "has_valid_tuv", "tuv_valid_until",
                      "mileage", "price", "currency", "city", "country",
                      "description"
                    ]
                  }

                  missing_fields: {
                    type: "array"
                    items: {
                      type: "string"
                    }
                  }

                  warnings: {
                    type: "array"
                    items: {
                      type: "string"
                    }
                  }

                  recommendations: {
                    type: "array"
                    items: {
                      type: "string"
                    }
                  }

                  photo_quality_score: {
                    type: ["integer", "null"]
                  }

                  listing_quality_score: {
                    type: ["integer", "null"]
                  }

                  ai_notes: {
                    type: ["string", "null"]
                  }
                }
                required: [
                  "normalized_fields",
                  "field_confidence",
                  "auto_fill_allowed",
                  "field_sources",
                  "missing_fields",
                  "warnings",
                  "recommendations",
                  "photo_quality_score",
                  "listing_quality_score",
                  "ai_notes"
                ]
              }
            }
          }
      }

      headers = []
        |push:$openai_auth_header
        |push:"Content-Type: application/json"
    } as $openai_response

    precondition ($openai_response.response.status == 200) {
      error_type = "inputerror"
      error = "AI не смог обработать фото. Попробуйте другие изображения."
    }

    var $openai_output_text {
      value = $openai_response.response.result.output[0].content[0].text
    }

    conditional {
      if (($openai_output_text == null) || ($openai_output_text == "")) {
        var.update $openai_output_text {
          value = $openai_response.response.result.output_text
        }
      }
    }

    precondition (($openai_output_text != null) && ($openai_output_text != "")) {
      error_type = "inputerror"
      error = "AI вернул пустой ответ."
    }

    var $ai_json {
      value = $openai_output_text|json_decode
    }

    var $fields {
      value = $ai_json.normalized_fields
    }

    var $title {
      value = $fields.title
    }

    conditional {
      if (($title == null) || ($title == "")) {
        var.update $title {
          value = "AI-черновик автомобиля"
        }
      }
    }

    var $brand {
      value = $fields.brand
    }

    conditional {
      if (($brand == null) || ($brand == "")) {
        var.update $brand {
          value = "Не определено"
        }
      }
    }

    var $model_name {
      value = $fields.model
    }

    conditional {
      if (($model_name == null) || ($model_name == "")) {
        var.update $model_name {
          value = "Модель уточняется"
        }
      }
    }

    var $year {
      value = $fields.year
    }

    conditional {
      if ($year == null) {
        var.update $year {
          value = 0
        }
      }
    }

    var $color {
      value = $fields.color
    }

    conditional {
      if (($color == null) || ($color == "")) {
        var.update $color {
          value = "Не указано"
        }
      }
    }

    var $body_type {
      value = $fields.body_type
    }

    conditional {
      if (($body_type == null) || ($body_type == "")) {
        var.update $body_type {
          value = "Не указано"
        }
      }
    }

    var $vehicle_type {
      value = $fields.vehicle_type
    }

    conditional {
      if (($vehicle_type == null) || ($vehicle_type == "")) {
        var.update $vehicle_type {
          value = "Легковой автомобиль"
        }
      }
    }

    var $fuel_type {
      value = $fields.fuel_type
    }

    conditional {
      if (($fuel_type == null) || ($fuel_type == "")) {
        var.update $fuel_type {
          value = "Не указано"
        }
      }
    }

    var $transmission {
      value = $fields.transmission
    }

    conditional {
      if (($transmission == null) || ($transmission == "")) {
        var.update $transmission {
          value = "Не указано"
        }
      }
    }

    var $doors {
      value = $fields.doors
    }

    var $seats {
      value = $fields.seats
    }

    var $engine_volume {
      value = $fields.engine_volume
    }

    var $description {
      value = $fields.description
    }

    conditional {
      if (($description == null) || ($description == "")) {
        var.update $description {
          value = "AI создал черновик по фотографиям. Перед отправкой на модерацию продавцу нужно проверить и подтвердить характеристики автомобиля."
        }
      }
    }

    var $avg_confidence {
      value = 0
    }

    conditional {
      if ($ai_json.field_confidence.brand != null) {
        var.update $avg_confidence {
          value = $ai_json.field_confidence.brand
        }
      }
    }

    db.edit car_drafts {
      field_name = "id"
      field_value = $draft.id
      data = {
        title             : $title
        brand             : $brand
        model             : $model_name
        year              : $year
        mileage           : $fields.mileage|first_notnull:0
        fuel_type         : $fuel_type
        transmission      : $transmission
        drivetrain        : $fields.drivetrain
        body_type         : $body_type
        vehicle_type      : $vehicle_type
        engine_volume     : $engine_volume
        color             : $color
        doors             : $doors
        seats             : $seats
        owners_count      : $fields.owners_count
        first_registration: $fields.first_registration
        vehicle_condition : $fields.vehicle_condition
        seller_type       : $fields.seller_type
        seller_name       : $fields.seller_name
        seller_phone      : $fields.seller_phone
        seller_email      : $fields.seller_email
        vin               : $fields.vin
        has_valid_tuv     : $fields.has_valid_tuv
        tuv_valid_until   : $fields.tuv_valid_until
        price             : $fields.price|first_notnull:0
        currency          : $fields.currency|first_notnull:"EUR"
        city              : $fields.city|first_notnull:""
        country           : $fields.country|first_notnull:"Германия"
        description       : $description
        confidence        : $avg_confidence
        ai_notes          : $ai_json.ai_notes
        ai_payload        : $ai_json
        ai_raw_response   : $openai_response.response.result
        status            : "ai_draft"
        updated_at        : now
      }
    } as $draft

    var $credits_after {
      value = $credits.ai_credits - 1
    }

    var $daily_after {
      value = $credits.ai_daily_generations + 1
    }

    var $monthly_after {
      value = $credits.ai_monthly_generations + 1
    }

    var $credit_amount {
      value = -1
    }

    db.edit user_credits {
      field_name = "id"
      field_value = $credits.id
      data = {
        ai_credits            : $credits_after
        ai_daily_generations  : $daily_after
        ai_monthly_generations: $monthly_after
        updated_at            : now
      }
    } as $credits

    conditional {
      if ($credit_amount != 0) {
        db.add credit_transactions {
          data = {
            user_id       : $auth.id
            type          : "usage"
            amount        : $credit_amount
            balance_after : $credits_after
            related_car_id: null
            notes         : "AI form autofill draft created from photos"
          }
        } as $transaction
      }
    }

    db.edit ai_generation_logs {
      field_name = "id"
      field_value = $log.id
      data = {
        status       : "success"
        draft_id     : $draft.id
        credits_after: $credits_after
        raw_response : $openai_response.response.result
        updated_at   : now
      }
    } as $log

    db.query car_draft_images {
      where = ($db.car_draft_images.draft_id == $draft.id)
      return = {type: "list"}
    } as $images
  }

  response = {
    success            : true
    message            : "AI-черновик создан. Поля формы заполнены автоматически, но пользователь должен подтвердить данные."
    draft_id           : $draft.id
    draft              : $draft
    images             : $images
    ai_credits         : $credits_after
    status             : "ai_draft"
    normalized_fields  : $ai_json.normalized_fields
    field_confidence   : $ai_json.field_confidence
    auto_fill_allowed  : $ai_json.auto_fill_allowed
    field_sources      : $ai_json.field_sources
    missing_fields     : $ai_json.missing_fields
    warnings           : $ai_json.warnings
    recommendations    : $ai_json.recommendations
    photo_quality_score: $ai_json.photo_quality_score
    listing_score      : $ai_json.listing_quality_score
    ai_notes           : $ai_json.ai_notes
  }

  tags = [
    "sitecraft-auto-market"
    "ai"
    "drafts"
    "analyze-photos"
    "form-autofill"
  ]
}
