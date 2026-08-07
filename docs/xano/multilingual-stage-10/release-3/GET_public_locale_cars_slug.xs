query "public/locale/cars/{slug}" verb=GET {
  api_group = "sitecraft-auto-market"

  input {
    text slug filters=trim|lower
    text locale filters=trim|lower|max:10
  }

  stack {
    precondition ($input.locale == "de") {
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
      value = ((($car.status == "approved") || ($car.status == "published") || ($car.status == "sold") || ($car.moderation_status == "approved") || ($car.moderation_status == "published") || ($car.moderation_status == "sold")) && (($car.status == null) || (($car.status != "draft") && ($car.status != "ai_draft") && ($car.status != "pending_review") && ($car.status != "needs_fix") && ($car.status != "rejected") && ($car.status != "blocked") && ($car.status != "deleted") && ($car.status != "archived"))))
    }
    precondition ($is_public) {
      error_type = "notfound"
      error = "Listing not found"
    }

    db.query car_listing_translations {
      where = (($db.car_listing_translations.car_listing_id == $car.id) && ($db.car_listing_translations.locale_code == "de") && ($db.car_listing_translations.source_hash == $car.translation_source_hash))
      return = {type: "single"}
    } as $translation

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
    precondition (($is_source_de || $is_reviewed_de) && (($translation.title|first_notnull:""|trim) != "") && (($translation.description|first_notnull:""|trim) != "")) {
      error_type = "notfound"
      error = "German representation not available"
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
        id                : $car.id
        slug              : $car.slug
        title             : $translation.title
        description       : $translation.description
        seo_title         : $translation.seo_title
        seo_description   : $translation.seo_description
        image_alt_texts   : $translation.image_alt_texts
        brand             : $car.brand
        model             : $car.model
        vehicle_type      : $car.vehicle_type
        body_type         : $car.body_type
        color             : $car.color
        year              : $car.year
        mileage           : $car.mileage
        fuel_type         : $car.fuel_type
        engine_volume     : $car.engine_volume
        transmission      : $car.transmission
        drivetrain        : $car.drivetrain
        doors             : $car.doors
        seats             : $car.seats
        owners_count      : $car.owners_count|first_notnull:$car.owner_count
        first_registration: $car.first_registration|first_notnull:$car.first_registration_date
        has_valid_tuv     : $car.has_valid_tuv
        tuv_valid_until   : $car.tuv_valid_until
        price             : $car.price
        currency          : $car.currency
        city              : $car.city
        country           : $car.country
        status            : $car.status
        moderation_status : $car.moderation_status
        main_image_url    : $car.main_image_url
        cover_image_url   : $car.cover_image_url
        image_urls        : $car.image_urls
        images            : $public_images
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

  response = $model
  tags = ["sitecraft-auto-market", "release-3-candidate", "locale-aware", "public-safe", "no-contact", "no-ai"]
}
