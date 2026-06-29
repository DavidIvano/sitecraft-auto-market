query "dashboard/listings/{id}" verb=PATCH {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    int id
    text title filters=trim
    text brand filters=trim
    text model filters=trim
    int year
    int mileage
    text fuel_type filters=trim
    text transmission filters=trim
    decimal price
    text city filters=trim
    text country?=Германия filters=trim
    text seller_name? filters=trim
    text seller_phone? filters=trim
    email? seller_email filters=trim|lower
    text description? filters=trim
    text replace_photos? filters=trim
    text delete_image_ids? filters=trim
    file[] photos?
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }

    db.get car_listings {
      field_name = "id"
      field_value = $input.id
    } as $car

    precondition ($car != null) {
      error_type = "notfound"
      error = "Listing not found"
    }

    precondition ($car.user_id == $auth.id) {
      error_type = "accessdenied"
      error = "This listing belongs to another user"
    }

    db.edit car_listings {
      field_name = "id"
      field_value = $input.id
      data = {
        updated_at     : "now"
        title          : $input.title
        brand          : $input.brand
        model          : $input.model
        year           : $input.year
        mileage        : $input.mileage
        fuel_type      : $input.fuel_type
        transmission   : $input.transmission
        price          : $input.price
        city           : $input.city
        country        : $input.country
        seller_name    : $input.seller_name
        seller_phone   : $input.seller_phone
        seller_email   : $input.seller_email
        description    : $input.description
        status         : "draft"
      }
    } as $car

    conditional {
      if ($input.replace_photos == "true") {
        db.query car_listing_images {
          where = $db.car_listing_images.car_listing_id == $input.id
          return = {type: "list"}
        } as $old_images

        foreach ($old_images) {
          each as $old_image {
            db.delete car_listing_images {
              field_name = "id"
              field_value = $old_image.id
            } as $deleted_image
          }
        }
      }
    }

    conditional {
      if ($input.delete_image_ids != null && $input.delete_image_ids != "") {
        var $delete_ids {
          value = $input.delete_image_ids|json_decode
        }

        foreach ($delete_ids) {
          each as $delete_id {
            db.get car_listing_images {
              field_name = "id"
              field_value = $delete_id
            } as $image_to_delete

            conditional {
              if ($image_to_delete != null && $image_to_delete.car_listing_id == $input.id) {
                db.delete car_listing_images {
                  field_name = "id"
                  field_value = $image_to_delete.id
                } as $deleted_image
              }
            }
          }
        }
      }
    }

    db.query car_listing_images {
      where = $db.car_listing_images.car_listing_id == $input.id
      sort = {car_listing_images.sort_order: "asc"}
      return = {type: "list"}
    } as $existing_images

    var $sort_order {
      value = $existing_images|count
    }

    conditional {
      if ($input.photos != null) {
        foreach ($input.photos) {
          each as $photo {
            conditional {
              if ($sort_order < 5) {
                storage.create_image {
                  access = "public"
                  value = $photo
                  filename = "car-listing-image.jpg"
                } as $image_metadata

                db.add car_listing_images {
                  data = {
                    created_at     : "now"
                    car_listing_id : $input.id
                    image          : $image_metadata
                    image_url      : $image_metadata.url
                    sort_order     : $sort_order
                    is_main        : false
                  }
                } as $image_row

                var.update $sort_order {
                  value = $sort_order + 1
                }
              }
            }
          }
        }
      }
    }

    db.query car_listing_images {
      where = $db.car_listing_images.car_listing_id == $input.id
      sort = {car_listing_images.sort_order: "asc"}
      return = {type: "list"}
    } as $images

    var $new_sort_order {
      value = 0
    }

    foreach ($images) {
      each as $image {
        db.edit car_listing_images {
          field_name = "id"
          field_value = $image.id
          data = {
            sort_order : $new_sort_order
            is_main    : $new_sort_order == 0
          }
        } as $image_updated

        var.update $new_sort_order {
          value = $new_sort_order + 1
        }
      }
    }

    db.query car_listing_images {
      where = $db.car_listing_images.car_listing_id == $input.id
      sort = {car_listing_images.sort_order: "asc"}
      return = {type: "list"}
    } as $images

    var $main_image_url {
      value = null
    }

    conditional {
      if (($images|count) > 0) {
        var.update $main_image_url {
          value = $images.0.image_url
        }
      }
    }

    db.edit car_listings {
      field_name = "id"
      field_value = $input.id
      data = {
        updated_at     : "now"
        main_image_url : $main_image_url
      }
    } as $car

    var $result {
      value = $car|set:"images":$images
    }
  }

  response = $result
}
