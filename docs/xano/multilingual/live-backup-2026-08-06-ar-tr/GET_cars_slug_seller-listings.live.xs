// Public, privacy-minimized cards from the same seller as a public listing.
query "cars/{slug}/seller-listings" verb=GET {
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
  
    db.query car_listings {
      where = (($db.car_listings.user_id == $car.user_id) && ($db.car_listings.id != $car.id) && (($db.car_listings.status == "approved") || ($db.car_listings.status == "published") || ($db.car_listings.status == "sold") || ($db.car_listings.moderation_status == "approved") || ($db.car_listings.moderation_status == "published") || ($db.car_listings.moderation_status == "sold")) && (($db.car_listings.status == null) || (($db.car_listings.status != "draft") && ($db.car_listings.status != "ai_draft") && ($db.car_listings.status != "pending_review") && ($db.car_listings.status != "needs_fix") && ($db.car_listings.status != "rejected") && ($db.car_listings.status != "blocked") && ($db.car_listings.status != "deleted") && ($db.car_listings.status != "archived"))) && (($db.car_listings.moderation_status == null) || (($db.car_listings.moderation_status != "draft") && ($db.car_listings.moderation_status != "ai_draft") && ($db.car_listings.moderation_status != "pending_review") && ($db.car_listings.moderation_status != "needs_fix") && ($db.car_listings.moderation_status != "rejected") && ($db.car_listings.moderation_status != "blocked") && ($db.car_listings.moderation_status != "deleted") && ($db.car_listings.moderation_status != "archived"))))
      sort = {car_listings.created_at: "desc"}
      return = {type: "list"}
    } as $seller_cars
  
    var $seller_car_ids {
      value = []
    }
  
    foreach ($seller_cars) {
      each as $seller_car {
        array.push $seller_car_ids {
          value = $seller_car.id
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
      if (($seller_car_ids|count) > 0) {
        try_catch {
          try {
            db.query listing_views {
              where = $db.listing_views.car_id in $seller_car_ids
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
          where = (($db.car_listing_translations.car_listing_id in $seller_car_ids) && ($db.car_listing_translations.locale_code == $input.lang) && ($db.car_listing_translations.translation_status == "completed"))
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
  
    foreach ($seller_cars) {
      each as $seller_car {
        conditional {
          if (($public_cars|count) < 6) {
            var $source_locale {
              value = $seller_car.source_locale
                |first_notnull:"ru"
                |trim
                |to_lower
            }
          
            var $source_hash {
              value = $seller_car.translation_source_hash|first_notnull:""
            }
          
            var $translation {
              value = null
            }
          
            conditional {
              if (($input.lang != $source_locale) && ($source_hash != "")) {
                array.filter ($translation_rows) if (($this.car_listing_id == $seller_car.id) && ($this.locale_code == $input.lang) && ($this.source_locale == $source_locale) && ($this.source_hash == $source_hash) && ($this.translation_status == "completed")) as $matching_translations
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
          
            array.filter ($public_views) if ($this.car_id == $seller_car.id) as $seller_car_views
            array.push $public_cars {
              value = {
                id                   : $seller_car.id
                slug                 : $seller_car.slug
                source_locale        : $source_locale
                translation          : $translation
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
                trust_score          : $seller_car.trust_score
                main_image_url       : $seller_car.main_image_url
                thumbnail_url        : $seller_car.thumbnail_url
                primary_image_url    : $seller_car.primary_image_url
                image_url            : $seller_car.image_url
                cover_image_url      : $seller_car.cover_image_url
                views_total          : $seller_car_views|count
              }
            }
          }
        }
      }
    }
  }

  response = $public_cars
  tags = [
    "sitecraft-auto-market"
    "cars"
    "seller-listings"
    "public-only"
    "privacy-v3"
    "views-public"
    "i18n-draft"
  ]
}