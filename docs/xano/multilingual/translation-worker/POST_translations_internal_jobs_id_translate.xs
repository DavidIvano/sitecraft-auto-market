query "translations/internal/jobs/{id}/translate" verb=POST {
  api_group = "sitecraft-auto-market"
  input { int id filters=min:1 }
  stack {
    var $provided_secret { value = $env.$http_headers."X-Translation-Worker-Secret"|first_notnull:""|to_text }
    precondition (($provided_secret != "") && ($provided_secret == "__TRANSLATION_WORKER_SECRET_RAW__")) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }
    db.get translation_jobs {
      field_name = "id"
      field_value = $input.id
    } as $job
    precondition (($job != null) && ($job.status == "processing") && ($job.entity_type == "car_listing")) {
      error_type = "inputerror"
      error = "Translation job is not processing"
    }
    db.get car_listings {
      field_name = "id"
      field_value = $job.entity_id
    } as $car
    precondition (($car != null) && ($car.status == "approved") && ($car.translation_source_hash == $job.source_hash)) {
      error_type = "inputerror"
      error = "Listing source is not translatable"
    }
    var $target_language { value = "English" }
    conditional {
      if ($job.target_locale == "fr") {
        var.update $target_language { value = "French" }
      }
      elseif ($job.target_locale == "tr") {
        var.update $target_language { value = "Turkish" }
      }
      elseif ($job.target_locale == "ar") {
        var.update $target_language { value = "Arabic" }
      }
      elseif ($job.target_locale == "de") {
        var.update $target_language { value = "German" }
      }
      elseif ($job.target_locale == "uk") {
        var.update $target_language { value = "Ukrainian" }
      }
    }
    var $model { value = $env.OPENAI_TRANSLATION_MODEL }
    conditional {
      if (($model == null) || ($model == "")) {
        var.update $model { value = $env.OPENAI_DEFAULT_MODEL }
      }
    }
    conditional {
      if (($model == null) || ($model == "")) {
        var.update $model { value = "gpt-5.6-luna" }
      }
    }
    var $developer_prompt { value = "Translate the vehicle listing title and description into "|concat:$target_language|concat:". Preserve every fact, defect, warning, number, date, price, mileage, URL, VIN and paragraph structure. Do not add marketing claims or vehicle facts. Keep brand and model names unchanged. Return only JSON matching the schema." }
    var $user_payload { value = {source_locale: $job.source_locale, target_locale: $job.target_locale, title: $car.title, description: $car.description}|json_encode }
    var $openai_auth_header { value = "Authorization: Bearer "|concat:$env.OPENAI_API_KEY }
    api.request {
      url = "https://api.openai.com/v1/responses"
      method = "POST"
      timeout = 60
      params = {
        model: $model
        store: false
        input: [
          {role: "developer", content: [{type: "input_text", text: $developer_prompt}]}
          {role: "user", content: [{type: "input_text", text: $user_payload}]}
        ]
        text: {format: {type: "json_schema", name: "car_listing_translation", strict: true, schema: {type: "object", additionalProperties: false, properties: {title: {type: "string"}, description: {type: "string"}}, required: ["title", "description"]}}}
      }
      headers = []|push:$openai_auth_header|push:"Content-Type: application/json"
    } as $openai_response
    precondition ($openai_response.response.status == 200) {
      error_type = "inputerror"
      error = "Translation provider unavailable"
    }
    var $output_text { value = "" }
    var $output_items { value = $openai_response|get:"response.result.output":[] }
    foreach ($output_items) {
      each as $output_item {
        var $content_items { value = $output_item|get:"content":[] }
        foreach ($content_items) {
          each as $content_item {
            conditional {
              if (($content_item.type == "output_text") && (($content_item.text|first_notnull:"") != "")) {
                var.update $output_text { value = $content_item.text }
              }
            }
          }
        }
      }
    }
    conditional {
      if ($output_text == "") {
        var.update $output_text { value = $openai_response|get:"response.result.output_text":"" }
      }
    }
    var $output_json { value = $output_text|json_decode }
    var $translated_title { value = $output_json.title|first_notnull:""|trim }
    var $translated_description { value = $output_json.description|first_notnull:""|trim }
    precondition (($translated_title != "") && ($translated_description != "") && (($translated_title|strlen) <= 500) && (($translated_description|strlen) <= 20000) && (($translated_title|contains:"<script") != true) && (($translated_description|contains:"<script") != true)) {
      error_type = "inputerror"
      error = "Translation output is invalid"
    }
  }
  response = {translation: {title: $translated_title, description: $translated_description}, model: $model, provider_response_id: ($openai_response|get:"response.result.id":null)}
  tags = ["translations", "internal", "worker", "provider", "openai"]
}
