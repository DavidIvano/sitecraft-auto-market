query "translations/internal/prepare" verb=POST {
  api_group = "sitecraft-auto-market"
  input {
    text target_locale filters=trim|lower|max:35
    bool? dry_run?=true
  }
  stack {
    var $provided_secret { value = $env.$http_headers."X-Translation-Worker-Secret"|first_notnull:""|to_text }
    precondition (($provided_secret != "") && ($provided_secret == "__TRANSLATION_WORKER_SECRET_RAW__")) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }
    precondition (($input.target_locale == "en") || ($input.target_locale == "fr") || ($input.target_locale == "tr") || ($input.target_locale == "ar")) {
      error_type = "inputerror"
      error = "Unsupported target locale"
    }
    db.query locales {
      where = (($db.locales.code == $input.target_locale) && ($db.locales.is_active == true))
      return = {type: "single"}
    } as $target_locale
    precondition ($target_locale != null) {
      error_type = "inputerror"
      error = "Target locale is not prepared"
    }
    db.query car_listings {
      where = ($db.car_listings.status == "approved")
      sort = {car_listings.id: "asc"}
      return = {type: "list", paging: {page: 1, per_page: 100}}
    } as $public_cars
    var $candidates { value = [] }
    var $would_create { value = 0 }
    var $created { value = 0 }
    var $reused { value = 0 }
    var $source_locale { value = "" }
    var $source_hash { value = "" }
    var $translation_version { value = 1 }
    var $job_key { value = "" }
    foreach ($public_cars.items) {
      each as $car {
        var.update $source_locale { value = $car.source_locale|first_notnull:"ru"|trim }
        var.update $source_hash {
          value = {
            title: ("/\\r\\n?/"|regex_replace:"\n":$car.title)|trim
            description: ("/\\r\\n?/"|regex_replace:"\n":$car.description)|trim
            seo_title: null
            seo_description: null
            image_alt_texts: null
            search_keywords: null
            source_locale: $source_locale
            schema_version: "listing-i18n-v1"
          }|json_encode|sha256:false
        }
        conditional {
          if ($source_locale != $input.target_locale) {
            db.query car_listing_translations {
              where = (($db.car_listing_translations.car_listing_id == $car.id) && ($db.car_listing_translations.locale_code == $input.target_locale) && ($db.car_listing_translations.source_locale == $source_locale) && ($db.car_listing_translations.source_hash == $source_hash) && (($db.car_listing_translations.translation_status == "completed") || ($db.car_listing_translations.translation_status == "reviewed")))
              return = {type: "single"}
            } as $completed_translation
            db.query translation_jobs {
              where = (($db.translation_jobs.entity_type == "car_listing") && ($db.translation_jobs.entity_id == $car.id) && ($db.translation_jobs.target_locale == $input.target_locale) && ($db.translation_jobs.source_hash == $source_hash))
              return = {type: "single"}
            } as $existing_job
            conditional {
              if (($completed_translation == null) && ($existing_job == null)) {
                var.update $would_create { value = $would_create + 1 }
                array.push $candidates { value = {listing_id: $car.id, slug: $car.slug, source_locale: $source_locale, target_locale: $input.target_locale, source_hash: $source_hash} }
                conditional {
                  if ($input.dry_run != true) {
                    var.update $translation_version { value = $car.translation_version|first_notnull:1 }
                    conditional {
                      if (($car.translation_source_hash|first_notnull:"") != "" && ($car.translation_source_hash != $source_hash)) {
                        var.update $translation_version { value = $translation_version + 1 }
                      }
                    }
                    db.edit car_listings {
                      field_name = "id"
                      field_value = $car.id
                      data = {updated_at: now, source_locale: $source_locale, translation_source_hash: $source_hash, translation_version: $translation_version, translations_ready: false, translation_updated_at: now}
                    } as $prepared_car
                    db.query car_listing_translations {
                      where = (($db.car_listing_translations.car_listing_id == $car.id) && ($db.car_listing_translations.locale_code == $source_locale))
                      return = {type: "single"}
                    } as $original_translation
                    conditional {
                      if ($original_translation == null) {
                        db.add car_listing_translations {
                          data = {created_at: now, updated_at: now, car_listing_id: $car.id, locale_code: $source_locale, title: $car.title, description: $car.description, seo_title: null, seo_description: null, image_alt_texts: [], search_keywords: [], translation_status: "original", translation_source: "original", source_locale: $source_locale, source_hash: $source_hash, translation_provider: null, translation_model: null, translation_prompt_version: null, quality_score: null, language_detection_score: null, reviewed_by: null, reviewed_at: null}
                        } as $created_original
                      }
                      else {
                        db.edit car_listing_translations {
                          field_name = "id"
                          field_value = $original_translation.id
                          data = {updated_at: now, title: $car.title, description: $car.description, translation_status: "original", translation_source: "original", source_locale: $source_locale, source_hash: $source_hash}
                        } as $updated_original
                      }
                    }
                    db.query translation_jobs {
                      where = (($db.translation_jobs.entity_type == "car_listing") && ($db.translation_jobs.entity_id == $car.id) && ($db.translation_jobs.target_locale == $input.target_locale) && ($db.translation_jobs.source_hash != $source_hash) && (($db.translation_jobs.status == "pending") || ($db.translation_jobs.status == "queued") || ($db.translation_jobs.status == "processing") || ($db.translation_jobs.status == "failed")))
                      return = {type: "list"}
                    } as $stale_jobs
                    foreach ($stale_jobs) {
                      each as $stale_job {
                        db.edit translation_jobs {
                          field_name = "id"
                          field_value = $stale_job.id
                          data = {updated_at: now, status: "outdated", last_error: "SOURCE_HASH_CHANGED", locked_at: null, locked_by: null}
                        } as $outdated_job
                      }
                    }
                    var.update $job_key { value = "car_listing:"|concat:$car.id|concat:":"|concat:$input.target_locale|concat:":"|concat:$source_hash }
                    db.add translation_jobs {
                      data = {created_at: now, updated_at: now, entity_type: "car_listing", entity_id: $car.id, source_locale: $source_locale, target_locale: $input.target_locale, source_hash: $source_hash, idempotency_key: $job_key, status: "pending", priority: 100, attempt_count: 0, max_attempts: 3, provider: "openai", model: "gpt-5.6-luna", prompt_version: "listing-translation-v1", last_error: null, locked_at: null, locked_by: null, started_at: null, completed_at: null}
                    } as $created_job
                    var.update $created { value = $created + 1 }
                  }
                }
              }
              else {
                var.update $reused { value = $reused + 1 }
              }
            }
          }
        }
      }
    }
  }
  response = {dry_run: $input.dry_run, target_locale: $input.target_locale, public_listings: ($public_cars.items|count), would_create: $would_create, created: $created, reused: $reused, candidates: $candidates}
  tags = ["translations", "internal", "worker", "prepare", "idempotent"]
}
