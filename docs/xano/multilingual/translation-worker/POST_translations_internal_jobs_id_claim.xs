query "translations/internal/jobs/{id}/claim" verb=POST {
  api_group = "sitecraft-auto-market"
  input {
    int id filters=min:1
    text worker_id filters=trim|max:100
  }
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
    precondition (($job != null) && ($job.entity_type == "car_listing")) {
      error_type = "notfound"
      error = "Translation job not found"
    }
    var $outcome { value = "claimed" }
    var $should_translate { value = false }
    var $result_job { value = $job }
    conditional {
      if ($job.status == "completed") {
        var.update $outcome { value = "completed" }
      }
      else {
        db.get car_listings {
          field_name = "id"
          field_value = $job.entity_id
        } as $car
        conditional {
          if (($car == null) || ($car.status != "approved")) {
            db.edit translation_jobs {
              field_name = "id"
              field_value = $job.id
              data = {updated_at: now, status: "outdated", last_error: "LISTING_NOT_PUBLIC", locked_at: null, locked_by: null}
            } as $result_job
            var.update $outcome { value = "not_public" }
          }
          else {
            var $source_locale { value = $car.source_locale|first_notnull:"ru"|trim }
            var $source_document { value = {title: ("/\\r\\n?/"|regex_replace:"\n":$car.title)|trim, description: ("/\\r\\n?/"|regex_replace:"\n":$car.description)|trim, seo_title: null, seo_description: null, image_alt_texts: null, search_keywords: null, source_locale: $source_locale, schema_version: "listing-i18n-v1"} }
            var $source_hash { value = $source_document|json_encode|sha256:false }
            conditional {
              if (($source_hash != $job.source_hash) || ($source_locale != $job.source_locale)) {
                db.edit translation_jobs {
                  field_name = "id"
                  field_value = $job.id
                  data = {updated_at: now, status: "outdated", last_error: "SOURCE_HASH_CHANGED", locked_at: null, locked_by: null}
                } as $result_job
                var.update $outcome { value = "outdated" }
              }
              else {
                db.query car_listing_translations {
                  where = (($db.car_listing_translations.car_listing_id == $car.id) && ($db.car_listing_translations.locale_code == $job.target_locale) && ($db.car_listing_translations.source_locale == $source_locale) && ($db.car_listing_translations.source_hash == $source_hash) && (($db.car_listing_translations.translation_status == "completed") || ($db.car_listing_translations.translation_status == "reviewed")))
                  return = {type: "single"}
                } as $completed_translation
                conditional {
                  if ($completed_translation != null) {
                    db.edit translation_jobs {
                      field_name = "id"
                      field_value = $job.id
                      data = {updated_at: now, status: "completed", last_error: null, locked_at: null, locked_by: null, completed_at: now}
                    } as $result_job
                    var.update $outcome { value = "completed" }
                  }
                  else {
                    db.transaction {
                      stack {
                        db.get translation_jobs {
                          field_name = "id"
                          field_value = $job.id
                          lock = true
                        } as $locked_job
                        precondition ((($locked_job.status == "pending") || ($locked_job.status == "queued") || ($locked_job.status == "failed")) && (($locked_job.attempt_count|first_notnull:0) < ($locked_job.max_attempts|first_notnull:3))) {
                          error_type = "inputerror"
                          error = "Translation job is not claimable"
                        }
                        db.edit translation_jobs {
                          field_name = "id"
                          field_value = $locked_job.id
                          data = {updated_at: now, status: "processing", attempt_count: (($locked_job.attempt_count|first_notnull:0) + 1), provider: "openai", model: "gpt-5.6-luna", prompt_version: "listing-translation-v1", last_error: null, locked_at: now, locked_by: $input.worker_id, started_at: now, completed_at: null}
                        } as $result_job
                      }
                    }
                    var.update $should_translate { value = true }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  response = {outcome: $outcome, should_translate: $should_translate, job: {id: $result_job.id, entity_id: $result_job.entity_id, source_locale: $result_job.source_locale, target_locale: $result_job.target_locale, source_hash: $result_job.source_hash, status: $result_job.status, attempt_count: ($result_job.attempt_count|first_notnull:0), max_attempts: ($result_job.max_attempts|first_notnull:3)}}
  tags = ["translations", "internal", "worker", "claim", "idempotent"]
}
