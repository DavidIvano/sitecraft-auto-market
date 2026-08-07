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

    var $owned_car_ids {
      value = []
    }

    foreach ($cars) {
      each as $owned_car {
        array.push $owned_car_ids {
          value = $owned_car.id
        }
      }
    }

    var $owner_views {
      value = []
    }

    conditional {
      if (($owned_car_ids|count) > 0) {
        db.query listing_views {
          where = $db.listing_views.car_id in $owned_car_ids
          sort = {listing_views.created_at: "desc"}
          return = {type: "list"}
        } as $all_owner_views

        var.update $owner_views {
          value = $all_owner_views
        }
      }
    }

    var $views_7d_after {
      value = now|add_secs_to_timestamp:-604800
    }

    var $owned_listings {
      value = []
    }

    foreach ($cars) {
      each as $car {
        array.filter ($owner_views) if ($this.car_id == $car.id) as $car_views
        array.filter ($car_views) if ($this.created_at >= $views_7d_after) as $car_views_7d
        array.find ($car_views) if ($this.car_id == $car.id) as $last_view

        var $unique_sessions {
          value = []
        }

        foreach ($car_views) {
          each as $car_view {
            array.find ($unique_sessions) if ($this == $car_view.session_id) as $known_session

            conditional {
              if ($known_session == null) {
                array.push $unique_sessions {
                  value = $car_view.session_id
                }
              }
            }
          }
        }

        var $last_viewed_at {
          value = null
        }

        conditional {
          if ($last_view != null) {
            var.update $last_viewed_at {
              value = $last_view.created_at
            }
          }
        }

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
            has_valid_tuv    : $car.has_valid_tuv
            tuv_valid_until  : $car.tuv_valid_until
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
            views_total      : $car_views|count
            views_unique     : $unique_sessions|count
            views_7d         : $car_views_7d|count
            last_viewed_at   : $last_viewed_at
          }
        }
      }
    }
  }

  response = $owned_listings
  tags = ["sitecraft-auto-market", "dashboard", "listings", "owner-only"]
}
