query "translations/internal/jobs/{id}/complete" verb=POST {
  api_group = "sitecraft-auto-market"
  input {
    int id filters=min:1
    text title filters=trim|max:500
    text description filters=trim|max:20000
    text model filters=trim|max:100
    text? provider_response_id filters=trim|max:255
  }
  stack {
    var $provided_secret { value = $env.$http_headers."X-Translation-Worker-Secret"|first_notnull:""|to_text }
    precondition (($provided_secret != "") && ($provided_secret == "__TRANSLATION_WORKER_SECRET_RAW__")) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }
    precondition (($input.title != "") && ($input.description != "") && (($input.title|contains:"<script") != true) && (($input.description|contains:"<script") != true)) {
      error_type = "inputerror"
      error = "Translation output is invalid"
    }
    db.get translation_jobs {
      field_name = "id"
      field_value = $input.id
    } as $job
    precondition (($job != null) && (($job.status == "processing") || ($job.status == "completed"))) {
      error_type = "inputerror"
      error = "Translation job cannot be completed"
    }
    db.get car_listings {
      field_name = "id"
      field_value = $job.entity_id
    } as $car
    precondition (($car != null) && ($car.status == "approved") && ($car.translation_source_hash == $job.source_hash) && ($car.source_locale == $job.source_locale)) {
      error_type = "inputerror"
      error = "Listing source changed"
    }
    var $result_job { value = $job }
    var $translation { value = null }
    db.query car_listing_translations {
      where = (($db.car_listing_translations.car_listing_id == $car.id) && ($db.car_listing_translations.locale_code == $job.target_locale))
      return = {type: "single"}
    } as $existing_translation
    conditional {
      if (($job.status == "completed") && ($existing_translation != null) && ($existing_translation.source_hash == $job.source_hash) && (($existing_translation.translation_status == "completed") || ($existing_translation.translation_status == "reviewed"))) {
        var.update $translation { value = $existing_translation }
      }
      else {
        db.transaction {
          stack {
            db.get translation_jobs {
              field_name = "id"
              field_value = $job.id
              lock = true
            } as $locked_job
            precondition (($locked_job.status == "processing") || ($locked_job.status == "completed")) {
              error_type = "inputerror"
              error = "Translation job is no longer processing"
            }
            conditional {
              if ($existing_translation == null) {
                db.add car_listing_translations {
                  data = {created_at: now, updated_at: now, car_listing_id: $car.id, locale_code: $job.target_locale, title: $input.title, description: $input.description, seo_title: null, seo_description: null, image_alt_texts: [], search_keywords: [], translation_status: "completed", translation_source: "ai", source_locale: $job.source_locale, source_hash: $job.source_hash, translation_provider: "openai", translation_model: $input.model, translation_prompt_version: "listing-translation-v1", quality_score: null, language_detection_score: null, reviewed_by: null, reviewed_at: null}
                } as $translation
              }
              else {
                db.edit car_listing_translations {
                  field_name = "id"
                  field_value = $existing_translation.id
                  data = {updated_at: now, title: $input.title, description: $input.description, seo_title: null, seo_description: null, image_alt_texts: [], search_keywords: [], translation_status: "completed", translation_source: "ai", source_locale: $job.source_locale, source_hash: $job.source_hash, translation_provider: "openai", translation_model: $input.model, translation_prompt_version: "listing-translation-v1", quality_score: null, language_detection_score: null, reviewed_by: null, reviewed_at: null}
                } as $translation
              }
            }
            db.edit translation_jobs {
              field_name = "id"
              field_value = $locked_job.id
              data = {updated_at: now, status: "completed", provider: "openai", model: $input.model, prompt_version: "listing-translation-v1", last_error: null, locked_at: null, locked_by: null, completed_at: now}
            } as $result_job
          }
        }
      }
    }
  }
  response = {outcome: "completed", job: {id: $result_job.id, status: $result_job.status, listing_id: $result_job.entity_id, target_locale: $result_job.target_locale, source_hash: $result_job.source_hash}, translation: {id: $translation.id, locale_code: $translation.locale_code, source_hash: $translation.source_hash, translation_status: $translation.translation_status}}
  tags = ["translations", "internal", "worker", "complete", "idempotent"]
}
