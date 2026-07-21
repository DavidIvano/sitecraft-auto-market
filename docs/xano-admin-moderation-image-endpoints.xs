// SiteCraft Auto Market admin moderation + image editing endpoints.
// Вставляй по частям: сначала table patch, затем endpoint-ы в API group sitecraft-auto-market.
// Если твоя auth-table в Xano называется иначе, замени auth = "automarket_users" на имя твоей auth table.

table car_listing_images {
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?
    int car_listing_id
    json image
    text image_url
    text image_key?
    int sort_order?=0
    bool is_main?=false
    bool is_deleted?=false
    timestamp deleted_at?
  }

  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "car_listing_id", op: "asc"}]}
    {type: "btree", field: [{name: "sort_order", op: "asc"}]}
    {type: "btree", field: [{name: "is_deleted", op: "asc"}]}
  ]
}

query "admin/moderation" verb=GET {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    text? status filters=trim
  }

  stack {
    db.get automarket_users {
      field_name = "id"
      field_value = $auth.id
    } as $current_user

    precondition (($current_user.role == "admin") || ($current_user.email == "ivanovdavid19@gmail.com") || ($current_user.email == "ivanovdavid119@gmail.com")) {
      error_type = "accessdenied"
      error = "Admin access required"
    }

    db.query car_listings {
      where = ($input.status == null || $input.status == "" || $input.status == "all" || $db.car_listings.status == $input.status)
      sort = {car_listings.created_at: "desc"}
      return = {type: "list"}
    } as $cars

    foreach ($cars) {
      each as $car {
        db.query car_listing_images {
          where = (($db.car_listing_images.car_listing_id == $car.id) && ($db.car_listing_images.is_deleted != true))
          sort = {car_listing_images.sort_order: "asc"}
          return = {type: "list"}
        } as $images

        var.update $car {
          value = $car|set:"images":$images
        }
      }
    }
  }

  response = $cars

  tags = ["sitecraft-auto-market", "admin", "moderation"]
}

query "admin/cars/{id}/delete" verb=PATCH {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    int id filters=min:1
  }

  stack {
    db.get automarket_users {
      field_name = "id"
      field_value = $auth.id
    } as $current_user

    precondition (($current_user.role == "admin") || ($current_user.email == "ivanovdavid19@gmail.com") || ($current_user.email == "ivanovdavid119@gmail.com")) {
      error_type = "accessdenied"
      error = "Admin access required"
    }

    db.get car_listings {
      field_name = "id"
      field_value = $input.id
    } as $car

    precondition ($car != null) {
      error_type = "notfound"
      error = "Listing not found"
    }

    db.edit car_listings {
      field_name = "id"
      field_value = $input.id
      data = {
        updated_at: "now"
        status    : "deleted"
        moderation_status: "deleted"
        deleted_at: "now"
      }
    } as $updated
  }

  response = $updated

  tags = ["sitecraft-auto-market", "admin", "cars", "delete"]
}

query "admin/cars/{id}/images" verb=POST {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    int id filters=min:1
    json r2_images
  }

  stack {
    db.get automarket_users {
      field_name = "id"
      field_value = $auth.id
    } as $current_user

    precondition (($current_user.role == "admin") || ($current_user.email == "ivanovdavid19@gmail.com") || ($current_user.email == "ivanovdavid119@gmail.com")) {
      error_type = "accessdenied"
      error = "Admin access required"
    }

    db.get car_listings {
      field_name = "id"
      field_value = $input.id
    } as $car

    precondition ($car != null) {
      error_type = "notfound"
      error = "Listing not found"
    }

    db.query car_listing_images {
      where = (($db.car_listing_images.car_listing_id == $input.id) && ($db.car_listing_images.is_deleted != true))
      sort = {car_listing_images.sort_order: "asc"}
      return = {type: "list"}
    } as $existing_images

    precondition (($existing_images|count) < 5) {
      error_type = "overflow"
      error = "Maximum 5 active images per listing"
    }

    var $next_order {
      value = $existing_images|count
    }

    foreach ($input.r2_images) {
      each as $item {
        conditional {
          if ($next_order < 5) {
            db.add car_listing_images {
              data = {
                created_at     : "now"
                updated_at     : "now"
                car_listing_id : $input.id
                image_url      : $item.url
                image_key      : $item.key
                mime_type      : $item.contentType
                original_filename: $item.key
                size_bytes     : $item.size
                image_metadata : $item
                sort_order     : $next_order
                is_main        : (($existing_images|count) == 0 && $next_order == 0)
                is_primary     : (($existing_images|count) == 0 && $next_order == 0)
                is_deleted     : false
              }
            } as $image_row

            conditional {
              if (($existing_images|count) == 0 && $next_order == 0) {
                db.edit car_listings {
                  field_name = "id"
                  field_value = $input.id
                  data = {
                    updated_at      : "now"
                    main_image_url  : $item.url
                    cover_image_url : $item.url
                  }
                } as $car_main_updated
              }
            }

            var.update $next_order {
              value = $next_order + 1
            }
          }
        }
      }
    }

    db.query car_listing_images {
      where = (($db.car_listing_images.car_listing_id == $input.id) && ($db.car_listing_images.is_deleted != true))
      sort = {car_listing_images.sort_order: "asc"}
      return = {type: "list"}
    } as $images
  }

  response = {
    images: $images
    count : ($images|count)
  }

  tags = ["sitecraft-auto-market", "admin", "cars", "images"]
}

