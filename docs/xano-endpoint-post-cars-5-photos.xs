query cars verb=POST {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    text title filters=trim
    text vehicle_type? filters=trim
    text brand filters=trim
    text model filters=trim
    text body_type? filters=trim
    text engine_volume? filters=trim
    text drivetrain? filters=trim
    int year
    int mileage
    text fuel_type filters=trim
    text transmission filters=trim
    decimal price
    text currency?="EUR" filters=trim|upper
    text city filters=trim
    text country?="Германия" filters=trim
    text seller_name? filters=trim
    text seller_phone? filters=trim
    email seller_email? filters=trim|lower
    int owner_count?
    text first_registration_date? filters=trim
    text description? filters=trim

    text main_image_url? filters=trim
    text cover_image_url? filters=trim
    text image_urls?
    text image_keys?
    text r2_images?

    file[] photos?
    file photo_1?
    file photo_2?
    file photo_3?
    file photo_4?
    file photo_5?
    file photo_6?
    file photo_7?
    file photo_8?
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }

    precondition (($input.seller_phone != null && $input.seller_phone != "") || ($input.seller_email != null && $input.seller_email != "")) {
      error_type = "inputerror"
      error = "Укажите телефон или email продавца."
    }

    precondition ($input.price >= 100 && $input.price <= 500000) {
      error_type = "inputerror"
      error = "Цена должна быть от 100 € до 500 000 €."
    }

    precondition ($input.year >= 1950 && $input.year <= now|format_timestamp:"Y") {
      error_type = "inputerror"
      error = "Проверьте год выпуска автомобиля."
    }

    precondition ($input.mileage >= 0) {
      error_type = "inputerror"
      error = "Пробег не может быть отрицательным."
    }

    var $timestamp {
      value = now|format_timestamp:"U"
    }

    var $slug {
      value = $input.brand|concat:" "|concat:$input.model|concat:" "|concat:$input.year|lower|replace:" ":"-"|concat:"-"|concat:$timestamp
    }

    var $initial_main_image_url {
      value = ""
    }

    conditional {
      if ($input.main_image_url != null && $input.main_image_url != "") {
        var.update $initial_main_image_url {
          value = $input.main_image_url
        }
      }
    }

    conditional {
      if ($initial_main_image_url == "" && $input.cover_image_url != null && $input.cover_image_url != "") {
        var.update $initial_main_image_url {
          value = $input.cover_image_url
        }
      }
    }

    db.add car_listings {
      data = {
        created_at             : "now"
        updated_at             : "now"
        user_id                : $auth.id
        slug                   : $slug
        title                  : $input.title
        vehicle_type           : $input.vehicle_type
        brand                  : $input.brand
        model                  : $input.model
        body_type              : $input.body_type
        engine_volume          : $input.engine_volume
        drivetrain             : $input.drivetrain
        year                   : $input.year
        mileage                : $input.mileage
        fuel_type              : $input.fuel_type
        transmission           : $input.transmission
        price                  : $input.price
        currency               : $input.currency
        city                   : $input.city
        country                : $input.country
        seller_name            : $input.seller_name
        seller_phone           : $input.seller_phone
        seller_email           : $input.seller_email
        owner_count            : $input.owner_count
        first_registration_date: $input.first_registration_date
        description            : $input.description
        status                 : "draft"
        moderation_status      : "draft"
        main_image_url         : $initial_main_image_url
        cover_image_url        : $initial_main_image_url
      }
    } as $car

    var $sort_order {
      value = 0
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
                    car_listing_id   : $car.id
                    image_url        : $r2_image.url
                    image_key        : $r2_image.key
                    mime_type        : $r2_image.contentType
                    original_filename: $r2_image.key
                    size_bytes       : $r2_image.size
                    image_metadata   : $r2_image
                    sort_order       : $sort_order
                    is_main          : $sort_order == 0
                    is_primary       : $sort_order == 0
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
      if ($sort_order == 0 && $input.image_urls != null && $input.image_urls != "") {
        var $image_urls {
          value = $input.image_urls|json_decode
        }

        var $image_keys {
          value = []
        }

        conditional {
          if ($input.image_keys != null && $input.image_keys != "") {
            var.update $image_keys {
              value = $input.image_keys|json_decode
            }
          }
        }

        foreach ($image_urls) {
          each as $image_url {
            conditional {
              if ($sort_order < 8 && $image_url != null && $image_url != "") {
                var $image_key {
                  value = ""
                }

                conditional {
                  if ($image_keys.$index != null) {
                    var.update $image_key {
                      value = $image_keys.$index
                    }
                  }
                }

                var $image_metadata {
                  value = {
                    provider: "cloudflare_r2"
                    url: $image_url
                    key: $image_key
                  }
                }

                db.add car_listing_images {
                  data = {
                    created_at       : "now"
                    updated_at       : "now"
                    car_listing_id   : $car.id
                    image_url        : $image_url
                    image_key        : $image_key
                    mime_type        : ""
                    original_filename: $image_key
                    size_bytes       : 0
                    image_metadata   : $image_metadata
                    sort_order       : $sort_order
                    is_main          : $sort_order == 0
                    is_primary       : $sort_order == 0
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

    conditional {
      if ($sort_order == 0 && $input.photo_1 != null) {
        storage.create_image {
          access = "public"
          value = $input.photo_1
          filename = "car-listing-image-1.jpg"
        } as $uploaded_image

        var $uploaded_image_url {
          value = $xano_public_base_url + $uploaded_image.path
        }

        db.add car_listing_images {
          data = {
            created_at       : "now"
            updated_at       : "now"
            car_listing_id   : $car.id
            image_url        : $uploaded_image_url
            mime_type        : $uploaded_image.mime
            original_filename: $uploaded_image.name
            size_bytes       : $uploaded_image.size
            image_metadata   : $uploaded_image
            sort_order       : $sort_order
            is_main          : true
            is_primary       : true
            is_deleted       : false
          }
        } as $image_row

        var.update $sort_order {
          value = $sort_order + 1
        }
      }
    }

    conditional {
      if ($sort_order < 8 && $input.photo_2 != null) {
        storage.create_image {
          access = "public"
          value = $input.photo_2
          filename = "car-listing-image-2.jpg"
        } as $uploaded_image

        var $uploaded_image_url {
          value = $xano_public_base_url + $uploaded_image.path
        }

        db.add car_listing_images {
          data = {
            created_at       : "now"
            updated_at       : "now"
            car_listing_id   : $car.id
            image_url        : $uploaded_image_url
            mime_type        : $uploaded_image.mime
            original_filename: $uploaded_image.name
            size_bytes       : $uploaded_image.size
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

    conditional {
      if ($sort_order < 8 && $input.photo_3 != null) {
        storage.create_image {
          access = "public"
          value = $input.photo_3
          filename = "car-listing-image-3.jpg"
        } as $uploaded_image

        var $uploaded_image_url {
          value = $xano_public_base_url + $uploaded_image.path
        }

        db.add car_listing_images {
          data = {
            created_at       : "now"
            updated_at       : "now"
            car_listing_id   : $car.id
            image_url        : $uploaded_image_url
            mime_type        : $uploaded_image.mime
            original_filename: $uploaded_image.name
            size_bytes       : $uploaded_image.size
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

    conditional {
      if ($sort_order < 8 && $input.photo_4 != null) {
        storage.create_image {
          access = "public"
          value = $input.photo_4
          filename = "car-listing-image-4.jpg"
        } as $uploaded_image

        var $uploaded_image_url {
          value = $xano_public_base_url + $uploaded_image.path
        }

        db.add car_listing_images {
          data = {
            created_at       : "now"
            updated_at       : "now"
            car_listing_id   : $car.id
            image_url        : $uploaded_image_url
            mime_type        : $uploaded_image.mime
            original_filename: $uploaded_image.name
            size_bytes       : $uploaded_image.size
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

    conditional {
      if ($sort_order < 8 && $input.photo_5 != null) {
        storage.create_image {
          access = "public"
          value = $input.photo_5
          filename = "car-listing-image-5.jpg"
        } as $uploaded_image

        var $uploaded_image_url {
          value = $xano_public_base_url + $uploaded_image.path
        }

        db.add car_listing_images {
          data = {
            created_at       : "now"
            updated_at       : "now"
            car_listing_id   : $car.id
            image_url        : $uploaded_image_url
            mime_type        : $uploaded_image.mime
            original_filename: $uploaded_image.name
            size_bytes       : $uploaded_image.size
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

    conditional {
      if ($sort_order == 0 && $input.photos != null) {
        foreach ($input.photos) {
          each as $photo {
            conditional {
              if ($sort_order < 8) {
                storage.create_image {
                  access = "public"
                  value = $photo
                  filename = "car-listing-image.jpg"
                } as $uploaded_image

                var $uploaded_image_url {
                  value = $xano_public_base_url + $uploaded_image.path
                }

                db.add car_listing_images {
                  data = {
                    created_at       : "now"
                    updated_at       : "now"
                    car_listing_id   : $car.id
                    image_url        : $uploaded_image_url
                    mime_type        : $uploaded_image.mime
                    original_filename: $uploaded_image.name
                    size_bytes       : $uploaded_image.size
                    image_metadata   : $uploaded_image
                    sort_order       : $sort_order
                    is_main          : $sort_order == 0
                    is_primary       : $sort_order == 0
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
      where = (($db.car_listing_images.car_listing_id == $car.id) && ($db.car_listing_images.is_deleted != true))
      sort = {car_listing_images.sort_order: "asc"}
      return = {type: "list"}
    } as $images

    var $main_image_url {
      value = $initial_main_image_url
    }

    conditional {
      if (($images|count) > 0 && $images.0.image_url != null && $images.0.image_url != "") {
        var.update $main_image_url {
          value = $images.0.image_url
        }
      }
    }

    db.edit car_listings {
      field_name = "id"
      field_value = $car.id
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
