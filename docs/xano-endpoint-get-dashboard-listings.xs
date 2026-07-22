// Endpoint: GET /dashboard/listings
// Owner-only dashboard projection with one active thumbnail per listing.
// Pending/private listings are intentionally visible only to their owner here.

query "dashboard/listings" verb=GET {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }

    db.get automarket_users {
      field_name = "id"
      field_value = $auth.id
    } as $current_user

    precondition ($current_user != null) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }

    db.query car_listings {
      where = $db.car_listings.user_id == $current_user.id
      sort = {car_listings.created_at: "desc"}
      return = {type: "list"}
    } as $cars

    var $owned_listings {
      value = []
    }

    foreach ($cars) {
      each as $car {
        db.query car_listing_images {
          where = (($db.car_listing_images.car_listing_id == $car.id) && ($db.car_listing_images.is_deleted != true))
          sort = {car_listing_images.sort_order: "asc", car_listing_images.id: "asc"}
          return = {type: "list"}
        } as $active_images

        var $main_url {
          value = ""
        }

        var $primary_url {
          value = ""
        }

        var $ordered_url {
          value = ""
        }

        foreach ($active_images) {
          each as $image {
            var $image_url {
              value = $image.image_url|first_notnull:""|to_text|trim
            }

            conditional {
              if (($image_url|starts_with:"https://") && ($ordered_url == "")) {
                var.update $ordered_url {
                  value = $image_url
                }
              }
            }

            conditional {
              if (($image_url|starts_with:"https://") && ($image.is_primary == true) && ($primary_url == "")) {
                var.update $primary_url {
                  value = $image_url
                }
              }
            }

            conditional {
              if (($image_url|starts_with:"https://") && ($image.is_main == true) && ($main_url == "")) {
                var.update $main_url {
                  value = $image_url
                }
              }
            }
          }
        }

        var $thumbnail_url {
          value = $main_url
        }

        conditional {
          if ($thumbnail_url == "") {
            var.update $thumbnail_url {
              value = $primary_url
            }
          }
        }

        conditional {
          if ($thumbnail_url == "") {
            var.update $thumbnail_url {
              value = $ordered_url
            }
          }
        }

        array.push $owned_listings {
          value = {
            id               : $car.id
            slug             : $car.slug
            title            : $car.title
            brand            : $car.brand
            model            : $car.model
            year             : $car.year
            mileage          : $car.mileage
            fuel_type        : $car.fuel_type
            price            : $car.price
            currency         : $car.currency
            city             : $car.city
            status           : $car.status
            moderation_status: $car.moderation_status
            created_at       : $car.created_at
            updated_at       : $car.updated_at
            thumbnail_url    : $thumbnail_url
            boosted_at       : $car.boosted_at
            boosted_until    : $car.boosted_until
            featured_at      : $car.featured_at
            featured_until   : $car.featured_until
            homepage_at      : $car.homepage_at
            homepage_until   : $car.homepage_until
            last_promoted_at : $car.last_promoted_at
          }
        }
      }
    }
  }

  response = $owned_listings
  tags = ["sitecraft-auto-market", "dashboard", "listings", "owner-only"]
}