query "admin/cars/{id}/images/{image_id}/main" verb=PATCH {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    int id filters=min:1
    int image_id filters=min:1
  }

  stack {
    db.get automarket_users {
      field_name = "id"
      field_value = $auth.id
    } as $current_user

    precondition (($current_user.role == "admin") || ($current_user.email == "ivanovdavid19@gmail.com") || ($current_user.email == "ivanovdavid119@gmail.com")) {
      error_type = "accessdenied"
      error = "Admin access required"
    }

    db.get car_listing_images {
      field_name = "id"
      field_value = $input.image_id
    } as $chosen

    precondition ($chosen != null) {
      error_type = "notfound"
      error = "Image not found"
    }

    precondition ($chosen.car_listing_id == $input.id) {
      error_type = "accessdenied"
      error = "Image belongs to another listing"
    }

    precondition ($chosen.is_deleted != true) {
      error_type = "invalid"
      error = "Cannot use deleted image"
    }

    db.query car_listing_images {
      where = (($db.car_listing_images.car_listing_id == $input.id) && ($db.car_listing_images.is_deleted != true))
      return = {type: "list"}
    } as $images

    foreach ($images) {
      each as $image {
        db.edit car_listing_images {
          field_name = "id"
          field_value = $image.id
          data = {
            updated_at: "now"
            is_main   : false
            is_primary: false
          }
        } as $unset_image
      }
    }

    db.edit car_listing_images {
      field_name = "id"
      field_value = $input.image_id
      data = {
        updated_at: "now"
        sort_order: 0
        is_main   : true
        is_primary: true
      }
    } as $main_image

    db.edit car_listings {
      field_name = "id"
      field_value = $input.id
      data = {
        updated_at      : "now"
        main_image_url  : $chosen.image_url
        cover_image_url : $chosen.image_url
      }
    } as $car
  }

  response = {
    car  : $car
    image: $main_image
  }

  tags = ["sitecraft-auto-market", "admin", "cars", "images"]
}

query "admin/cars/{id}/images/{image_id}/delete" verb=PATCH {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    int id filters=min:1
    int image_id filters=min:1
  }

  stack {
    db.get automarket_users {
      field_name = "id"
      field_value = $auth.id
    } as $current_user

    precondition (($current_user.role == "admin") || ($current_user.email == "ivanovdavid19@gmail.com") || ($current_user.email == "ivanovdavid119@gmail.com")) {
      error_type = "accessdenied"
      error = "Admin access required"
    }

    db.get car_listing_images {
      field_name = "id"
      field_value = $input.image_id
    } as $image

    precondition ($image != null) {
      error_type = "notfound"
      error = "Image not found"
    }

    precondition ($image.car_listing_id == $input.id) {
      error_type = "accessdenied"
      error = "Image belongs to another listing"
    }

    db.edit car_listing_images {
      field_name = "id"
      field_value = $input.image_id
      data = {
        updated_at : "now"
        is_deleted: true
        deleted_at: "now"
        is_main   : false
        is_primary: false
      }
    } as $deleted_image

    db.query car_listing_images {
      where = (($db.car_listing_images.car_listing_id == $input.id) && ($db.car_listing_images.is_deleted != true))
      sort = {car_listing_images.sort_order: "asc"}
      return = {type: "list"}
    } as $remaining_images

    conditional {
      if (($remaining_images|count) > 0) {
        db.edit car_listing_images {
          field_name = "id"
          field_value = $remaining_images.0.id
          data = {
            updated_at: "now"
            sort_order: 0
            is_main   : true
            is_primary: true
          }
        } as $new_main_image

        db.edit car_listings {
          field_name = "id"
          field_value = $input.id
          data = {
            updated_at      : "now"
            main_image_url  : $remaining_images.0.image_url
            cover_image_url : $remaining_images.0.image_url
          }
        } as $car
      }
    }

    conditional {
      if (($remaining_images|count) == 0) {
        db.edit car_listings {
          field_name = "id"
          field_value = $input.id
          data = {
            updated_at      : "now"
            main_image_url  : ""
            cover_image_url : ""
          }
        } as $car
      }
    }
  }

  response = {
    deleted: $deleted_image
    images : $remaining_images
    car    : $car
  }

  tags = ["sitecraft-auto-market", "admin", "cars", "images"]
}
