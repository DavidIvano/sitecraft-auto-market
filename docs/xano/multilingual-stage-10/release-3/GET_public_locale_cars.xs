query "public/locale/cars" verb=GET {
  api_group = "sitecraft-auto-market"

  input {
    text locale filters=trim|lower|max:10
  }

  stack {
    precondition ($input.locale == "de") {
      error_type = "notfound"
      error = "Locale not available"
    }

    db.query car_listings {
      where = ((($db.car_listings.status == "approved") || ($db.car_listings.status == "published") || ($db.car_listings.status == "sold") || ($db.car_listings.moderation_status == "approved") || ($db.car_listings.moderation_status == "published") || ($db.car_listings.moderation_status == "sold")) && (($db.car_listings.status == null) || (($db.car_listings.status != "draft") && ($db.car_listings.status != "ai_draft") && ($db.car_listings.status != "pending_review") && ($db.car_listings.status != "needs_fix") && ($db.car_listings.status != "rejected") && ($db.car_listings.status != "blocked") && ($db.car_listings.status != "deleted") && ($db.car_listings.status != "archived"))))
      sort = {car_listings.created_at: "desc"}
      return = {type: "list"}
    } as $cars

    var $car_ids { value = [] }
    foreach ($cars) {
      each as $car_id_source {
        array.push $car_ids { value = $car_id_source.id }
      }
    }

    var $translations { value = [] }
    conditional {
      if (($car_ids|count) > 0) {
        db.query car_listing_translations {
          where = (($db.car_listing_translations.car_listing_id in $car_ids) && ($db.car_listing_translations.locale_code == $input.locale))
          return = {type: "list"}
        } as $bounded_translations
        var.update $translations { value = $bounded_translations }
      }
    }

    var $public_cars { value = [] }
    foreach ($cars) {
      each as $car {
        array.filter ($translations) if (($this.car_listing_id == $car.id) && ($this.source_hash == $car.translation_source_hash)) as $current_translations
        var $translation { value = $current_translations|first }
        var $is_source_de { value = (($car.source_locale == "de") && ($translation != null) && ($translation.translation_status == "original")) }
        var $is_reviewed_de { value = (($car.source_locale != "de") && ($car.translations_ready == true) && ($translation != null) && ($translation.translation_status == "reviewed")) }
        var $public_legacy_status { value = "reviewed" }
        var $public_translation_status { value = "translated" }
        conditional {
          if ($is_source_de) {
            var.update $public_legacy_status { value = "original" }
            var.update $public_translation_status { value = "source" }
          }
        }

        conditional {
          if (($is_source_de || $is_reviewed_de) && (($translation.title|first_notnull:""|trim) != "") && (($translation.description|first_notnull:""|trim) != "")) {
            array.push $public_cars {
              value = {
                id                : $car.id
                slug              : $car.slug
                title             : $translation.title
                description       : $translation.description
                brand             : $car.brand
                model             : $car.model
                vehicle_type      : $car.vehicle_type
                body_type         : $car.body_type
                color             : $car.color
                year              : $car.year
                mileage           : $car.mileage
                fuel_type         : $car.fuel_type
                transmission      : $car.transmission
                price             : $car.price
                currency          : $car.currency
                city              : $car.city
                country           : $car.country
                status            : $car.status
                moderation_status : $car.moderation_status
                main_image_url    : $car.main_image_url
                thumbnail_url     : $car.thumbnail_url
                primary_image_url : $car.primary_image_url
                image_url         : $car.image_url
                cover_image_url   : $car.cover_image_url
                image_urls        : $car.image_urls
                created_at        : $car.created_at
                updated_at        : $car.updated_at
                source_locale     : $car.source_locale
                translation_version: $car.translation_version
                translations_ready: $is_source_de || $is_reviewed_de
                translation       : {
                  requested_locale : "de"
                  resolved_locale  : "de"
                  source_locale    : $car.source_locale
                  is_fallback      : false
                  status           : $public_legacy_status
                  translation_status: $public_translation_status
                  translation_version: $car.translation_version
                }
              }
            }
          }
        }
      }
    }
  }

  response = $public_cars
  tags = ["sitecraft-auto-market", "release-3-candidate", "locale-aware", "public-safe", "no-ai"]
}
