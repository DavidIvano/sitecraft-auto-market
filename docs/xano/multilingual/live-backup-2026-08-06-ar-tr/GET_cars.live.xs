query cars verb=GET {
  api_group = "sitecraft-auto-market"

  input {
    text lang?=ru filters=trim|lower
  }

  stack {
    precondition (($input.lang == "de") || ($input.lang == "ru") || ($input.lang == "uk") || ($input.lang == "en")) {
      error_type = "inputerror"
      error = "Unsupported locale"
    }

    db.query car_listings {
      where = ((($db.car_listings.status == "approved") || ($db.car_listings.status == "published") || ($db.car_listings.status == "sold") || ($db.car_listings.moderation_status == "approved") || ($db.car_listings.moderation_status == "published") || ($db.car_listings.moderation_status == "sold")) && (($db.car_listings.status == null) || (($db.car_listings.status != "draft") && ($db.car_listings.status != "ai_draft") && ($db.car_listings.status != "pending_review") && ($db.car_listings.status != "needs_fix") && ($db.car_listings.status != "rejected") && ($db.car_listings.status != "blocked") && ($db.car_listings.status != "deleted") && ($db.car_listings.status != "archived"))) && (($db.car_listings.moderation_status == null) || (($db.car_listings.moderation_status != "draft") && ($db.car_listings.moderation_status != "ai_draft") && ($db.car_listings.moderation_status != "pending_review") && ($db.car_listings.moderation_status != "needs_fix") && ($db.car_listings.moderation_status != "rejected") && ($db.car_listings.moderation_status != "blocked") && ($db.car_listings.moderation_status != "deleted") && ($db.car_listings.moderation_status != "archived"))))
      sort = {car_listings.created_at: "desc"}
      return = {type: "list"}
    } as $cars

    var $public_car_ids {
      value = []
    }

    foreach ($cars) {
      each as $public_car {
        array.push $public_car_ids {
          value = $public_car.id
        }
      }
    }

    var $public_views {
      value = []
    }

    var $translation_rows {
      value = []
    }

    conditional {
      if (($public_car_ids|count) > 0) {
        try_catch {
          try {
            db.query listing_views {
              where = $db.listing_views.car_id in $public_car_ids
              return = {type: "list"}
            } as $all_public_views

            var.update $public_views {
              value = $all_public_views
            }
          }

          catch {
            var.update $public_views {
              value = []
            }
          }
        }

        db.query car_listing_translations {
          where = (($db.car_listing_translations.car_listing_id in $public_car_ids) && ($db.car_listing_translations.locale_code == $input.lang) && ($db.car_listing_translations.translation_status == "completed"))
          sort = {car_listing_translations.updated_at: "desc"}
          return = {type: "list"}
        } as $all_translation_rows

        var.update $translation_rows {
          value = $all_translation_rows
        }
      }
    }

    var $public_cars {
      value = []
    }

    foreach ($cars) {
      each as $car {
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
            array.filter ($translation_rows) if (($this.car_listing_id == $car.id) && ($this.locale_code == $input.lang) && ($this.source_locale == $source_locale) && ($this.source_hash == $source_hash) && ($this.translation_status == "completed")) as $matching_translations
            foreach ($matching_translations) {
              each as $translation_row {
                conditional {
                  if (($translation == null) && ($translation_row.locale_code == $input.lang) && ($translation_row.source_locale == $source_locale) && ($translation_row.source_hash == $source_hash) && ($translation_row.translation_status == "completed")) {
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
          }
        }

        array.filter ($public_views) if ($this.car_id == $car.id) as $car_views
        array.push $public_cars {
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
            price                : $car.price
            currency             : $car.currency
            city                 : $car.city
            country              : $car.country
            status               : $car.status
            moderation_status    : $car.moderation_status
            sold_at              : $car.sold_at
            moderator_approved   : $car.moderator_approved
            seller_type          : $car.seller_type
            dealer_verified      : $car.dealer_verified
            is_ai_generated      : $car.is_ai_generated
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
            main_image_url       : $car.main_image_url
            thumbnail_url        : $car.thumbnail_url
            primary_image_url    : $car.primary_image_url
            image_url            : $car.image_url
            cover_image_url      : $car.cover_image_url
            image_urls           : $car.image_urls
            is_saved             : false
            views_total          : $car_views|count
            created_at           : $car.created_at
            updated_at           : $car.updated_at
          }
        }
      }
    }
  }

  response = $public_cars
  tags = [
    "sitecraft-auto-market"
    "cars"
    "public-only"
    "privacy-v2"
    "views-public"
    "i18n-draft"
  ]
}