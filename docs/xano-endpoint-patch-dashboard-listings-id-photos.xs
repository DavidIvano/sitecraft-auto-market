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
    email seller_email? filters=trim|lower
    text description? filters=trim
    text replace_photos? filters=trim
    text delete_image_ids? filters=trim
    text r2_images?
    text image_urls?
    text image_keys?
    text new_image_urls?
    text new_image_keys?
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

    db.get automarket_users {
      field_name = "id"
      field_value = $auth.id
    } as $current_user

    precondition ($current_user != null) {
      error_type = "accessdenied"
      error = "User not found"
    }

    precondition (
      ($car.user_id == $auth.id) ||
      ($current_user.role == "admin") ||
      ($current_user.email == "ivanovdavid19@gmail.com") ||
      ($current_user.email == "ivanovdavid119@gmail.com")
    ) {
      error_type = "accessdenied"
      error = "This listing belongs to another user"
    }

    db.edit car_listings {
      field_name = "id"
      field_value = $input.id
      data = {
        updated_at   : "now"
        title        : $input.title
        brand        : $input.brand
        model        : $input.model
        year         : $input.year
        mileage      : $input.mileage
        fuel_type    : $input.fuel_type
        transmission : $input.transmission
        price        : $input.price
        city         : $input.city
        country      : $input.country
        seller_name  : $input.seller_name
        seller_phone : $input.seller_phone
        seller_email : $input.seller_email
        description  : $input.description
        status       : "draft"
      }
    } as $car

    conditional {
      if ($input.replace_photos == "true") {
        db.query car_listing_images {
          where = (($db.car_listing_images.car_listing_id == $input.id) && ($db.car_listing_images.is_deleted != true))
          return = {type: "list"}
        } as $old_images

        foreach ($old_images) {
          each as $old_image {
            db.edit car_listing_images {
              field_name = "id"
              field_value = $old_image.id
              data = {
                updated_at : "now"
                is_deleted: true
                deleted_at: "now"
                is_main   : false
                is_primary: false
              }
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
                db.edit car_listing_images {
                  field_name = "id"
                  field_value = $image_to_delete.id
                  data = {
                    updated_at : "now"
                    is_deleted: true
                    deleted_at: "now"
                    is_main   : false
                    is_primary: false
                  }
                } as $deleted_image
              }
            }
          }
        }
      }
    }

    db.query car_listing_images {
      where = (($db.car_listing_images.car_listing_id == $input.id) && ($db.car_listing_images.is_deleted != true))
      sort = {car_listing_images.sort_order: "asc"}
      return = {type: "list"}
    } as $existing_images

    var $sort_order {
      value = $existing_images|count
    }

    conditional {
      if ($input.r2_images != null && $input.r2_images != "") {
        var $r2_images {
          value = $input.r2_images|json_decode
        }

        foreach ($r2_images) {
          each as $r2_image {
            conditional {
              if ($sort_order < 8 && $r2_image.url != null && $r2_image.url != "") {
                db.add car_listing_images {
                  data = {
                    created_at       : "now"
                    updated_at       : "now"
                    car_listing_id   : $input.id
                    image_url        : $r2_image.url
                    image_key        : $r2_image.key
                    mime_type        : $r2_image.contentType
                    original_filename: $r2_image.key
                    size_bytes       : $r2_image.size
                    image_metadata   : $r2_image
                    sort_order       : $sort_order
                    is_main          : false
                    is_primary       : false
                    is_deleted       : false
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

    conditional {
      if ($input.new_image_urls != null && $input.new_image_urls != "" && ($input.r2_images == null || $input.r2_images == "")) {
        var $new_urls {
          value = $input.new_image_urls|json_decode
        }

        var $new_keys {
          value = []
        }

        conditional {
          if ($input.new_image_keys != null && $input.new_image_keys != "") {
            var.update $new_keys {
              value = $input.new_image_keys|json_decode
            }
          }
        }

        foreach ($new_urls) {
          each as $new_url {
            conditional {
              if ($sort_order < 8 && $new_url != null && $new_url != "") {
                var $image_key {
                  value = ""
                }

                conditional {
                  if ($new_keys.$index != null) {
                    var.update $image_key {
                      value = $new_keys.$index
                    }
                  }
                }

                var $image_metadata {
                  value = {
                    provider: "cloudflare_r2"
                    url: $new_url
                    key: $image_key
                  }
                }

                db.add car_listing_images {
                  data = {
                    created_at       : "now"
                    updated_at       : "now"
                    car_listing_id   : $input.id
                    image_url        : $new_url
                    image_key        : $image_key
                    mime_type        : ""
                    original_filename: $image_key
                    size_bytes       : 0
                    image_metadata   : $image_metadata
                    sort_order       : $sort_order
                    is_main          : false
                    is_primary       : false
                    is_deleted       : false
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

    conditional {
      if ($input.photos != null) {
        foreach ($input.photos) {
          each as $photo {
            conditional {
              if ($sort_order < 8) {
                storage.create_image {
                  access = "public"
                  value = $photo
                  filename = "car-listing-image.jpg"
                } as $uploaded_image

                var $xano_public_base_url {
                  value = "https://x8ki-letl-twmt.n7.xano.io"
                }

                conditional {
                  if ($env.XANO_PUBLIC_BASE_URL != null && $env.XANO_PUBLIC_BASE_URL != "") {
                    var.update $xano_public_base_url {
                      value = $env.XANO_PUBLIC_BASE_URL
                    }
                  }
                }

                var $uploaded_image_url {
                  value = $xano_public_base_url + $uploaded_image.path
                }

                var $uploaded_image_mime {
                  value = ""
                }

                conditional {
                  if ($uploaded_image.mime != null) {
                    var.update $uploaded_image_mime {
                      value = $uploaded_image.mime
                    }
                  }
                }

                var $uploaded_image_name {
                  value = "car-listing-image.jpg"
                }

                conditional {
                  if ($uploaded_image.name != null && $uploaded_image.name != "") {
                    var.update $uploaded_image_name {
                      value = $uploaded_image.name
                    }
                  }
                }

                var $uploaded_image_size {
                  value = 0
                }

                conditional {
                  if ($uploaded_image.size != null) {
                    var.update $uploaded_image_size {
                      value = $uploaded_image.size
                    }
                  }
                }

                db.add car_listing_images {
                  data = {
                    created_at       : "now"
                    updated_at       : "now"
                    car_listing_id   : $input.id
                    image_url        : $uploaded_image_url
                    mime_type        : $uploaded_image_mime
                    original_filename: $uploaded_image_name
                    size_bytes       : $uploaded_image_size
                    image_metadata   : $uploaded_image
                    sort_order       : $sort_order
                    is_main          : false
                    is_primary       : false
                    is_deleted       : false
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
      where = (($db.car_listing_images.car_listing_id == $input.id) && ($db.car_listing_images.is_deleted != true))
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
            updated_at : "now"
            sort_order : $new_sort_order
            is_main    : $new_sort_order == 0
            is_primary : $new_sort_order == 0
          }
        } as $image_updated

        var.update $new_sort_order {
          value = $new_sort_order + 1
        }
      }
    }

    db.query car_listing_images {
      where = (($db.car_listing_images.car_listing_id == $input.id) && ($db.car_listing_images.is_deleted != true))
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
        cover_image_url: $main_image_url
      }
    } as $car

    var $result {
      value = $car|set:"images":$images
    }
  }

  response = $result
}
