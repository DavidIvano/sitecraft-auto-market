query "public/locale/cars/{slug}" verb=GET {
  api_group = "sitecraft-auto-market"

  input {
    text slug filters=trim|lower|max:120
    text lang?=de filters=trim|lower|max:35
  }

  stack {
    db.get locales {
      field_name = "code"
      field_value = $input.lang
    } as $requested_locale

    precondition (($requested_locale != null) && ($requested_locale.is_active == true) && ($requested_locale.is_public == true)) {
      error_type = "notfound"
      error = "Locale not available"
    }

    db.get car_listings {
      field_name = "slug"
      field_value = $input.slug
    } as $car

    precondition ($car != null) {
      error_type = "notfound"
      error = "Listing not found"
    }

    var $is_public {
      value = ((($car.status == "approved") || ($car.status == "published") || ($car.status == "sold") || ($car.moderation_status == "approved") || ($car.moderation_status == "published") || ($car.moderation_status == "sold")) && (($car.status == null) || (($car.status != "draft") && ($car.status != "ai_draft") && ($car.status != "pending_review") && ($car.status != "needs_fix") && ($car.status != "rejected") && ($car.status != "blocked") && ($car.status != "deleted") && ($car.status != "archived"))) && (($car.moderation_status == null) || (($car.moderation_status != "draft") && ($car.moderation_status != "ai_draft") && ($car.moderation_status != "pending_review") && ($car.moderation_status != "needs_fix") && ($car.moderation_status != "rejected") && ($car.moderation_status != "blocked") && ($car.moderation_status != "deleted") && ($car.moderation_status != "archived"))))
    }

    precondition ($is_public) {
      error_type = "notfound"
      error = "Listing not found"
    }

    var $source_locale {
      value = $car.source_locale|first_notnull:""|trim|to_lower
    }

    var $source_hash {
      value = $car.translation_source_hash|first_notnull:""
    }

    db.query car_listing_translations {
      where = (($db.car_listing_translations.car_listing_id == $car.id) && ($db.car_listing_translations.source_locale == $source_locale) && ($db.car_listing_translations.source_hash == $source_hash) && (($db.car_listing_translations.translation_status == "completed") || ($db.car_listing_translations.translation_status == "reviewed")))
      sort = {car_listing_translations.updated_at: "desc"}
      return = {type: "list"}
    } as $ready_translation_rows

    var $localized_title { value = "" }
    var $localized_description { value = "" }
    var $localized_seo_title { value = "" }
    var $localized_seo_description { value = "" }
    var $localized_image_alt_texts { value = [] }
    var $translation { value = null }

    conditional {
      if (($source_locale == $input.lang) && (($car.title|first_notnull:""|trim) != "") && (($car.description|first_notnull:""|trim) != "")) {
        var.update $localized_title { value = $car.title|trim }
        var.update $localized_description { value = $car.description|trim }
        var.update $localized_seo_title { value = $car.seo_title|first_notnull:"" }
        var.update $localized_seo_description { value = $car.seo_description|first_notnull:"" }
        var.update $localized_image_alt_texts { value = $car.image_alt_texts|first_notnull:[] }
        var.update $translation {
          value = {
            locale                : $input.lang
            requested_locale      : $input.lang
            resolved_locale       : $input.lang
            source_locale         : $source_locale
            source_hash           : $source_hash
            resolved_source_hash  : $source_hash
            status                : "completed"
            translation_status    : "source"
            readiness             : "ready"
            translation_version   : $car.translation_version|first_notnull:0
            is_fallback           : false
            updated_at            : $car.translation_updated_at|first_notnull:$car.updated_at
          }
        }
      }

      elseif (($car.translations_ready == true) && ($source_locale != "") && ($source_hash != "")) {
        array.filter ($ready_translation_rows) if (($this.locale_code == $input.lang) && (($this.title|first_notnull:""|trim) != "") && (($this.description|first_notnull:""|trim) != "")) as $requested_translation_rows

        foreach ($requested_translation_rows) {
          each as $translation_row {
            conditional {
              if ($translation == null) {
                var.update $localized_title { value = $translation_row.title|trim }
                var.update $localized_description { value = $translation_row.description|trim }
                var.update $localized_seo_title { value = $translation_row.seo_title|first_notnull:"" }
                var.update $localized_seo_description { value = $translation_row.seo_description|first_notnull:"" }
                var.update $localized_image_alt_texts { value = $translation_row.image_alt_texts|first_notnull:[] }
                var.update $translation {
                  value = {
                    id                    : $translation_row.id
                    locale                : $input.lang
                    requested_locale      : $input.lang
                    resolved_locale       : $input.lang
                    source_locale         : $source_locale
                    source_hash           : $source_hash
                    resolved_source_hash  : $translation_row.source_hash
                    status                : "completed"
                    translation_status    : "translated"
                    readiness             : "ready"
                    translation_version   : $car.translation_version|first_notnull:0
                    is_fallback           : false
                    updated_at            : $translation_row.updated_at
                  }
                }
              }
            }
          }
        }
      }
    }

    precondition (($translation != null) && ($localized_title != "") && ($localized_description != "")) {
      error_type = "notfound"
      error = "Localized listing not available"
    }

    var $public_readiness {
      value = $translation != null
    }

    db.query locales {
      where = (($db.locales.is_active == true) && ($db.locales.is_public == true))
      sort = {locales.sort_order: "asc"}
      return = {type: "list"}
    } as $public_locale_rows

    var $available_locales { value = [] }

    foreach ($public_locale_rows) {
      each as $public_locale_row {
        var $locale_is_ready { value = false }

        conditional {
          if (($public_locale_row.code == $source_locale) && (($car.title|first_notnull:""|trim) != "") && (($car.description|first_notnull:""|trim) != "")) {
            var.update $locale_is_ready { value = true }
          }

          elseif ($car.translations_ready == true) {
            array.filter ($ready_translation_rows) if (($this.locale_code == $public_locale_row.code) && (($this.title|first_notnull:""|trim) != "") && (($this.description|first_notnull:""|trim) != "")) as $ready_locale_translations
            conditional {
              if (($ready_locale_translations|count) > 0) {
                var.update $locale_is_ready { value = true }
              }
            }
          }
        }

        conditional {
          if ($locale_is_ready) {
            array.push $available_locales { value = $public_locale_row.code }
          }
        }
      }
    }

    db.query car_listing_images {
      where = (($db.car_listing_images.car_listing_id == $car.id) && ($db.car_listing_images.is_deleted != true))
      sort = {car_listing_images.sort_order: "asc"}
      return = {type: "list"}
    } as $images

    var $public_images { value = [] }
    foreach ($images) {
      each as $image {
        array.push $public_images {
          value = {
            id        : $image.id
            image_url : $image.image_url
            sort_order: $image.sort_order
            is_main   : $image.is_main
            is_primary: $image.is_primary
            mime_type : $image.mime_type
            size_bytes: $image.size_bytes
          }
        }
      }
    }

    var $model {
      value = {
        id                    : $car.id
        slug                  : $car.slug
        title                 : $localized_title
        description           : $localized_description
        seo_title             : $localized_seo_title
        seo_description       : $localized_seo_description
        image_alt_texts       : $localized_image_alt_texts
        brand                 : $car.brand
        model                 : $car.model
        vehicle_type          : $car.vehicle_type
        body_type             : $car.body_type
        color                 : $car.color
        vehicle_condition     : $car.vehicle_condition|first_notnull:$car.condition
        year                  : $car.year
        mileage               : $car.mileage
        fuel_type             : $car.fuel_type
        engine_volume         : $car.engine_volume
        transmission          : $car.transmission
        drivetrain            : $car.drivetrain
        doors                 : $car.doors
        seats                 : $car.seats
        owners_count          : $car.owners_count|first_notnull:$car.owner_count
        first_registration    : $car.first_registration|first_notnull:$car.first_registration_date
        has_valid_tuv         : $car.has_valid_tuv
        tuv_valid_until       : $car.tuv_valid_until
        price                 : $car.price
        currency              : $car.currency
        city                  : $car.city
        country               : $car.country
        status                : $car.status
        moderation_status     : $car.moderation_status
        main_image_url        : $car.main_image_url
        thumbnail_url         : $car.thumbnail_url
        primary_image_url     : $car.primary_image_url
        image_url             : $car.image_url
        cover_image_url       : $car.cover_image_url
        image_urls            : $car.image_urls
        images                : $public_images
        created_at            : $car.created_at
        updated_at            : $car.updated_at
        source_locale         : $source_locale
        translation_version   : $car.translation_version|first_notnull:0
        translations_ready    : $public_readiness
        available_locales     : $available_locales
        translation           : $translation
      }
    }
  }

  response = $model
  tags = ["sitecraft-auto-market", "release-4", "locale-aware", "public-safe", "strict-readiness", "no-contact", "no-ai"]
  guid = "taPU_2Vr8HsNTEIrwE53CT8X08o"
}
