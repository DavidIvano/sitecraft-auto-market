query "deal-finder/listings/{id}/translate-description" verb=POST {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    int id filters=min:1
    text source_language?=de filters=trim|lower
    text target_language?=ru filters=trim|lower
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }
    db.get automarket_users {
      field_name = "id"
      field_value = $auth.id
    } as $current_user
    precondition (($current_user != null) && (($current_user.role == "admin") || ($current_user.role == "deal_finder_admin"))) {
      error_type = "accessdenied"
      error = "Deal Finder access required"
    }
    precondition (($input.source_language == "de") && ($input.target_language == "ru")) {
      error_type = "inputerror"
      error = "Unsupported language pair"
    }

    db.query deal_finder_listings {
      where = (($db.deal_finder_listings.id == $input.id) && ($db.deal_finder_listings.user_id == $current_user.id))
      return = {type: "single"}
    } as $listing
    precondition ($listing != null) {
      error_type = "notfound"
      error = "Listing not found"
    }
    precondition (($listing.description != null) && (($listing.description|trim) != "")) {
      error_type = "inputerror"
      error = "Description required"
    }

    var $model {
      value = "gpt-5.6-luna"
    }
    var $source_hash {
      value = $listing.description|sha256:false
    }

    db.query deal_finder_translations {
      where = (($db.deal_finder_translations.user_id == $current_user.id) && ($db.deal_finder_translations.deal_finder_listing_id == $listing.id) && ($db.deal_finder_translations.source_language == "de") && ($db.deal_finder_translations.target_language == "ru") && ($db.deal_finder_translations.source_hash == $source_hash))
      sort = {deal_finder_translations.updated_at: "desc"}
      return = {type: "single"}
    } as $translation

    var $cached {
      value = (($translation != null) && ($translation.status == "completed") && (($translation.translated_text|first_notnull:"") != ""))
    }
    conditional {
      if ($cached != true) {
        var $rate_limit_after {
          value = now|add_secs_to_timestamp:-3600
        }
        db.query deal_finder_translations {
          where = (($db.deal_finder_translations.user_id == $current_user.id) && ($db.deal_finder_translations.created_at >= $rate_limit_after))
          return = {type: "list"}
        } as $recent_translations
        precondition (($recent_translations|count) < 10) {
          error_type = "toomanyrequests"
          error = "Translation rate limit reached"
        }

        conditional {
          if ($translation == null) {
            db.add deal_finder_translations {
              data = {
                created_at: now, updated_at: now, user_id: $current_user.id,
                deal_finder_listing_id: $listing.id, source_language: "de", target_language: "ru",
                source_hash: $source_hash, source_text_updated_at: $listing.updated_at,
                translated_text: null, model: $model, status: "processing", error_code: null, completed_at: null
              }
            } as $translation
          }
          else {
            db.edit deal_finder_translations {
              field_name = "id"
              field_value = $translation.id
              data = {updated_at: now, model: $model, status: "processing", error_code: null}
            } as $translation
          }
        }

        var $openai_auth_header {
          value = "Authorization: Bearer "|concat:$env.OPENAI_API_KEY
        }
        api.request {
          url = "https://api.openai.com/v1/responses"
          method = "POST"
          timeout = 60
          params = {
            model: $model
            store: false
            input: [
              {
                role: "developer"
                content: [{type: "input_text", text: "Переведи немецкое описание автомобиля на русский язык без сокращений и улучшений. Сохрани все факты, дефекты, предупреждения, цену, пробег, даты, числа, URL, VIN, номера деталей и структуру абзацев. Не добавляй рекламу, характеристики или выводы, которых нет в оригинале. Верни только JSON по схеме."}]
              }
              {role: "user", content: [{type: "input_text", text: $listing.description}]}
            ]
            text: {
              format: {
                type: "json_schema"
                name: "deal_finder_translation_de_ru"
                strict: true
                schema: {
                  type: "object"
                  additionalProperties: false
                  properties: {translated_text: {type: "string"}}
                  required: ["translated_text"]
                }
              }
            }
          }
          headers = []|push:$openai_auth_header|push:"Content-Type: application/json"
        } as $openai_response

        conditional {
          if ($openai_response.response.status == 200) {
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
            var $output_json {
              value = $output_text|json_decode
            }
            var $translated_text {
              value = $output_json.translated_text|first_notnull:""|trim
            }
            precondition ($translated_text != "") {
              error_type = "inputerror"
              error = "Translation output is empty"
            }
            db.edit deal_finder_translations {
              field_name = "id"
              field_value = $translation.id
              data = {updated_at: now, translated_text: $translated_text, model: $model, status: "completed", error_code: null, completed_at: now}
            } as $translation
          }
          else {
            db.edit deal_finder_translations {
              field_name = "id"
              field_value = $translation.id
              data = {updated_at: now, status: "failed", error_code: "OPENAI_TRANSLATION_FAILED"}
            } as $translation
            precondition (false) {
              error_type = "inputerror"
              error = "Translation service unavailable"
            }
          }
        }
      }
    }
  }

  response = {
    original: {listing_id: $listing.id, language: "de", text: $listing.description, source_hash: $source_hash}
    translation: {
      id: $translation.id, listing_id: $translation.deal_finder_listing_id,
      source_language: $translation.source_language, target_language: $translation.target_language,
      source_hash: $translation.source_hash, status: $translation.status,
      translated_text: $translation.translated_text, model: $translation.model,
      completed_at: $translation.completed_at, cached: $cached
    }
  }
  tags = ["deal-finder", "frontend", "owner-only", "translation", "openai", "cached"]
  guid = "izXWcWPesJjdcE8sf6JgGyA4JDE"
}
