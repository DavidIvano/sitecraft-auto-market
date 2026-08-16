query "public/locale/cars" verb=GET {
  api_group = "sitecraft-auto-market"

  input {
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

    db.query car_listings {
      where = ((($db.car_listings.status == "approved") || ($db.car_listings.status == "published") || ($db.car_listings.status == "sold") || ($db.car_listings.moderation_status == "approved") || ($db.car_listings.moderation_status == "published") || ($db.car_listings.moderation_status == "sold")) && (($db.car_listings.status == null) || (($db.car_listings.status != "draft") && ($db.car_listings.status != "ai_draft") && ($db.car_listings.status != "pending_review") && ($db.car_listings.status != "needs_fix") && ($db.car_listings.status != "rejected") && ($db.car_listings.status != "blocked") && ($db.car_listings.status != "deleted") && ($db.car_listings.status != "archived"))) && (($db.car_listings.moderation_status == null) || (($db.car_listings.moderation_status != "draft") && ($db.car_listings.moderation_status != "ai_draft") && ($db.car_listings.moderation_status != "pending_review") && ($db.car_listings.moderation_status != "needs_fix") && ($db.car_listings.moderation_status != "rejected") && ($db.car_listings.moderation_status != "blocked") && ($db.car_listings.moderation_status != "deleted") && ($db.car_listings.moderation_status != "archived"))))
      sort = {car_listings.created_at: "desc"}
      return = {type: "list"}
    } as $cars

    var $car_ids {
      value = []
    }

    foreach ($cars) {
      each as $car_id_source {
        array.push $car_ids {
          value = $car_id_source.id
        }
      }
    }

    var $translation_rows {
      value = []
    }

    conditional {
      if (($car_ids|count) > 0) {
        db.query car_listing_translations {
          where = (($db.car_listing_translations.car_listing_id in $car_ids) && ($db.car_listing_translations.locale_code == $input.lang) && (($db.car_listing_translations.translation_status == "completed") || ($db.car_listing_translations.translation_status == "reviewed")))
          sort = {car_listing_translations.updated_at: "desc"}
          return = {type: "list"}
        } as $bounded_translation_rows

        var.update $translation_rows {
          value = $bounded_translation_rows
        }
      }
    }

    var $public_cars {
      value = []
    }

    foreach ($cars) {
      each as $car {
        var $source_locale {
          value = $car.source_locale|first_notnull:""|trim|to_lower
        }

        var $source_hash {
          value = $car.translation_source_hash|first_notnull:""
        }

        var $localized_title {
          value = ""
        }

        var $localized_description {
          value = ""
        }

        var $localized_seo_title {
          value = ""
        }

        var $localized_seo_description {
          value = ""
        }

        var $localized_image_alt_texts {
          value = []
        }

        var $translation {
          value = null
        }

        var $public_readiness {
          value = false
        }

        conditional {
          if (($source_locale == $input.lang) && (($car.title|first_notnull:""|trim) != "") && (($car.description|first_notnull:""|trim) != "")) {
            var.update $localized_title { value = $car.title|trim }
            var.update $localized_description { value = $car.description|trim }
            // car_listings has no optional SEO columns; translated rows do.
            // The frontend derives safe metadata for source-language records.
            var.update $localized_seo_title { value = "" }
            var.update $localized_seo_description { value = "" }
            var.update $localized_image_alt_texts { value = [] }
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

          elseif (($source_locale != "") && ($source_hash != "")) {
            array.filter ($translation_rows) if (($this.car_listing_id == $car.id) && ($this.locale_code == $input.lang) && ($this.source_locale == $source_locale) && ($this.source_hash == $source_hash) && (($this.translation_status == "completed") || ($this.translation_status == "reviewed")) && (($this.title|first_notnull:""|trim) != "") && (($this.description|first_notnull:""|trim) != "")) as $matching_translations

            foreach ($matching_translations) {
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

        conditional {
          if (($translation != null) && ($localized_title != "") && ($localized_description != "")) {
            var.update $public_readiness { value = true }
            var $available_locales { value = [] }
            array.push $available_locales { value = $input.lang }
            array.push $public_cars {
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
                transmission          : $car.transmission
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
        }
      }
    }
  }

  response = $public_cars
  tags = ["sitecraft-auto-market", "release-4", "locale-aware", "public-safe", "strict-readiness", "no-ai"]
  guid = "0AHIKwcTzuT2J6U9SGCdwsVqIcM"
}
