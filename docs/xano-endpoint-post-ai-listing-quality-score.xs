// Xano endpoint: POST /ai/listing/quality-score
// Deterministic scores; OpenAI only improves seller-facing text.
query "ai/listing/quality-score" verb=POST {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    json fields?
    json analysis?
    int photo_count?=0
    json images?
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

    precondition (($input.photo_count >= 0) && ($input.photo_count <= 8)) {
      error_type = "inputerror"
      error = "photo_count must be between 0 and 8"
    }

    var $analysis {
      value = $input.analysis|first_notnull:{}
    }

    var $images {
      value = $input.images|first_notnull:[]
    }

    precondition (($images|is_array) && (($images|count) <= 8)) {
      error_type = "inputerror"
      error = "images must be an array with up to 8 items"
    }

    var $current_year {
      value = now|format_timestamp:"Y"|to_int
    }

    var $title { value = $input.fields|get:"title":""|first_notnull:""|to_text|trim }
    var $brand { value = $input.fields|get:"brand":""|first_notnull:""|to_text|trim }
    var $model_name { value = $input.fields|get:"model":""|first_notnull:""|to_text|trim }
    var $year { value = $input.fields|get:"year":0|first_notnull:0|to_int }
    var $mileage { value = $input.fields|get:"mileage":0|first_notnull:0|to_int }
    var $mileage_raw { value = $input.fields|get:"mileage":null }
    var $price { value = $input.fields|get:"price":0|first_notnull:0|to_decimal }
    var $city { value = $input.fields|get:"city":""|first_notnull:""|to_text|trim }
    var $country { value = $input.fields|get:"country":""|first_notnull:""|to_text|trim }
    var $vehicle_type { value = $input.fields|get:"vehicle_type":""|first_notnull:""|to_text|trim }
    var $body_type { value = $input.fields|get:"body_type":""|first_notnull:""|to_text|trim }
    var $color { value = $input.fields|get:"color":""|first_notnull:""|to_text|trim }
    var $fuel_type { value = $input.fields|get:"fuel_type":""|first_notnull:""|to_text|trim }
    var $transmission { value = $input.fields|get:"transmission":""|first_notnull:""|to_text|trim }
    var $doors { value = $input.fields|get:"doors":""|first_notnull:""|to_text|trim }
    var $seats { value = $input.fields|get:"seats":""|first_notnull:""|to_text|trim }
    var $vin { value = $input.fields|get:"vin":""|first_notnull:""|to_text|trim|to_upper }
    var $description { value = $input.fields|get:"description":""|first_notnull:""|to_text|trim }
    var $engine_volume { value = $input.fields|get:"engine_volume":""|first_notnull:""|to_text|trim }
    var $has_valid_tuv { value = $input.fields|get:"has_valid_tuv":null }
    var $tuv_valid_until { value = $input.fields|get:"tuv_valid_until":""|first_notnull:""|to_text|trim }
    var $tuv_month_is_valid { value = "/^\\d{4}-(0[1-9]|1[0-2])$/"|regex_matches:$tuv_valid_until }
    var $current_month { value = now|format_timestamp:"Y-m" }
    var $description_length { value = $description|strlen }
    var $city_is_numeric { value = "/^\\d+$/"|regex_matches:$city }
    var $vin_is_valid { value = "/^[A-HJ-NPR-Z0-9]{17}$/"|regex_matches:$vin }
    var $fuel_lower { value = $fuel_type|to_lower }

    var $score { value = 0 }
    var $warnings { value = [] }
    var $critical_issues { value = [] }
    var $recommendations { value = [] }
    var $next_best_actions { value = [] }

    conditional { if ($brand != "") { var.update $score { value = $score + 6 } } }
    conditional { if ($model_name != "") { var.update $score { value = $score + 6 } } }
    conditional { if ($title != "") { var.update $score { value = $score + 4 } } }
    conditional { if (($year >= 1950) && ($year <= $current_year)) { var.update $score { value = $score + 6 } } }
    conditional { if ($vehicle_type != "") { var.update $score { value = $score + 3 } } }
    conditional { if ($body_type != "") { var.update $score { value = $score + 4 } } }
    conditional { if (($mileage_raw != null) && ($mileage >= 0)) { var.update $score { value = $score + 6 } } }
    conditional { if (($price >= 100) && ($price <= 500000)) { var.update $score { value = $score + 8 } } }
    conditional { if (($city != "") && ($city_is_numeric != true)) { var.update $score { value = $score + 6 } } }
    conditional { if ($fuel_type != "") { var.update $score { value = $score + 5 } } }
    conditional { if ($transmission != "") { var.update $score { value = $score + 5 } } }
    conditional { if ($color != "") { var.update $score { value = $score + 3 } } }
    conditional { if ($doors != "") { var.update $score { value = $score + 2 } } }
    conditional { if ($seats != "") { var.update $score { value = $score + 2 } } }
    conditional { if ($description_length > 0) { var.update $score { value = $score + 4 } } }
    conditional { if ($description_length >= 80) { var.update $score { value = $score + 5 } } }
    conditional { if ($description_length >= 250) { var.update $score { value = $score + 4 } } }
    conditional { if ($description_length >= 500) { var.update $score { value = $score + 2 } } }
    conditional { if ($input.photo_count >= 1) { var.update $score { value = $score + 6 } } }
    conditional { if ($input.photo_count >= 3) { var.update $score { value = $score + 5 } } }
    conditional { if ($input.photo_count >= 5) { var.update $score { value = $score + 3 } } }
    conditional { if ($vin_is_valid) { var.update $score { value = $score + 4 } } }
    conditional { if ($country != "") { var.update $score { value = $score + 2 } } }
    conditional { if ($engine_volume != "") { var.update $score { value = $score + 2 } } }
    conditional {
      if ((($has_valid_tuv == true) && $tuv_month_is_valid && ($tuv_valid_until > $current_month)) || (($has_valid_tuv == false) && ($tuv_valid_until == ""))) {
        var.update $score { value = $score + 2 }
      }
    }

    conditional { if ($brand == "") { array.push $critical_issues { value = "Укажите марку автомобиля." } } }
    conditional { if ($model_name == "") { array.push $critical_issues { value = "Укажите модель автомобиля." } } }
    conditional { if (($year == 0) || ($year < 1950) || ($year > $current_year)) { array.push $critical_issues { value = "Укажите корректный год выпуска." } } }
    conditional { if (($price <= 0) || ($price < 100) || ($price > 500000)) { array.push $critical_issues { value = "Укажите корректную цену от 100 до 500 000 EUR." } } }
    conditional { if (($mileage_raw != null) && ($mileage < 0)) { array.push $critical_issues { value = "Пробег не может быть отрицательным." } } }
    conditional { if (($city == "") || $city_is_numeric) { array.push $critical_issues { value = "Укажите корректный город продажи." } } }
    conditional {
      if (($fuel_lower|contains:"электро") && (($fuel_lower|contains:"дизель") || ($fuel_lower|contains:"бензин") || ($fuel_lower|contains:"газ"))) {
        array.push $critical_issues { value = "Тип топлива содержит несовместимые значения." }
      }
    }
    conditional { if (($vin != "") && ($vin_is_valid != true)) { array.push $critical_issues { value = "VIN должен содержать 17 допустимых символов." } } }
    conditional { if ($input.photo_count == 0) { array.push $critical_issues { value = "Добавьте хотя бы одну фотографию автомобиля." } } }
    conditional {
      if ((($input.fields|has:"seller_phone") || ($input.fields|has:"seller_email")) && (($input.fields|get:"seller_phone":""|first_notnull:"") == "") && (($input.fields|get:"seller_email":""|first_notnull:"") == "")) {
        array.push $critical_issues { value = "Укажите контакт продавца." }
      }
    }
    conditional { if (($has_valid_tuv == true) && (($tuv_month_is_valid != true) || ($tuv_valid_until <= $current_month))) { array.push $critical_issues { value = "Для действующего TÜV / HU укажите будущий месяц окончания в формате YYYY-MM." } } }
    conditional { if (($has_valid_tuv == false) && ($tuv_valid_until != "")) { array.push $critical_issues { value = "Очистите срок TÜV / HU, если действующего осмотра нет." } } }
    conditional { if ($has_valid_tuv == null) { array.push $warnings { value = "Подтвердите, есть ли у автомобиля действующий TÜV / HU." } } }

    conditional { if ($description_length == 0) { array.push $warnings { value = "Добавьте описание автомобиля." } } }
    conditional { if (($description_length > 0) && ($description_length < 80)) { array.push $warnings { value = "Расширьте описание минимум до 80 символов." } } }
    conditional { if (($input.photo_count > 0) && ($input.photo_count < 3)) { array.push $warnings { value = "Добавьте больше фотографий автомобиля." } } }
    conditional { if (($mileage == 0) && ($year > 0) && ($year < ($current_year - 1))) { array.push $warnings { value = "Проверьте пробег: для автомобиля этого года указан 0 км." } } }
    conditional { if (($price > 0) && ($price < 1000) && ($year >= ($current_year - 5))) { array.push $warnings { value = "Проверьте цену: она необычно низкая для свежего автомобиля." } } }
    conditional { if ($vin == "") { array.push $warnings { value = "VIN не указан; это необязательное информационное поле." } } }
    conditional { if ($body_type == "") { array.push $warnings { value = "Укажите тип кузова." } } }
    conditional { if ($color == "") { array.push $warnings { value = "Укажите цвет автомобиля." } } }
    conditional { if ($doors == "") { array.push $warnings { value = "Укажите количество дверей." } } }
    conditional { if ($seats == "") { array.push $warnings { value = "Укажите количество мест." } } }
    conditional {
      if ((($fuel_lower|contains:"бензин") || ($fuel_lower|contains:"дизель")) && ($engine_volume == "")) {
        array.push $warnings { value = "Укажите объём двигателя." }
      }
    }

    var $analysis_missing_fields { value = $analysis|get:"missing_fields":[]|first_notnull:[] }
    var $analysis_warnings { value = $analysis|get:"warnings":[]|first_notnull:[] }
    conditional { if (($analysis_missing_fields|count) > 0) { array.push $warnings { value = "Подтвердите поля, которые AI отметил как отсутствующие." } } }
    foreach ($analysis_warnings) { each as $analysis_warning { array.push $warnings { value = $analysis_warning|to_text } } }

    var.update $critical_issues { value = $critical_issues|unique }
    var.update $warnings { value = $warnings|unique }
    var.update $score { value = $score - (($critical_issues|count) * 8) }
    conditional { if ($score < 0) { var.update $score { value = 0 } } }
    conditional { if ($score > 100) { var.update $score { value = 100 } } }
    var.update $score { value = $score|round|to_int }

    var $public_url_count { value = 0 }
    var $image_type_count { value = 0 }
    var $modern_image_count { value = 0 }
    foreach ($images) {
      each as $image {
        var $image_url { value = $image|get:"url":""|first_notnull:""|to_text }
        var $content_type { value = $image|get:"contentType":""|first_notnull:""|to_text|to_lower }
        conditional {
          if (($image_url|starts_with:"http://") || ($image_url|starts_with:"https://")) { var.update $public_url_count { value = $public_url_count + 1 } }
          else { array.push $warnings { value = "Некоторые фотографии используют непубличные URL." } }
        }
        conditional { if ($content_type|starts_with:"image/") { var.update $image_type_count { value = $image_type_count + 1 } } }
        conditional { if (($content_type|contains:"webp") || ($content_type|contains:"avif")) { var.update $modern_image_count { value = $modern_image_count + 1 } } }
      }
    }
    var.update $warnings { value = $warnings|unique }

    var $photo_score { value = 0 }
    conditional {
      if ($input.photo_count > 0) {
        var.update $photo_score { value = 20 }
        conditional { if ($input.photo_count >= 1) { var.update $photo_score { value = $photo_score + 10 } } }
        conditional { if ($input.photo_count >= 2) { var.update $photo_score { value = $photo_score + 10 } } }
        conditional { if ($input.photo_count >= 3) { var.update $photo_score { value = $photo_score + 10 } } }
        conditional { if ($input.photo_count >= 4) { var.update $photo_score { value = $photo_score + 8 } } }
        conditional { if ($input.photo_count >= 5) { var.update $photo_score { value = $photo_score + 7 } } }
        conditional { if ((($images|count) > 0) && ($public_url_count == ($images|count))) { var.update $photo_score { value = $photo_score + 10 } } }
        conditional { if ((($images|count) > 0) && ($image_type_count == ($images|count))) { var.update $photo_score { value = $photo_score + 5 } } }
        conditional { if ((($images|count) > 0) && ($modern_image_count > (($images|count) / 2))) { var.update $photo_score { value = $photo_score + 5 } } }
      }
    }
    var $analysis_photo_score { value = $analysis|get:"photo_quality_score":null }
    conditional {
      if (($analysis_photo_score != null) && (($analysis_photo_score|to_decimal) >= 0) && (($analysis_photo_score|to_decimal) <= 100)) {
        var.update $photo_score { value = (($photo_score * 0.7) + (($analysis_photo_score|to_decimal) * 0.3))|round }
      }
    }
    conditional { if ($photo_score < 0) { var.update $photo_score { value = 0 } } }
    conditional { if ($photo_score > 100) { var.update $photo_score { value = 100 } } }
    var.update $photo_score { value = $photo_score|round|to_int }

    var $trust_score { value = 100 - (($critical_issues|count) * 15) - (($warnings|count) * 5) }
    var.update $trust_score { value = $trust_score - (($analysis_missing_fields|count) * 6) }
    var $field_confidence { value = $analysis|get:"field_confidence":{}|first_notnull:{} }
    object.values { value = $field_confidence } as $confidence_values
    foreach ($confidence_values) {
      each as $field_confidence_value {
        conditional { if (($field_confidence_value|to_decimal) < 0.5) { var.update $trust_score { value = $trust_score - 4 } } }
        conditional { if ((($field_confidence_value|to_decimal) >= 0.5) && (($field_confidence_value|to_decimal) < 0.7)) { var.update $trust_score { value = $trust_score - 2 } } }
      }
    }
    var $auto_fill_allowed { value = $analysis|get:"auto_fill_allowed":{}|first_notnull:{} }
    object.values { value = $auto_fill_allowed } as $auto_fill_values
    foreach ($auto_fill_values) { each as $auto_fill_value { conditional { if ($auto_fill_value == false) { var.update $trust_score { value = $trust_score - 2 } } } } }
    conditional { if ($input.photo_count == 0) { var.update $trust_score { value = $trust_score - 20 } } }
    conditional { if ($input.photo_count == 1) { var.update $trust_score { value = $trust_score - 8 } } }
    conditional { if ($description_length == 0) { var.update $trust_score { value = $trust_score - 10 } } }
    conditional { if ($input.photo_count >= 3) { var.update $trust_score { value = $trust_score + 4 } } }
    conditional { if ($description_length >= 250) { var.update $trust_score { value = $trust_score + 3 } } }
    conditional { if ($vin_is_valid) { var.update $trust_score { value = $trust_score + 3 } } }
    conditional {
      if (($brand != "") && ($model_name != "") && ($year > 0) && ($price > 0) && ($mileage_raw != null) && ($city != "")) {
        var.update $trust_score { value = $trust_score + 5 }
      }
    }
    conditional { if ($trust_score < 0) { var.update $trust_score { value = 0 } } }
    conditional { if ($trust_score > 100) { var.update $trust_score { value = 100 } } }
    var.update $trust_score { value = $trust_score|round|to_int }

    conditional {
      if ($input.photo_count == 0) {
        array.push $next_best_actions { value = {label: "Добавьте фотографии автомобиля", impact: "+20", action: "upload_more_photos", field: null, explanation: "Фотографии нужны покупателю для первичной оценки объявления."} }
      }
    }
    conditional { if (($input.photo_count > 0) && ($input.photo_count < 3)) { array.push $next_best_actions { value = {label: "Добавьте ещё фотографии", impact: "+12", action: "upload_more_photos", field: null, explanation: "Несколько ракурсов повышают полноту объявления."} } } }
    conditional { if ($description_length == 0) { array.push $next_best_actions { value = {label: "Добавьте описание", impact: "+15", action: "fill_description", field: "description", explanation: "Опишите состояние, обслуживание и комплектацию."} } } }
    conditional { if ($brand == "") { array.push $next_best_actions { value = {label: "Укажите марку", impact: "+10", action: "fill_brand", field: "brand", explanation: "Марка нужна для поиска автомобиля в каталоге."} } } }
    conditional { if ($model_name == "") { array.push $next_best_actions { value = {label: "Укажите модель", impact: "+10", action: "fill_model", field: "model", explanation: "Модель помогает покупателю найти подходящий автомобиль."} } } }
    conditional { if ($mileage_raw == null) { array.push $next_best_actions { value = {label: "Укажите пробег", impact: "+10", action: "fill_mileage", field: "mileage", explanation: "Пробег — один из ключевых параметров объявления."} } } }
    conditional { if (($price < 100) || ($price > 500000)) { array.push $next_best_actions { value = {label: "Укажите корректную цену", impact: "+10", action: "fill_price", field: "price", explanation: "Цена должна быть понятной и реалистичной для каталога."} } } }
    conditional { if (($description_length > 0) && ($description_length < 80)) { array.push $next_best_actions { value = {label: "Расширьте описание", impact: "+8", action: "fill_description", field: "description", explanation: "Добавьте сведения о состоянии, обслуживании и комплектации."} } } }
    conditional { if (($city == "") || $city_is_numeric) { array.push $next_best_actions { value = {label: "Укажите город", impact: "+8", action: "fill_city", field: "city", explanation: "Город помогает покупателю оценить расстояние до автомобиля."} } } }
    conditional {
      if (($country == "Германия") && ($description_length > 0) && ("/[А-Яа-яЁё]/u"|regex_matches:$description) && ("/[A-Za-z]/"|regex_matches:$description) == false) {
        array.push $next_best_actions { value = {label: "Добавьте немецкую версию описания", impact: "+6", action: "translate_description", field: "description", explanation: "Немецкая версия сделает объявление понятнее местным покупателям."} }
      }
    }
    conditional { if ($fuel_type == "") { array.push $next_best_actions { value = {label: "Укажите тип топлива", impact: "+6", action: "fill_fuel_type", field: "fuel_type", explanation: "Тип топлива нужен для фильтрации каталога."} } } }
    conditional { if ($transmission == "") { array.push $next_best_actions { value = {label: "Укажите коробку передач", impact: "+6", action: "fill_transmission", field: "transmission", explanation: "Коробка передач — важный параметр поиска."} } } }
    conditional { if ($body_type == "") { array.push $next_best_actions { value = {label: "Укажите тип кузова", impact: "+5", action: "fill_body_type", field: "body_type", explanation: "Тип кузова помогает точнее подобрать автомобиль."} } } }
    var.update $next_best_actions { value = $next_best_actions|slice:0:6 }

    foreach ($next_best_actions) { each as $action_item { array.push $recommendations { value = $action_item.explanation } } }
    var.update $recommendations { value = $recommendations|unique }

    var $listing_label { value = "Слабое" }
    var $photo_label { value = "Слабое" }
    var $trust_label { value = "Слабое" }
    conditional { if (($score >= 40) && ($score < 70)) { var.update $listing_label { value = "Нужно улучшить" } } }
    conditional { if (($score >= 70) && ($score < 90)) { var.update $listing_label { value = "Хорошо" } } }
    conditional { if ($score >= 90) { var.update $listing_label { value = "Отлично" } } }
    conditional { if (($photo_score >= 40) && ($photo_score < 70)) { var.update $photo_label { value = "Нужно улучшить" } } }
    conditional { if (($photo_score >= 70) && ($photo_score < 90)) { var.update $photo_label { value = "Хорошо" } } }
    conditional { if ($photo_score >= 90) { var.update $photo_label { value = "Отлично" } } }
    conditional { if (($trust_score >= 40) && ($trust_score < 70)) { var.update $trust_label { value = "Нужно улучшить" } } }
    conditional { if (($trust_score >= 70) && ($trust_score < 90)) { var.update $trust_label { value = "Хорошо" } } }
    conditional { if ($trust_score >= 90) { var.update $trust_label { value = "Отлично" } } }
    var $risk_level { value = "high" }
    conditional { if (($score >= 40) && ($score < 70)) { var.update $risk_level { value = "medium" } } }
    conditional { if ($score >= 70) { var.update $risk_level { value = "low" } } }

    var $summary { value = "Выполнена локальная проверка качества и согласованности данных." }
    var $fallback { value = true }
    var $status { value = "fallback" }
    var $error_message { value = null }
    var $raw_ai_payload { value = null }
    var $model { value = $env.OPENAI_CAR_AI_MODEL }
    conditional { if (($model == null) || ($model == "")) { var.update $model { value = "gpt-5.4-mini" } } }
    var $openai_context {
      value = {
        listing_quality_score: $score
        photo_quality_score: $photo_score
        trust_score: $trust_score
        critical_issues: $critical_issues
        warnings: $warnings
        next_best_actions: $next_best_actions
        fields: {title: $title, brand: $brand, model: $model_name, year: $year, mileage: $mileage, price: $price, city: $city, body_type: $body_type, fuel_type: $fuel_type, transmission: $transmission, description: $description}
      }
    }
    var $openai_auth_header { value = "Authorization: Bearer "|concat:$env.OPENAI_API_KEY }
    api.request {
      url = "https://api.openai.com/v1/responses"
      method = "POST"
      params = {
        model: $model
        input: [
          {role: "developer", content: [{type: "input_text", text: "Ты AI-помощник автомобильного маркетплейса в Германии. Числовые оценки уже рассчитаны правилами: не изменяй их и не возвращай новые score. Сформулируй короткие рекомендации продавцу и summary. Не утверждай, что автомобиль технически исправен, проверен на ДТП или имеет гарантированную рыночную цену. Верни только JSON по схеме."}]}
          {role: "user", content: [{type: "input_text", text: $openai_context|json_encode}]}
        ]
        text: {
          format: {
            type: "json_schema"
            name: "listing_quality_explanation"
            strict: true
            schema: {
              type: "object"
              additionalProperties: false
              properties: {
                recommendations: {type: "array", maxItems: 6, items: {type: "string"}}
                summary: {type: "string"}
                next_best_actions: {
                  type: "array"
                  maxItems: 6
                  items: {
                    type: "object"
                    additionalProperties: false
                    properties: {label: {type: "string"}, impact: {type: "string"}, action: {type: "string"}, field: {type: ["string", "null"]}, explanation: {type: "string"}}
                    required: ["label", "impact", "action", "field", "explanation"]
                  }
                }
              }
              required: ["recommendations", "summary", "next_best_actions"]
            }
          }
        }
      }
      headers = []|push:$openai_auth_header|push:"Content-Type: application/json"
    } as $openai_response

    conditional {
      if ($openai_response.response.status == 200) {
        var $output_text { value = $openai_response.response.result.output[0].content[0].text }
        conditional {
          if (($output_text == null) || ($output_text == "")) {
            var.update $output_text {
              value = $openai_response.response.result.output_text
            }
          }
        }
        conditional {
          if (($output_text != null) && ($output_text != "")) {
            try_catch {
              try {
                var $ai_text { value = $output_text|json_decode }
                var.update $recommendations { value = $ai_text.recommendations }
                var.update $summary { value = $ai_text.summary }
                var.update $next_best_actions { value = $ai_text.next_best_actions|slice:0:6 }
                var.update $fallback { value = false }
                var.update $status { value = "success" }
                var.update $raw_ai_payload { value = $ai_text }
              }
              catch {
                var.update $error_message { value = "OpenAI output was not valid JSON" }
              }
            }
          }
          else {
            var.update $error_message {
              value = "OpenAI returned empty output_text"
            }
          }
        }
      }
      else {
        var.update $error_message {
          value = "OpenAI Responses API request failed"
        }
      }
    }

    var $draft_record_id {
      value = $analysis|get:"draft.id":null
    }
    var $car_record_id {
      value = $input.fields|get:"id":null
    }
    db.add ai_listing_checks {
      data = {
        created_at           : now
        updated_at           : now
        user_id              : $auth.id
        draft_id             : $draft_record_id
        car_id               : $car_record_id
        type                 : "quality_score"
        score                : $score
        listing_quality_score: $score
        photo_quality_score  : $photo_score
        trust_score          : $trust_score
        risk_level           : $risk_level
        warnings             : $warnings
        recommendations      : $recommendations
        issues               : $critical_issues
        next_best_actions    : $next_best_actions
        summary              : $summary
        model                : $model
        status               : $status
        error_message        : $error_message
        raw_ai_payload       : $raw_ai_payload
        metadata             : {photo_count: $input.photo_count, scoring_version: "quality-v1", fallback: $fallback}
      }
    } as $quality_check
  }

  response = {
    success              : true
    fallback             : $fallback
    score                : $score
    listing_quality_score: $score
    photo_score          : $photo_score
    photo_quality_score  : $photo_score
    trust_score          : $trust_score
    listing_score_label  : $listing_label
    photo_score_label    : $photo_label
    trust_score_label    : $trust_label
    critical_issues      : $critical_issues
    warnings             : $warnings
    recommendations      : $recommendations
    next_best_actions    : $next_best_actions
    summary              : $summary
  }

  tags = ["sitecraft-auto-market", "ai", "quality-score"]
}
