query "translations/internal/locales/release" verb=POST {
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
    precondition (($input.target_locale == "en") || ($input.target_locale == "fr") || ($input.target_locale == "tr") || ($input.target_locale == "ar") || ($input.target_locale == "ru") || ($input.target_locale == "uk")) {
      error_type = "inputerror"
      error = "Unsupported target locale"
    }

    db.get locales {
      field_name = "code"
      field_value = $input.target_locale
    } as $locale
    precondition (($locale != null) && ($locale.is_active == true)) {
      error_type = "inputerror"
      error = "Locale is not active"
    }

    db.query car_listings {
      where = ((($db.car_listings.status == "approved") || ($db.car_listings.status == "published") || ($db.car_listings.status == "sold") || ($db.car_listings.moderation_status == "approved") || ($db.car_listings.moderation_status == "published") || ($db.car_listings.moderation_status == "sold")) && (($db.car_listings.status == null) || (($db.car_listings.status != "draft") && ($db.car_listings.status != "ai_draft") && ($db.car_listings.status != "pending_review") && ($db.car_listings.status != "needs_fix") && ($db.car_listings.status != "rejected") && ($db.car_listings.status != "blocked") && ($db.car_listings.status != "deleted") && ($db.car_listings.status != "archived"))) && (($db.car_listings.moderation_status == null) || (($db.car_listings.moderation_status != "draft") && ($db.car_listings.moderation_status != "ai_draft") && ($db.car_listings.moderation_status != "pending_review") && ($db.car_listings.moderation_status != "needs_fix") && ($db.car_listings.moderation_status != "rejected") && ($db.car_listings.moderation_status != "blocked") && ($db.car_listings.moderation_status != "deleted") && ($db.car_listings.moderation_status != "archived"))))
      return = {type: "list"}
    } as $cars

    var $car_ids { value = [] }
    foreach ($cars) {
      each as $car_id_source {
        array.push $car_ids { value = $car_id_source.id }
      }
    }

    var $translation_rows { value = [] }
    conditional {
      if (($car_ids|count) > 0) {
        db.query car_listing_translations {
          where = (($db.car_listing_translations.car_listing_id in $car_ids) && ($db.car_listing_translations.locale_code == $input.target_locale) && (($db.car_listing_translations.translation_status == "completed") || ($db.car_listing_translations.translation_status == "reviewed")))
          return = {type: "list"}
        } as $ready_translation_rows
        var.update $translation_rows { value = $ready_translation_rows }
      }
    }

    var $ready_listing_ids { value = [] }
    foreach ($cars) {
      each as $car {
        var $source_locale { value = $car.source_locale|first_notnull:""|trim|to_lower }
        var $source_hash { value = $car.translation_source_hash|first_notnull:"" }
        var $listing_ready { value = false }
        conditional {
          if (($source_locale == $input.target_locale) && (($car.title|first_notnull:""|trim) != "") && (($car.description|first_notnull:""|trim) != "")) {
            var.update $listing_ready { value = true }
          }
          elseif (($source_locale != "") && ($source_hash != "")) {
            array.filter ($translation_rows) if (($this.car_listing_id == $car.id) && ($this.source_locale == $source_locale) && ($this.source_hash == $source_hash) && (($this.title|first_notnull:""|trim) != "") && (($this.description|first_notnull:""|trim) != "")) as $matching_translations
            conditional {
              if (($matching_translations|count) > 0) {
                var.update $listing_ready { value = true }
              }
            }
          }
        }
        conditional {
          if ($listing_ready) {
            array.push $ready_listing_ids { value = $car.id }
          }
        }
      }
    }

    var $public_listing_count { value = $cars|count }
    var $ready_listing_count { value = $ready_listing_ids|count }
    var $data_ready { value = (($public_listing_count > 0) && ($ready_listing_count == $public_listing_count)) }
    conditional {
      if ($input.dry_run != true) {
        precondition ($data_ready) {
          error_type = "inputerror"
          error = "Locale listing translations are incomplete"
        }
        db.edit locales {
          field_name = "id"
          field_value = $locale.id
          data = {updated_at: now, is_public: true}
        } as $locale
      }
    }
  }
  response = {dry_run: $input.dry_run, locale: $input.target_locale, public_listing_count: $public_listing_count, ready_listing_count: $ready_listing_count, data_ready: $data_ready, is_public: $locale.is_public}
  tags = ["translations", "internal", "worker", "locales", "release-gate", "idempotent"]
}
