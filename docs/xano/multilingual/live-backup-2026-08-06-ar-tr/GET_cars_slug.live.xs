query "cars/{slug}" verb=GET {
  api_group = "sitecraft-auto-market"

  input {
    text slug filters=trim|lower
    text lang?=ru filters=trim|lower
  }

  stack {
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

    precondition (($input.lang == "de") || ($input.lang == "ru") || ($input.lang == "uk") || ($input.lang == "en")) {
      error_type = "inputerror"
      error = "Unsupported locale"
    }

    var $source_locale {
      value = $car.source_locale
        |first_notnull:"ru"
        |trim
        |to_lower
    }

    var $source_hash {
      value = $car.translation_source_hash|first_notnull:""
    }

    var $translation {
      value = null
    }

    conditional {
      if (($input.lang != $source_locale) && ($source_hash != "")) {
        db.query car_listing_translations {
          where = (($db.car_listing_translations.car_listing_id == $car.id) && ($db.car_listing_translations.locale_code == $input.lang) && ($db.car_listing_translations.source_locale == $source_locale) && ($db.car_listing_translations.source_hash == $source_hash) && ($db.car_listing_translations.translation_status == "completed"))
          sort = {car_listing_translations.updated_at: "desc"}
          return = {type: "single"}
        } as $translation_row

        conditional {
          if (($translation_row != null) && ($translation_row.locale_code == $input.lang) && ($translation_row.source_locale == $source_locale) && ($translation_row.source_hash == $source_hash) && ($translation_row.translation_status == "completed")) {
            var.update $translation {
              value = {
                id           : $translation_row.id
                locale       : $translation_row.locale_code
                source_locale: $translation_row.source_locale
                source_hash  : $translation_row.source_hash
                status       : $translation_row.translation_status
                updated_at   : $translation_row.updated_at
                content      : {
                  title            : $translation_row.title
                  description      : $translation_row.description
                  seo_title        : $translation_row.seo_title
                  seo_description  : $translation_row.seo_description
                  image_alt_texts  : $translation_row.image_alt_texts
                  search_keywords  : $translation_row.search_keywords
                }
              }
            }
          }
        }
      }
    }

    var $views_total {
      value = 0
    }

    try_catch {
      try {
        db.query listing_views {
          where = $db.listing_views.car_id == $car.id
          return = {type: "count"}
        } as $public_view_count

        var.update $views_total {
          value = $public_view_count
        }
      }

      catch {
        var.update $views_total {
          value = 0
        }
      }
    }

    db.query car_listing_images {
      where = (($db.car_listing_images.car_listing_id == $car.id) && ($db.car_listing_images.is_deleted != true))
      sort = {car_listing_images.sort_order: "asc"}
      return = {type: "list"}
    } as $images

    var $public_images {
      value = []
    }

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

    var $vin_masked {
      value = ""
    }

    conditional {
      if (($car.vin != null) && (($car.vin|to_text|trim|strlen) == 17)) {
        var.update $vin_masked {
          value = ($car.vin|to_text|trim|substr:0:3)|concat:"***********"|concat:($car.vin|to_text|trim|substr:14:3)
        }
      }
    }

    db.get automarket_users {
      field_name = "id"
      field_value = $car.user_id
    } as $seller_profile

    var $seller_public_name {
      value = $car.seller_name|first_notnull:"Продавец"
    }

    conditional {
      if (($seller_profile != null) && (($seller_profile.display_name|first_notnull:""|trim) != "")) {
        var.update $seller_public_name {
          value = $seller_profile.display_name|trim
        }
      }

      elseif (($seller_profile != null) && (((($seller_profile.first_name|first_notnull:""|trim)|concat:" "|concat:($seller_profile.last_name|first_notnull:""|trim))|trim) != "")) {
        var.update $seller_public_name {
          value = (($seller_profile.first_name|first_notnull:""|trim)|concat:" "|concat:($seller_profile.last_name|first_notnull:""|trim))|trim
        }
      }
    }

    conditional {
      if (($seller_public_name|first_notnull:""|trim) == "") {
        var.update $seller_public_name {
          value = "Продавец автомобиля"
        }
      }
    }

    var $public_phone {
      value = null
    }

    var $public_email {
      value = null
    }

    conditional {
      if (($seller_profile != null) && $seller_profile.show_phone && (($seller_profile.contact_phone|first_notnull:""|trim) != "")) {
        var.update $public_phone {
          value = $seller_profile.contact_phone|trim
        }
      }
    }

    conditional {
      if (($seller_profile != null) && $seller_profile.show_email && (($seller_profile.contact_email|first_notnull:""|trim) != "")) {
        var.update $public_email {
          value = $seller_profile.contact_email|trim|to_lower
        }
      }
    }

    var $contact {
      value = null
    }

    var $phone_href {
      value = null
    }

    var $email_href {
      value = null
    }

    conditional {
      if ($public_phone != null) {
        var.update $phone_href {
          value = "tel:"|concat:$public_phone
        }
      }
    }

    conditional {
      if ($public_email != null) {
        var.update $email_href {
          value = "mailto:"|concat:$public_email
        }
      }
    }

    var $public_seller_type {
      value = "private"
    }

    conditional {
      if ((($car.seller_type|first_notnull:""|to_text|trim|to_lower) == "dealer") || ($car.seller_type|first_notnull:""|to_text|trim|to_lower)|contains:"дилер") {
        var.update $public_seller_type {
          value = "dealer"
        }
      }
    }

    conditional {
      if (($public_phone != null) || ($public_email != null)) {
        var.update $contact {
          value = {
            phone           : $public_phone
            phone_href      : $phone_href
            email           : $public_email
            email_href      : $email_href
            preferred_method: $seller_profile.preferred_contact_method
          }
        }
      }
    }

    db.query car_listings {
      where = (($db.car_listings.user_id == $car.user_id) && ($db.car_listings.id != $car.id) && (($db.car_listings.status == "approved") || ($db.car_listings.status == "published") || ($db.car_listings.status == "sold") || ($db.car_listings.moderation_status == "approved") || ($db.car_listings.moderation_status == "published") || ($db.car_listings.moderation_status == "sold")))
      return = {type: "count"}
    } as $other_public_count

    db.query car_listings {
      where = (($db.car_listings.user_id == $car.user_id) && ($db.car_listings.id != $car.id) && (($db.car_listings.status == "approved") || ($db.car_listings.status == "published") || ($db.car_listings.status == "sold") || ($db.car_listings.moderation_status == "approved") || ($db.car_listings.moderation_status == "published") || ($db.car_listings.moderation_status == "sold")) && (($db.car_listings.status == null) || (($db.car_listings.status != "draft") && ($db.car_listings.status != "ai_draft") && ($db.car_listings.status != "pending_review") && ($db.car_listings.status != "needs_fix") && ($db.car_listings.status != "rejected") && ($db.car_listings.status != "blocked") && ($db.car_listings.status != "deleted") && ($db.car_listings.status != "archived"))) && (($db.car_listings.moderation_status == null) || (($db.car_listings.moderation_status != "draft") && ($db.car_listings.moderation_status != "ai_draft") && ($db.car_listings.moderation_status != "pending_review") && ($db.car_listings.moderation_status != "needs_fix") && ($db.car_listings.moderation_status != "rejected") && ($db.car_listings.moderation_status != "blocked") && ($db.car_listings.moderation_status != "deleted") && ($db.car_listings.moderation_status != "archived"))))
      sort = {car_listings.created_at: "desc"}
      return = {type: "list"}
    } as $seller_cars

    var $public_seller_cars {
      value = []
    }

    foreach ($seller_cars) {
      each as $seller_car {
        conditional {
          if (($public_seller_cars|count) < 6) {
            array.push $public_seller_cars {
              value = {
                id                   : $seller_car.id
                slug                 : $seller_car.slug
                title                : $seller_car.title
                brand                : $seller_car.brand
                model                : $seller_car.model
                year                 : $seller_car.year
                mileage              : $seller_car.mileage
                fuel_type            : $seller_car.fuel_type
                transmission         : $seller_car.transmission
                body_type            : $seller_car.body_type
                price                : $seller_car.price
                currency             : $seller_car.currency
                city                 : $seller_car.city
                country              : $seller_car.country
                is_ai_generated      : $seller_car.is_ai_generated
                listing_quality_score: $seller_car.listing_quality_score
                photo_quality_score  : $seller_car.photo_quality_score
                trust_score          : $seller_car.trust_score
                boosted_at           : $seller_car.boosted_at
                boosted_until        : $seller_car.boosted_until
                featured_at          : $seller_car.featured_at
                featured_until       : $seller_car.featured_until
                homepage_at          : $seller_car.homepage_at
                homepage_until       : $seller_car.homepage_until
                last_promoted_at     : $seller_car.last_promoted_at
                main_image_url       : $seller_car.main_image_url
                thumbnail_url        : $seller_car.thumbnail_url
                primary_image_url    : $seller_car.primary_image_url
                image_url            : $seller_car.image_url
                cover_image_url      : $seller_car.cover_image_url
                is_saved             : false
              }
            }
          }
        }
      }
    }

    var $model {
      value = {
        id                   : $car.id
        slug                 : $car.slug
        source_locale        : $source_locale
        translation          : $translation
        title                : $car.title
        brand                : $car.brand
        model                : $car.model
        vehicle_type         : $car.vehicle_type
        body_type            : $car.body_type
        color                : $car.color
        vehicle_condition    : $car.vehicle_condition|first_notnull:$car.condition
        year                 : $car.year
        mileage              : $car.mileage
        fuel_type            : $car.fuel_type
        engine_volume        : $car.engine_volume
        transmission         : $car.transmission
        drivetrain           : $car.drivetrain
        doors                : $car.doors
        seats                : $car.seats
        owners_count         : $car.owners_count|first_notnull:$car.owner_count
        first_registration   : $car.first_registration|first_notnull:$car.first_registration_date
        has_valid_tuv        : $car.has_valid_tuv
        tuv_valid_until      : $car.tuv_valid_until
        vin_masked           : $vin_masked
        price                : $car.price
        currency             : $car.currency
        city                 : $car.city
        country              : $car.country
        description          : $car.description
        status               : $car.status
        moderation_status    : $car.moderation_status
        sold_at              : $car.sold_at
        moderator_approved   : $car.moderator_approved
        seller_type          : $car.seller_type
        dealer_verified      : $car.dealer_verified
        is_ai_generated      : $car.is_ai_generated
        ai_highlights        : $car.ai_highlights
        ai_listing_score     : $car.ai_listing_score
        listing_quality_score: $car.listing_quality_score
        photo_quality_score  : $car.photo_quality_score
        trust_score          : $car.trust_score
        boosted_at           : $car.boosted_at
        boosted_until        : $car.boosted_until
        featured_at          : $car.featured_at
        featured_until       : $car.featured_until
        homepage_at          : $car.homepage_at
        homepage_until       : $car.homepage_until
        last_promoted_at     : $car.last_promoted_at
        ai_analysis          : $car.ai_analysis
        ai_recommendations   : $car.ai_recommendations
        ai_warnings          : $car.ai_warnings
        ai_missing_fields    : $car.ai_missing_fields
        seo_title            : $car.seo_title
        seo_description      : $car.seo_description
        image_alt_texts      : $car.image_alt_texts
        main_image_url       : $car.main_image_url
        cover_image_url      : $car.cover_image_url
        image_urls           : $car.image_urls
        images               : $public_images
        is_saved             : false
        views_total          : $views_total
        seller_listings      : $public_seller_cars
        seller               : {
          name                 : $seller_public_name
          type                 : $public_seller_type
          city                 : $car.city
          active_listings_count: $other_public_count + 1
          contact              : $contact
        }
        created_at           : $car.created_at
        updated_at           : $car.updated_at
      }
    }
  }

  response = $model
  tags = [
    "sitecraft-auto-market"
    "cars"
    "images"
    "public-only"
    "privacy-v3"
    "views-public"
    "i18n-draft"
  ]

  test "missing translation falls back to source" {
    input = {slug: "audi-80-2026-75", lang: "de"}

    expect.to_equal ($response.source_locale) {
      value = "ru"
    }

    expect.to_be_null ($response.translation)
  }

  test "unsupported locale is rejected" {
    input = {slug: "audi-80-2026-75", lang: "fr"}

    expect.to_throw {
      exception = ""
    }
  }
}