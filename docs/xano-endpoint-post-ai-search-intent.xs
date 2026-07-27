// Xano endpoint: POST /ai/search/intent
// Authenticated buyer-search intent parser. One AI credit is charged after success.
query "ai/search/intent" verb=POST {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    text query? filters=trim
    json current_filters?
    json user_context?
    text idempotency_key? filters=trim|lower
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "unauthorized"
      error = "UNAUTHORIZED"
    }
    precondition (($input.idempotency_key|strlen) >= 32) {
      error_type = "inputerror"
      error = "INVALID_IDEMPOTENCY_KEY"
    }
    conditional {
      if (($input.query == null) || ($input.query == "")) {
        db.add ai_search_logs {
          data = {
            created_at     : now
            updated_at     : now
            query_text     : ""
            current_filters: $input.current_filters
            user_context   : $input.user_context
            status         : "error"
            error_message  : "query is required"
            metadata       : {validation: "required"}
          }
        } as $validation_log
      }
    }

    precondition ($input.query != "") {
      error_type = "inputerror"
      error = "query is required"
    }

    conditional {
      if (($input.query|strlen) < 3) {
        db.add ai_search_logs {
          data = {
            created_at     : now
            updated_at     : now
            query_text     : $input.query
            current_filters: $input.current_filters
            user_context   : $input.user_context
            status         : "error"
            error_message  : "query must contain at least 3 characters"
            metadata       : {validation: "min_length"}
          }
        } as $validation_log
      }
    }

    precondition (($input.query|strlen) >= 3) {
      error_type = "inputerror"
      error = "query must contain at least 3 characters"
    }

    conditional {
      if (($input.query|strlen) > 500) {
        db.add ai_search_logs {
          data = {
            created_at     : now
            updated_at     : now
            query_text     : $input.query
            current_filters: $input.current_filters
            user_context   : $input.user_context
            status         : "error"
            error_message  : "query is too long"
            metadata       : {validation: "max_length"}
          }
        } as $validation_log
      }
    }

    precondition (($input.query|strlen) <= 500) {
      error_type = "inputerror"
      error = "query is too long"
    }

    db.query credit_transactions {
      where = (($db.credit_transactions.user_id == $auth.id) && ($db.credit_transactions.idempotency_key == $input.idempotency_key))
      return = {type: "single"}
    } as $existing_transaction
    conditional {
      if ($existing_transaction != null) {
        return {
          value = {
            success: true, idempotent_replay: true, fallback: false,
            filters: ($existing_transaction.metadata|get:"filters":{}),
            explanation: ($existing_transaction.metadata|get:"explanation":""),
            confidence: ($existing_transaction.metadata|get:"confidence":0),
            suggestions: ($existing_transaction.metadata|get:"suggestions":[]),
            ai_credits: $existing_transaction.balance_after
          }
        }
      }
    }
    db.query user_credits {
      where = ($db.user_credits.user_id == $auth.id)
      return = {type: "single"}
    } as $wallet
    precondition (($wallet != null) && (($wallet.ai_credits|first_notnull:0|to_int) >= 1)) {
      error_type = "accessdenied"
      error = "INSUFFICIENT_CREDITS"
    }

    var $model { value = $env.OPENAI_SEARCH_MODEL }

    conditional {
      if (($model == null) || ($model == "")) {
        var.update $model {
          value = $env.OPENAI_DEFAULT_MODEL
        }
      }
    }
    conditional { if (($model == null) || ($model == "")) { var.update $model { value = "gpt-5.6-luna" } } }

    var $filters {
      value = {
        brand       : null
        model       : null
        body_type   : null
        fuel_type   : null
        transmission: null
        price_min   : null
        price_max   : null
        year_min    : null
        year_max    : null
        mileage_max : null
        city        : null
      }
    }

    var $explanation {
      value = "AI временно недоступен, применён базовый подбор по тексту."
    }

    var $confidence {
      value = 0.45
    }

    var $suggestions {
      value = []
    }

    var $fallback {
      value = true
    }

    var $status {
      value = "fallback"
    }

    var $error_message {
      value = null
    }

    var $parse_status {
      value = "not_started"
    }

    var $user_prompt {
      value = "query: "
        |concat:$input.query
        |concat:"\ncurrent_filters: "
        |concat:$input.current_filters
        |concat:"\nuser_context: "
        |concat:$input.user_context
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
            content: [
              {
                type: "input_text"
                text: "Ты AI-помощник автомобильного маркетплейса в Германии. Верни только JSON, совместимый со схемой. Извлекай фильтры только из явного или очевидного смысла запроса. Не выдумывай данные. Значения enum должны точно совпадать со схемой. current_filters и user_context используй только как on-site preferences, не делай скрытого профилирования. Объяснение и 2-4 коротких предложения напиши на русском языке."
              }
            ]
          }
          {
            role: "user"
            content: [{type: "input_text", text: $user_prompt}]
          }
        ]
        text: {
          format: {
            type: "json_schema"
            name: "car_search_intent"
            strict: true
            schema: {
              type: "object"
              additionalProperties: false
              properties: {
                filters: {
                  type: "object"
                  additionalProperties: false
                  properties: {
                    brand: {
                      type: ["string", "null"]
                      enum: ["Audi", "BMW", "Mercedes-Benz", "Volkswagen", "Opel", "Ford", "Skoda", "Toyota", "Honda", "Mazda", "Nissan", "Renault", "Peugeot", "Citroën", "Fiat", "Hyundai", "Kia", "Seat", "Volvo", "Tesla", "Porsche", "Mini", "Dacia", "Mitsubishi", "Suzuki", "Subaru", "Lexus", "Land Rover", "Jeep", "Alfa Romeo", "Chevrolet", "Chrysler", "Dodge", "Jaguar", "Smart", null]
                    }
                    model: {type: ["string", "null"]}
                    body_type: {
                      type: ["string", "null"]
                      enum: ["Седан", "Универсал", "Хэтчбек", "Купе", "Кабриолет", "Внедорожник / SUV", "Кроссовер", "Минивэн", "Фургон", "Пикап", "Лимузин", null]
                    }
                    fuel_type: {
                      type: ["string", "null"]
                      enum: ["Бензин", "Дизель", "Газ / LPG", "Гибрид", "Plug-in Hybrid", "Электро", "Водород", null]
                    }
                    transmission: {
                      type: ["string", "null"]
                      enum: ["Механика", "Автомат", "Робот", "Вариатор", null]
                    }
                    price_min: {type: ["integer", "null"], minimum: 0}
                    price_max: {type: ["integer", "null"], minimum: 0}
                    year_min: {type: ["integer", "null"], minimum: 1980, maximum: 2026}
                    year_max: {type: ["integer", "null"], minimum: 1980, maximum: 2026}
                    mileage_max: {type: ["integer", "null"], minimum: 0}
                    city: {type: ["string", "null"]}
                  }
                  required: ["brand", "model", "body_type", "fuel_type", "transmission", "price_min", "price_max", "year_min", "year_max", "mileage_max", "city"]
                }
                explanation: {type: "string"}
                confidence: {type: "number", minimum: 0, maximum: 1}
                suggestions: {
                  type: "array"
                  minItems: 2
                  maxItems: 4
                  items: {type: "string"}
                }
              }
              required: ["filters", "explanation", "confidence", "suggestions"]
            }
          }
        }
      }

      headers = []
        |push:$openai_auth_header
        |push:"Content-Type: application/json"
    } as $openai_response

    conditional {
      if ($openai_response.response.status == 200) {
        var $openai_output_text { value = "" }
        var $openai_output_items { value = $openai_response|get:"response.result.output":[] }
        foreach ($openai_output_items) {
          each as $openai_output_item {
            var $openai_content_items { value = $openai_output_item|get:"content":[] }
            foreach ($openai_content_items) {
              each as $openai_content_item {
                conditional {
                  if (($openai_content_item.type == "output_text") && (($openai_content_item.text|first_notnull:"") != "")) {
                    var.update $openai_output_text { value = $openai_content_item.text }
                  }
                }
              }
            }
          }
        }
        conditional {
          if ($openai_output_text == "") {
            var.update $openai_output_text { value = $openai_response|get:"response.result.output_text":"" }
          }
        }

        conditional {
          if (($openai_output_text != null) && ($openai_output_text != "")) {
            try_catch {
              try {
                var $parsed {
                  value = $openai_output_text|json_decode
                }

                var.update $filters {
                  value = $parsed.filters
                }

                var.update $explanation {
                  value = $parsed.explanation
                }

                var.update $confidence {
                  value = $parsed.confidence
                }

                var.update $suggestions {
                  value = $parsed.suggestions
                }

                var.update $fallback {
                  value = false
                }

                var.update $status {
                  value = "success"
                }

                var.update $parse_status {
                  value = "strict_json_schema_valid"
                }
              }

              catch {
                var.update $error_message {
                  value = "OpenAI output was not valid JSON"
                }

                var.update $parse_status {
                  value = "json_decode_error"
                }
              }
            }
          }

          else {
            var.update $error_message {
              value = "OpenAI returned empty output_text"
            }

            var.update $parse_status {
              value = "empty_output"
            }
          }
        }
      }

      else {
        var.update $error_message {
          value = "OpenAI Responses API status "|concat:$openai_response.response.status
        }

        var.update $parse_status {
          value = "provider_error"
        }
      }
    }

    db.add ai_search_logs {
      data = {
        user_id        : $auth.id
        created_at     : now
        updated_at     : now
        query_text     : $input.query
        filters_json   : $filters
        current_filters: $input.current_filters
        user_context   : $input.user_context
        explanation    : $explanation
        confidence     : $confidence
        suggestions    : $suggestions
        model          : $model
        status         : $status
        error_message  : $error_message
        metadata       : {fallback: $fallback, parse_status: $parse_status, model: $model}
      }
    } as $search_log

    precondition (($status == "success") && ($fallback == false)) {
      error_type = "inputerror"
      error = "AI_SEARCH_FAILED"
    }

    var $credits_after { value = null }
    db.transaction {
      stack {
        db.query user_credits {
          where = ($db.user_credits.user_id == $auth.id)
          return = {type: "single"}
          lock = true
        } as $locked_wallet
        db.query credit_transactions {
          where = (($db.credit_transactions.user_id == $auth.id) && ($db.credit_transactions.idempotency_key == $input.idempotency_key))
          return = {type: "single"}
        } as $duplicate_charge
        conditional {
          if ($duplicate_charge == null) {
            var $balance_before { value = $locked_wallet.ai_credits|first_notnull:0|to_int }
            precondition ($balance_before >= 1) {
              error_type = "accessdenied"
              error = "INSUFFICIENT_CREDITS"
            }
            var.update $credits_after { value = $balance_before - 1 }
            db.edit user_credits {
              field_name = "id"
              field_value = $locked_wallet.id
              data = {updated_at: now, ai_credits: $credits_after, ai_daily_generations: (($locked_wallet.ai_daily_generations|first_notnull:0) + 1), ai_monthly_generations: (($locked_wallet.ai_monthly_generations|first_notnull:0) + 1)}
            } as $wallet_updated
            db.add credit_transactions {
              data = {
                created_at: now, updated_at: now, user_id: $auth.id,
                type: "ai_search_intent", amount: -1,
                balance_before: $balance_before, balance_after: $credits_after,
                related_car_id: null, notes: "AI buyer search intent",
                status: "completed", idempotency_key: $input.idempotency_key,
                metadata: {search_log_id: $search_log.id, model: $model, filters: $filters, explanation: $explanation, confidence: $confidence, suggestions: $suggestions}
              }
            } as $transaction
          }
          else { var.update $credits_after { value = $duplicate_charge.balance_after } }
        }
      }
    }
  }

  response = {
    success    : true
    fallback   : $fallback
    filters    : $filters
    explanation: $explanation
    confidence : $confidence
    suggestions: $suggestions
    ai_credits : $credits_after
  }

  tags = ["sitecraft-auto-market", "ai", "buyer-search"]
}
