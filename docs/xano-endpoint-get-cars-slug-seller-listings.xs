// Public, privacy-minimized cards from the same seller as a public listing.
query "cars/{slug}/seller-listings" verb=GET {
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

    db.query car_listings {
      where = (($db.car_listings.user_id == $car.user_id) && ($db.car_listings.id != $car.id) && (($db.car_listings.status == "approved") || ($db.car_listings.status == "published") || ($db.car_listings.status == "sold") || ($db.car_listings.moderation_status == "approved") || ($db.car_listings.moderation_status == "published") || ($db.car_listings.moderation_status == "sold")) && (($db.car_listings.status == null) || (($db.car_listings.status != "draft") && ($db.car_listings.status != "ai_draft") && ($db.car_listings.status != "pending_review") && ($db.car_listings.status != "needs_fix") && ($db.car_listings.status != "rejected") && ($db.car_listings.status != "blocked") && ($db.car_listings.status != "deleted") && ($db.car_listings.status != "archived"))) && (($db.car_listings.moderation_status == null) || (($db.car_listings.moderation_status != "draft") && ($db.car_listings.moderation_status != "ai_draft") && ($db.car_listings.moderation_status != "pending_review") && ($db.car_listings.moderation_status != "needs_fix") && ($db.car_listings.moderation_status != "rejected") && ($db.car_listings.moderation_status != "blocked") && ($db.car_listings.moderation_status != "deleted") && ($db.car_listings.moderation_status != "archived"))))
      sort = {car_listings.created_at: "desc"}
      return = {type: "list"}
    } as $seller_cars

    var $public_cars {
      value = []
    }

    foreach ($seller_cars) {
      each as $seller_car {
        conditional {
          if (($public_cars|count) < 6) {
            array.push $public_cars {
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
  }

  response = $public_cars
  tags = ["sitecraft-auto-market", "cars", "seller-listings", "public-only", "privacy-v3"]
}
