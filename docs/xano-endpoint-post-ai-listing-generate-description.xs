// Xano endpoint: POST /ai/listing/generate-description
// Generates description variants without publishing, moderation, or credit usage.
query "ai/listing/generate-description" verb=POST {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    json fields?
    json analysis?
    json r2_images?
    text mode? filters=trim
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }

    precondition (($input.fields != null) && ($input.fields|is_object) && (($input.fields|count) > 0)) {
      error_type = "inputerror"
      error = "fields is required"
    }

    precondition (($input.mode == "sales") || ($input.mode == "short") || ($input.mode == "technical") || ($input.mode == "de") || ($input.mode == "kleinanzeigen") || ($input.mode == "whatsapp")) {
      error_type = "inputerror"
      error = "Unsupported description mode"
    }

    var $analysis {
      value = $input.analysis|first_notnull:{}
    }

    var $images {
      value = $input.r2_images|first_notnull:[]
    }

    precondition (($images|is_array) && (($images|count) <= 8)) {
      error_type = "inputerror"
      error = "r2_images must contain no more than 8 images"
    }

    var $rate_limit_after {
      value = now|add_secs_to_timestamp:-3600
    }

    db.query ai_description_generations {
      where = (($db.ai_description_generations.user_id == $auth.id) && ($db.ai_description_generations.created_at >= $rate_limit_after) && (($db.ai_description_generations.status == "success") || ($db.ai_description_generations.status == "fallback")))
      return = {type: "list"}
    } as $recent_generations

    precondition (($recent_generations|count) < 20) {
      error_type = "toomanyrequests"
      error = "Description generation rate limit reached. Try again later."
    }

    var $title_raw { value = $input.fields|get:"title":""|first_notnull:""|to_text|trim }
    var $brand_raw { value = $input.fields|get:"brand":""|first_notnull:""|to_text|trim }
    var $model_raw { value = $input.fields|get:"model":""|first_notnull:""|to_text|trim }
    var $year_raw { value = $input.fields|get:"year":0|first_notnull:0|to_int }
    var $mileage_raw { value = $input.fields|get:"mileage":0|first_notnull:0|to_int }
    var $price_raw { value = $input.fields|get:"price":0|first_notnull:0|to_decimal }
    var $city_raw { value = $input.fields|get:"city":""|first_notnull:""|to_text|trim }
    var $country_raw { value = $input.fields|get:"country":""|first_notnull:""|to_text|trim }
    var $vehicle_type_raw { value = $input.fields|get:"vehicle_type":""|first_notnull:""|to_text|trim }
    var $body_type_raw { value = $input.fields|get:"body_type":""|first_notnull:""|to_text|trim }
    var $color_raw { value = $input.fields|get:"color":""|first_notnull:""|to_text|trim }
    var $fuel_type_raw { value = $input.fields|get:"fuel_type":""|first_notnull:""|to_text|trim }
    var $transmission_raw { value = $input.fields|get:"transmission":""|first_notnull:""|to_text|trim }
    var $doors_raw { value = $input.fields|get:"doors":""|first_notnull:""|to_text|trim }
    var $seats_raw { value = $input.fields|get:"seats":""|first_notnull:""|to_text|trim }
    var $engine_volume_raw { value = $input.fields|get:"engine_volume":""|first_notnull:""|to_text|trim }
    var $vin_raw { value = $input.fields|get:"vin":""|first_notnull:""|to_text|trim }
    var $has_valid_tuv_raw { value = $input.fields|get:"has_valid_tuv":null }
    var $tuv_valid_until_raw { value = $input.fields|get:"tuv_valid_until":""|first_notnull:""|to_text|trim }
    var $existing_description_raw { value = $input.fields|get:"description":""|first_notnull:""|to_text|trim }

    var $title { value = null }
    var $brand { value = null }
    var $model_name { value = null }
    var $year { value = null }
    var $mileage { value = null }
    var $price { value = null }
    var $city { value = null }
    var $country { value = null }
    var $vehicle_type { value = null }
    var $body_type { value = null }
    var $color { value = null }
    var $fuel_type { value = null }
    var $transmission { value = null }
    var $doors { value = null }
    var $seats { value = null }
    var $engine_volume { value = null }
    var $existing_description { value = null }

    conditional { if ($title_raw != "") { var.update $title { value = $title_raw } } }
    conditional { if ($brand_raw != "") { var.update $brand { value = $brand_raw } } }
    conditional { if ($model_raw != "") { var.update $model_name { value = $model_raw } } }
    conditional { if ($year_raw > 0) { var.update $year { value = $year_raw } } }
    conditional { if ($mileage_raw >= 0 && ($input.fields|has:"mileage")) { var.update $mileage { value = $mileage_raw } } }
    conditional { if ($price_raw > 0) { var.update $price { value = $price_raw } } }
    conditional { if ($city_raw != "") { var.update $city { value = $city_raw } } }
    conditional { if ($country_raw != "") { var.update $country { value = $country_raw } } }
    conditional { if ($vehicle_type_raw != "") { var.update $vehicle_type { value = $vehicle_type_raw } } }
    conditional { if ($body_type_raw != "") { var.update $body_type { value = $body_type_raw } } }
    conditional { if ($color_raw != "") { var.update $color { value = $color_raw } } }
    conditional { if ($fuel_type_raw != "") { var.update $fuel_type { value = $fuel_type_raw } } }
    conditional { if ($transmission_raw != "") { var.update $transmission { value = $transmission_raw } } }
    conditional { if ($doors_raw != "") { var.update $doors { value = $doors_raw } } }
    conditional { if ($seats_raw != "") { var.update $seats { value = $seats_raw } } }
    conditional { if ($engine_volume_raw != "") { var.update $engine_volume { value = $engine_volume_raw } } }
    conditional { if ($existing_description_raw != "") { var.update $existing_description { value = $existing_description_raw } } }

    var $facts {
      value = {
        title               : $title
        brand               : $brand
        model               : $model_name
        year                : $year
        mileage             : $mileage
        price               : $price
        currency            : "EUR"
        city                : $city
        country             : $country
        vehicle_type        : $vehicle_type
        body_type           : $body_type
        color               : $color
        fuel_type           : $fuel_type
        transmission        : $transmission
        doors               : $doors
        seats               : $seats
        engine_volume       : $engine_volume
        vin_present         : ($vin_raw != "")
        has_valid_tuv       : $has_valid_tuv_raw
        tuv_valid_until     : $tuv_valid_until_raw
        existing_description: $existing_description
      }
    }
    var $log_facts {
      value = $facts|unpick:["existing_description"]
    }

    var $fallback_title { value = $title_raw }
    conditional {
      if ($fallback_title == "") {
        var.update $fallback_title { value = $brand_raw }
        conditional { if ($model_raw != "") { text.append $fallback_title { value = " "|concat:$model_raw } } }
        conditional { if ($year_raw > 0) { text.append $fallback_title { value = " "|concat:$year_raw } } }
      }
    }
    conditional { if ($fallback_title == "") { var.update $fallback_title { value = "Автомобиль" } } }

    var $fallback_description { value = $fallback_title }
    var $language { value = "ru" }
    conditional { if (($input.mode == "de") || ($input.mode == "kleinanzeigen") || ($input.mode == "whatsapp")) { var.update $language { value = "de" } } }

    conditional {
      if ($input.mode == "sales") {
        text.append $fallback_description { value = " предлагается к продаже." }
        conditional { if ($year_raw > 0) { text.append $fallback_description { value = " Год выпуска — "|concat:$year_raw|concat:"." } } }
        conditional { if ($fuel_type_raw != "") { text.append $fallback_description { value = " Топливо — "|concat:$fuel_type_raw|concat:"." } } }
        conditional { if ($transmission_raw != "") { text.append $fallback_description { value = " Коробка передач — "|concat:$transmission_raw|concat:"." } } }
        conditional { if (($input.fields|has:"mileage") && ($mileage_raw >= 0)) { text.append $fallback_description { value = " Пробег — "|concat:$mileage_raw|concat:" км." } } }
        conditional { if ($price_raw > 0) { text.append $fallback_description { value = " Цена — "|concat:$price_raw|concat:" €." } } }
        conditional { if ($city_raw != "") { text.append $fallback_description { value = " Автомобиль находится в городе "|concat:$city_raw|concat:"." } } }
        text.append $fallback_description { value = " Информация составлена по данным продавца и требует подтверждения перед покупкой." }
      }
    }

    conditional {
      if ($input.mode == "short") {
        conditional { if ($year_raw > 0) { text.append $fallback_description { value = ", "|concat:$year_raw } } }
        conditional { if ($fuel_type_raw != "") { text.append $fallback_description { value = ", "|concat:$fuel_type_raw } } }
        conditional { if ($transmission_raw != "") { text.append $fallback_description { value = ", "|concat:$transmission_raw } } }
        conditional { if (($input.fields|has:"mileage") && ($mileage_raw >= 0)) { text.append $fallback_description { value = ", пробег "|concat:$mileage_raw|concat:" км" } } }
        conditional { if ($price_raw > 0) { text.append $fallback_description { value = ", цена "|concat:$price_raw|concat:" €" } } }
        conditional { if ($city_raw != "") { text.append $fallback_description { value = ", "|concat:$city_raw } } }
        text.append $fallback_description { value = ". Данные объявления требуют подтверждения продавцом." }
      }
    }

    conditional {
      if ($input.mode == "technical") {
        text.append $fallback_description { value = "." }
        conditional { if ($year_raw > 0) { text.append $fallback_description { value = " Год: "|concat:$year_raw|concat:"." } } }
        conditional { if ($body_type_raw != "") { text.append $fallback_description { value = " Кузов: "|concat:$body_type_raw|concat:"." } } }
        conditional { if ($fuel_type_raw != "") { text.append $fallback_description { value = " Топливо: "|concat:$fuel_type_raw|concat:"." } } }
        conditional { if ($transmission_raw != "") { text.append $fallback_description { value = " Коробка: "|concat:$transmission_raw|concat:"." } } }
        conditional { if (($input.fields|has:"mileage") && ($mileage_raw >= 0)) { text.append $fallback_description { value = " Пробег: "|concat:$mileage_raw|concat:" км." } } }
        conditional { if ($price_raw > 0) { text.append $fallback_description { value = " Цена: "|concat:$price_raw|concat:" €." } } }
        text.append $fallback_description { value = " Данные требуют подтверждения продавцом." }
      }
    }

    conditional {
      if ($input.mode == "de") {
        conditional { if ($year_raw > 0) { text.append $fallback_description { value = ", Baujahr "|concat:$year_raw|concat:"." } } }
        conditional { if ($fuel_type_raw != "") { text.append $fallback_description { value = " Kraftstoff: "|concat:$fuel_type_raw|concat:"." } } }
        conditional { if ($transmission_raw != "") { text.append $fallback_description { value = " Getriebe: "|concat:$transmission_raw|concat:"." } } }
        conditional { if (($input.fields|has:"mileage") && ($mileage_raw >= 0)) { text.append $fallback_description { value = " Kilometerstand: "|concat:$mileage_raw|concat:" km." } } }
        conditional { if ($price_raw > 0) { text.append $fallback_description { value = " Preis: "|concat:$price_raw|concat:" €." } } }
        conditional { if ($city_raw != "") { text.append $fallback_description { value = " Standort: "|concat:$city_raw|concat:"." } } }
        text.append $fallback_description { value = " Alle Angaben basieren auf den Angaben des Verkäufers. Besichtigung nach vorheriger Absprache möglich." }
      }
    }

    conditional {
      if ($input.mode == "kleinanzeigen") {
        var.update $fallback_description { value = "Zum Verkauf steht ein "|concat:$fallback_title|concat:"." }
        conditional { if ($year_raw > 0) { text.append $fallback_description { value = " Baujahr: "|concat:$year_raw|concat:"." } } }
        conditional { if ($fuel_type_raw != "") { text.append $fallback_description { value = " Kraftstoff: "|concat:$fuel_type_raw|concat:"." } } }
        conditional { if ($transmission_raw != "") { text.append $fallback_description { value = " Getriebe: "|concat:$transmission_raw|concat:"." } } }
        conditional { if (($input.fields|has:"mileage") && ($mileage_raw >= 0)) { text.append $fallback_description { value = " Kilometerstand: "|concat:$mileage_raw|concat:" km." } } }
        conditional { if ($price_raw > 0) { text.append $fallback_description { value = " Preis: "|concat:$price_raw|concat:" €." } } }
        conditional { if ($city_raw != "") { text.append $fallback_description { value = " Standort: "|concat:$city_raw|concat:"." } } }
        text.append $fallback_description { value = " Bei Interesse gerne eine Nachricht senden." }
      }
    }

    conditional {
      if ($input.mode == "whatsapp") {
        conditional { if ($year_raw > 0) { text.append $fallback_description { value = ", Baujahr "|concat:$year_raw } } }
        conditional { if ($fuel_type_raw != "") { text.append $fallback_description { value = ", "|concat:$fuel_type_raw } } }
        conditional { if ($transmission_raw != "") { text.append $fallback_description { value = ", "|concat:$transmission_raw } } }
        conditional { if (($input.fields|has:"mileage") && ($mileage_raw >= 0)) { text.append $fallback_description { value = ", "|concat:$mileage_raw|concat:" km" } } }
        conditional { if ($price_raw > 0) { text.append $fallback_description { value = ", "|concat:$price_raw|concat:" €" } } }
        conditional { if ($city_raw != "") { text.append $fallback_description { value = ". Standort: "|concat:$city_raw } } }
        text.append $fallback_description { value = ". Bei Interesse gerne melden." }
      }
    }

    var $warnings {
      value = []
    }
    var $recommendations {
      value = []
    }
    var $facts_used {
      value = []
    }
    var $omitted_fields {
      value = []
    }
    conditional { if ($brand != null) { array.push $facts_used { value = "Марка" } } }
    conditional { if ($brand == null) { array.push $omitted_fields { value = "Марка" } } }
    conditional { if ($model_name != null) { array.push $facts_used { value = "Модель" } } }
    conditional { if ($model_name == null) { array.push $omitted_fields { value = "Модель" } } }
    conditional { if ($year != null) { array.push $facts_used { value = "Год" } } }
    conditional { if ($year == null) { array.push $omitted_fields { value = "Год" } } }
    conditional { if ($mileage != null) { array.push $facts_used { value = "Пробег" } } }
    conditional { if ($mileage == null) { array.push $omitted_fields { value = "Пробег" } } }
    conditional { if ($price != null) { array.push $facts_used { value = "Цена" } } }
    conditional { if ($price == null) { array.push $omitted_fields { value = "Цена" } } }
    conditional { if ($city != null) { array.push $facts_used { value = "Город" } } }
    conditional { if ($city == null) { array.push $omitted_fields { value = "Город" } } }

    var $safe_image_content { value = [] }
    var $invalid_image_count { value = 0 }
    foreach ($images) {
      each as $image {
        var $image_url { value = $image|get:"url":""|first_notnull:""|to_text|trim }
        conditional {
          if (($image_url|starts_with:"https://") && (($safe_image_content|count) < 4)) {
            array.push $safe_image_content { value = {type: "input_image", image_url: $image_url} }
          }
          else {
            conditional {
              if (($image_url|starts_with:"https://") == false) { var.update $invalid_image_count { value = $invalid_image_count + 1 } }
            }
          }
        }
      }
    }
    conditional { if ($invalid_image_count > 0) { array.push $warnings { value = "Некоторые изображения не использованы: требуется публичный HTTPS URL." } } }

    var $analysis_missing { value = $analysis|get:"missing_fields":[]|first_notnull:[] }
    var $analysis_warnings { value = $analysis|get:"warnings":[]|first_notnull:[] }
    var $analysis_recommendations { value = $analysis|get:"recommendations":[]|first_notnull:[] }
    var $analysis_summary { value = {missing_fields: $analysis_missing, warnings: $analysis_warnings, recommendations: $analysis_recommendations} }

    var $description { value = $fallback_description }
    var $output_title { value = $fallback_title }
    var $fallback { value = true }
    var $status { value = "fallback" }
    var $error_message { value = null }
    var $response_model { value = "local-template" }
    var $provider_model { value = $env.OPENAI_CAR_AI_MODEL }
    conditional { if (($provider_model == null) || ($provider_model == "")) { var.update $provider_model { value = "gpt-5.4-mini" } } }

    var $user_text {
      value = {mode: $input.mode, normalized_facts: $facts, analysis: $analysis_summary}|json_encode
    }
    var $user_content {
      value = [
        {
          type: "input_text"
          text: $user_text
        }
      ]
    }
    foreach ($safe_image_content) { each as $safe_image { array.push $user_content { value = $safe_image } } }

    var $openai_auth_header { value = "Authorization: Bearer "|concat:$env.OPENAI_API_KEY }
    api.request {
      url = "https://api.openai.com/v1/responses"
      method = "POST"
      params = {
        model: $provider_model
        input: [
          {role: "developer", content: [{type: "input_text", text: "Ты редактор объявлений автомобильного маркетплейса в Германии. Создавай честные тексты только на основе переданных фактов и осторожных видимых признаков фото. Не придумывай техническое состояние, сервисную историю, ДТП, комплектацию, TÜV/HU, владельцев, гарантию или рыночную стоимость. Если данных нет — не добавляй их. Не включай телефон, email, VIN или персональные данные. Соблюдай режим: sales 700-1400 символов на русском; short 250-500 на языке исходного текста; technical 500-1000 на русском без рекламы; de 700-1400 на немецком; kleinanzeigen 600-1200 на немецком без Privatverkauf, если это не указано; whatsapp 200-500 на немецком. Верни только JSON по схеме."}]}
          {role: "user", content: $user_content}
        ]
        text: {
          format: {
            type: "json_schema"
            name: "car_listing_description"
            strict: true
            schema: {
              type: "object"
              additionalProperties: false
              properties: {
                title: {type: "string"}
                description: {type: "string", minLength: 1}
                language: {type: "string", enum: ["ru", "de"]}
                mode: {type: "string", enum: ["sales", "short", "technical", "de", "kleinanzeigen", "whatsapp"]}
                warnings: {type: "array", items: {type: "string"}}
                recommendations: {type: "array", items: {type: "string"}}
                facts_used: {type: "array", items: {type: "string"}}
                omitted_fields: {type: "array", items: {type: "string"}}
              }
              required: ["title", "description", "language", "mode", "warnings", "recommendations", "facts_used", "omitted_fields"]
            }
          }
        }
      }
      headers = []|push:$openai_auth_header|push:"Content-Type: application/json"
    } as $openai_response

    var $provider_status {
      value = $openai_response.response.status
    }
    var $provider_error_message {
      value = $openai_response.response.result|get:"error.message":""
    }

    conditional {
      if ($openai_response.response.status == 200) {
        var $output_text { value = $openai_response.response.result.output[0].content[0].text }
        conditional {
          if (($output_text == null) || ($output_text == "")) {
            var.update $output_text { value = $openai_response.response.result.output_text }
          }
        }
        conditional {
          if (($output_text != null) && ($output_text != "")) {
            try_catch {
              try {
                var $ai_result { value = $output_text|json_decode }
                conditional {
                  if (($ai_result.description != "") && ($ai_result.mode == $input.mode)) {
                    var.update $description { value = $ai_result.description }
                    var.update $output_title { value = $ai_result.title }
                    var.update $language { value = $ai_result.language }
                    var.update $warnings { value = $warnings|merge:$ai_result.warnings|unique }
                    var.update $recommendations { value = $ai_result.recommendations }
                    var.update $facts_used { value = $ai_result.facts_used }
                    var.update $omitted_fields { value = $ai_result.omitted_fields }
                    var.update $fallback { value = false }
                    var.update $status { value = "success" }
                    var.update $response_model { value = $provider_model }
                  }
                  else { var.update $error_message { value = "OpenAI response failed mode or description validation" } }
                }
              }
              catch { var.update $error_message { value = "OpenAI output was not valid JSON" } }
            }
          }
          else { var.update $error_message { value = "OpenAI returned empty output_text" } }
        }
      }
      else {
        var.update $error_message {
          value = "OpenAI status "|concat:$provider_status|concat:": "|concat:$provider_error_message
        }
      }
    }

    conditional { if ($fallback) { array.push $warnings { value = "AI временно недоступен; использован локальный шаблон." } } }
    var $draft_record_id { value = $analysis|get:"draft.id":null }
    var $car_record_id { value = $input.fields|get:"id":null }

    db.add ai_description_generations {
      data = {
        created_at        : now
        updated_at        : now
        user_id           : $auth.id
        draft_id          : $draft_record_id
        car_id            : $car_record_id
        mode              : $input.mode
        language          : $language
        input_fields      : $log_facts
        analysis_summary  : $analysis_summary
        image_count       : $safe_image_content|count
        output_title      : $output_title
        output_description: $description
        warnings          : $warnings
        recommendations   : $recommendations
        facts_used        : $facts_used
        omitted_fields    : $omitted_fields
        model             : $response_model
        status            : $status
        fallback          : $fallback
        error_message     : $error_message
        metadata          : {provider_model: $provider_model, submitted_image_count: ($images|count), used_image_count: ($safe_image_content|count), generation_version: "description-v1"}
      }
    } as $generation_log
  }

  response = {
    success              : true
    fallback             : $fallback
    mode                 : $input.mode
    language             : $language
    title                : $output_title
    description          : $description
    suggested_description: $description
    warnings             : $warnings
    recommendations      : $recommendations
    facts_used           : $facts_used
    omitted_fields       : $omitted_fields
    model                : $response_model
  }

  tags = ["sitecraft-auto-market", "ai", "description"]
}
