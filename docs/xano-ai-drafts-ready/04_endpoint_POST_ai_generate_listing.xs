// Endpoint: POST /ai/generate-listing
// Создаёт AI-черновик объявления по 1-4 фото.
// Frontend сначала загружает фото в Cloudflare R2 и отправляет r2_images JSON.
// AI-помощник больше не сохраняет фото в Xano File Storage.

query "ai/generate-listing" verb=POST {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    text r2_images? filters=trim
    file photo_1?
    file photo_2?
    file photo_3?
    file photo_4?
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "Войдите в кабинет, чтобы создать AI-черновик."
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
      error = "Фото должны быть сначала загружены в Cloudflare R2. Попробуйте отправить фото ещё раз."
    }

    precondition ($photo_count <= 4) {
      error_type = "inputerror"
      error = "Для AI-черновика можно загрузить максимум 4 фото."
    }

    db.get automarket_users {
      field_name = "id"
      field_value = $auth.id
    } as $auth_user

    var $is_unlimited_admin {
      value = false
    }

    conditional {
      if (($auth_user.email == "ivanovdavid119@gmail.com") || ($auth_user.email == "ivanovdavid19@gmail.com")) {
        var.update $is_unlimited_admin {
          value = true
        }

        db.edit automarket_users {
          field_name = "id"
          field_value = $auth.id
          data = {
            role: "admin"
            updated_at: now
          }
        } as $auth_user
      }
    }

    db.get user_credits {
      field_name = "user_id"
      field_value = $auth.id
    } as $credits

    var $initial_ai_credits {
      value = 0
    }

    conditional {
      if ($is_unlimited_admin == true) {
        var.update $initial_ai_credits {
          value = 1000000000
        }
      }
    }

    conditional {
      if ($credits == null) {
        db.add user_credits {
          data = {
            user_id: $auth.id
            ai_credits: $initial_ai_credits
            ai_daily_generations: 0
            ai_monthly_generations: 0
            ai_daily_reset_date: now
            ai_monthly_reset_date: now
          }
        } as $credits
      }
    }

    conditional {
      if ($is_unlimited_admin == true) {
        db.edit user_credits {
          field_name = "id"
          field_value = $credits.id
          data = {
            ai_credits: 1000000000
            ai_daily_generations: 0
            ai_monthly_generations: 0
            updated_at: now
          }
        } as $credits
      }
    }

    conditional {
      if ($is_unlimited_admin != true) {
        precondition ($credits.ai_credits > 0) {
          error_type = "accessdenied"
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
      }
    }

    db.add ai_generation_logs {
      data = {
        user_id: $auth.id
        model: $model
        status: "started"
        photo_count: $photo_count
        total_photo_bytes: 0
        credits_before: $credits.ai_credits
      }
    } as $log

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

    var $user_content {
      value = []
    }

    array.push $user_content {
      value = {
        type: "input_text"
        text: "Создай объявление автомобиля по этим фотографиям. Если часть данных не видна, верни null. Объявление должно быть пригодно для отправки на модерацию."
      }
    }

    var $sort_order {
      value = 0
    }

    foreach ($r2_images) {
      each as $r2_image {
        array.push $image_urls {
          value = $r2_image.url
        }

        array.push $user_content {
          value = {
            type: "input_image"
            image_url: $r2_image.url
          }
        }

        db.add car_draft_images {
          data = {
            user_id: $auth.id
            draft_id: $draft.id
            sort_order: $sort_order
            is_primary: ($sort_order == 0)
            image_url: $r2_image.url
            mime_type: $r2_image.contentType
            original_filename: $r2_image.key
            size_bytes: $r2_image.size
            image_metadata: $r2_image
          }
        } as $draft_image

        var.update $sort_order {
          value = $sort_order + 1
        }
      }
    }

    var $openai_auth_header {
      value = "Authorization: Bearer "
        |concat:$env.OPENAI_API_KEY
    }

    api.request {
      url = "https://api.openai.com/v1/responses"
      method = "POST"
      params = {
        model: $model
        store: false
        input: [
          {
            role: "developer"
            content: [
              {
                type: "input_text"
                text: "Ты эксперт по объявлениям автомобилей. Проанализируй фото и верни только JSON. Не выдумывай VIN, пробег, цену, город, количество владельцев и дату первой регистрации. Если поле нельзя определить, верни null. Для обязательных публичных полей можно дать нейтральный вариант: vehicle_type = Легковой автомобиль, body_type = Не указано, fuel_type = Не указано, transmission = Не указано, city = Не указано, price = 0. Описание пиши на русском языке."
              }
            ]
          }
          {
            role: "user"
            content: $user_content
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
      if ($openai_output_text == null || $openai_output_text == "") {
        var.update $openai_output_text {
          value = $openai_response.response.result.output_text
        }
      }
    }

    precondition ($openai_output_text != null && $openai_output_text != "") {
      error_type = "inputerror"
      error = "AI вернул пустой ответ. Попробуйте другое фото."
    }

    var $draft_json {
      value = ($openai_output_text|json_decode)
    }

    var $title {
      value = $draft_json.title
    }

    conditional {
      if ($title == null) {
        var.update $title {
          value = "Автомобиль по фото"
        }
      }
    }

    var $brand {
      value = $draft_json.brand
    }

    conditional {
      if ($brand == null) {
        var.update $brand {
          value = "Не определено"
        }
      }
    }

    var $model_name {
      value = $draft_json.model
    }

    conditional {
      if ($model_name == null) {
        var.update $model_name {
          value = "Модель уточняется"
        }
      }
    }

    var $year {
      value = $draft_json.year
    }

    conditional {
      if ($year == null) {
        var.update $year {
          value = 0
        }
      }
    }

    var $mileage {
      value = $draft_json.mileage
    }

    conditional {
      if ($mileage == null) {
        var.update $mileage {
          value = 0
        }
      }
    }

    var $fuel_type {
      value = $draft_json.fuel_type
    }

    conditional {
      if ($fuel_type == null) {
        var.update $fuel_type {
          value = "Не указано"
        }
      }
    }

    var $transmission {
      value = $draft_json.transmission
    }

    conditional {
      if ($transmission == null) {
        var.update $transmission {
          value = "Не указано"
        }
      }
    }

    var $body_type {
      value = $draft_json.body_type
    }

    conditional {
      if ($body_type == null) {
        var.update $body_type {
          value = "Не указано"
        }
      }
    }

    var $vehicle_type {
      value = $draft_json.vehicle_type
    }

    conditional {
      if ($vehicle_type == null) {
        var.update $vehicle_type {
          value = "Легковой автомобиль"
        }
      }
    }

    var $price {
      value = $draft_json.price
    }

    conditional {
      if ($price == null) {
        var.update $price {
          value = 0
        }
      }
    }

    var $city {
      value = $draft_json.city
    }

    conditional {
      if ($city == null) {
        var.update $city {
          value = "Не указано"
        }
      }
    }

    var $description {
      value = $draft_json.description
    }

    conditional {
      if ($description == null) {
        var.update $description {
          value = "Объявление создано AI по фотографиям. Продавцу рекомендуется уточнить характеристики перед финальной публикацией."
        }
      }
    }

    db.edit car_drafts {
      field_name = "id"
      field_value = $draft.id
      data = {
        title: $title
        brand: $brand
        model: $model_name
        year: $year
        mileage: $mileage
        fuel_type: $fuel_type
        transmission: $transmission
        body_type: $body_type
        vehicle_type: $vehicle_type
        engine_volume: $draft_json.engine_volume
        first_registration: $draft_json.first_registration
        owners_count: $draft_json.owners_count
        color: $draft_json.color
        price: $price
        city: $city
        description: $description
        confidence: $draft_json.confidence
        ai_notes: $draft_json.ai_notes
        ai_payload: $draft_json
        ai_raw_response: $openai_response.response.result
        status: "pending_review"
        updated_at: now
      }
    } as $draft

    var $slug {
      value = $brand
        |concat:" "
        |concat:$model_name
        |concat:" "
        |concat:$year
        |to_lower
        |replace:" ":"-"
        |concat:"-"
        |concat:$draft.id
    }

    db.add car_listings {
      data = {
        created_at: "now"
        updated_at: "now"
        user_id: $auth.id
        draft_id: $draft.id
        slug: $slug
        title: $title
        brand: $brand
        model: $model_name
        year: $year
        mileage: $mileage
        fuel_type: $fuel_type
        transmission: $transmission
        body_type: $body_type
        vehicle_type: $vehicle_type
        engine_volume: $draft_json.engine_volume
        first_registration: $draft_json.first_registration
        owners_count: $draft_json.owners_count
        color: $draft_json.color
        price: $price
        currency: "EUR"
        city: $city
        country: "Германия"
        description: $description
        status: "pending_review"
        moderation_status: "pending_review"
        is_ai_generated: true
        main_image_url: ""
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
            created_at: "now"
            updated_at: "now"
            car_listing_id: $car.id
            sort_order: $draft_image.sort_order
            is_main: $draft_image.is_primary
            is_primary: $draft_image.is_primary
            image_url: $draft_image.image_url
            mime_type: $draft_image.mime_type
            original_filename: $draft_image.original_filename
            size_bytes: $draft_image.size_bytes
            image_metadata: $draft_image.image_metadata
            is_deleted: false
          }
        } as $car_image

        conditional {
          if ($draft_image.sort_order == 0) {
            db.edit car_listings {
              field_name = "id"
              field_value = $car.id
              data = {
                updated_at: "now"
                main_image_url: $draft_image.image_url
              }
            } as $car
          }
        }
      }
    }

    db.edit car_drafts {
      field_name = "id"
      field_value = $draft.id
      data = {
        car_id: $car.id
        updated_at: now
      }
    } as $draft

    var $credits_after {
      value = $credits.ai_credits
    }

    var $daily_after {
      value = $credits.ai_daily_generations
    }

    var $monthly_after {
      value = $credits.ai_monthly_generations
    }

    var $credit_amount {
      value = 0
    }

    conditional {
      if ($is_unlimited_admin == true) {
        var.update $credits_after {
          value = 1000000000
        }

        var.update $daily_after {
          value = 0
        }

        var.update $monthly_after {
          value = 0
        }
      }
    }

    conditional {
      if ($is_unlimited_admin != true) {
        var.update $credits_after {
          value = $credits.ai_credits - 1
        }

        var.update $daily_after {
          value = $credits.ai_daily_generations + 1
        }

        var.update $monthly_after {
          value = $credits.ai_monthly_generations + 1
        }

        var.update $credit_amount {
          value = -1
        }
      }
    }

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
        amount: $credit_amount
        balance_after: $credits_after
        related_car_id: $car.id
        notes: "AI listing created and sent to moderation"
      }
    } as $transaction

    db.edit ai_generation_logs {
      field_name = "id"
      field_value = $log.id
      data = {
        status: "success"
        draft_id: $draft.id
        credits_after: $credits_after
        raw_response: $openai_response.response.result
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
    car: $car
    car_id: $car.id
    slug: $car.slug
    status: $car.status
    images: $images
    ai_credits: $credits_after
  }

  tags = ["sitecraft-auto-market", "ai", "drafts"]
}
