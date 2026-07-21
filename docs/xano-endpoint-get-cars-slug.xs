query "cars/{slug}" verb=GET {
  api_group = "sitecraft-auto-market"

  input {
    text slug filters=trim|lower
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
  
    var $contact {
      value = null
    }
  
    conditional {
      if (($car.seller_phone != null) && (($car.seller_phone|to_text|trim) != "")) {
        var.update $contact {
          value = {
            type: "phone"
            href: "tel:"|concat:($car.seller_phone|to_text|trim)
          }
        }
      }
    
      elseif (($car.seller_email != null) && (($car.seller_email|to_text|trim) != "")) {
        var.update $contact {
          value = {
            type: "email"
            href: "mailto:"|concat:($car.seller_email|to_text|trim|to_lower)
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
                main_image_url       : $seller_car.main_image_url
                thumbnail_url        : $seller_car.thumbnail_url
                primary_image_url    : $seller_car.primary_image_url
                image_url            : $seller_car.image_url
                cover_image_url      : $seller_car.cover_image_url
              }
            }
          }
        }
      }
    }
  
    var $model {
      value = ```
        {
          id                   : $car.id
          slug                 : $car.slug
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
          seller_listings      : $public_seller_cars
          seller               : {
            name                 : $car.seller_name|first_notnull:"Продавец"
            type                 : $car.seller_type
            city                 : $car.city
            active_listings_count: $other_public_count + 1
            contact              : $contact
          }
          created_at           : $car.created_at
          updated_at           : $car.updated_at
        }
        ```
    }
  }

  response = $model
  tags = [
    "sitecraft-auto-market"
    "cars"
    "images"
    "public-only"
    "privacy-v3"
  ]
}
