// Xano endpoint: POST /ai/search/intent
// Public buyer-search intent parser. No account or personal data is required.
query "ai/search/intent" verb=POST {
  api_group = "sitecraft-auto-market"

  input {
    text query? filters=trim
    json current_filters?
    json user_context?
  }

  stack {
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
      params = {
        model: $model
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
  }

  response = {
    success    : true
    fallback   : $fallback
    filters    : $filters
    explanation: $explanation
    confidence : $confidence
    suggestions: $suggestions
  }

  tags = ["sitecraft-auto-market", "ai", "buyer-search"]
}
