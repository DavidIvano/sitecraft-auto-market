query "dashboard/listings/{id}" verb=PATCH {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    int id
    text source_locale? filters=trim|max:35
    text title filters=trim
    text brand filters=trim
    text model filters=trim
    int year
    int mileage
    text fuel_type filters=trim
    text transmission filters=trim
    text vehicle_type? filters=trim
    text body_type? filters=trim
    text engine_volume? filters=trim
    text drivetrain? filters=trim
    text color? filters=trim
    text first_registration? filters=trim
    text first_registration_date? filters=trim
    int owners_count?
    int owner_count?
    text vin? filters=trim
    text doors? filters=trim
    text seats? filters=trim
    text seller_type? filters=trim
    text condition? filters=trim
    text vehicle_condition? filters=trim
    bool has_valid_tuv?
    text tuv_valid_until? filters=trim
    decimal price
    text currency?=EUR filters=trim|upper
    text city filters=trim
    text country?="Германия" filters=trim
    text seller_name? filters=trim
    text seller_phone? filters=trim
    email? seller_email filters=trim|lower
    text description? filters=trim
    text replace_photos? filters=trim
    text delete_image_ids? filters=trim
    text r2_images? filters=trim
    text new_image_urls? filters=trim
    text image_urls? filters=trim
    text image_keys? filters=trim
    file[]? photos?
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

    db.get automarket_users {
      field_name = "id"
      field_value = $auth.id
    } as $auth_user

    precondition ($auth_user != null) {
      error_type = "unauthorized"
      error = "Unauthorized"
    }

    var $source_locale {
      value = $input.source_locale
        |first_notnull:$car.source_locale
        |first_notnull:$auth_user.preferred_locale
        |first_notnull:"de"
        |to_text
        |trim
    }

    db.query locales {
      where = (($db.locales.code == $source_locale) && ($db.locales.is_active == true))
      return = {type: "single"}
    } as $source_locale_record

    precondition ($source_locale_record != null) {
      error_type = "inputerror"
      error = "UNSUPPORTED_SOURCE_LOCALE"
    }

    var $normalized_tuv_valid_until {
      value = null
    }

    conditional {
      if ($input.has_valid_tuv) {
        precondition ("/^\\d{4}-(0[1-9]|1[0-2])$/"|regex_matches:($input.tuv_valid_until|first_notnull:"")) {
          error_type = "inputerror"
          error = "TUV_DATE_REQUIRED"
        }

        var.update $normalized_tuv_valid_until {
          value = $input.tuv_valid_until
        }
      }
    }

    db.edit car_listings {
      field_name = "id"
      field_value = $input.id
      data = {
        updated_at             : "now"
        title                  : $input.title
        brand                  : $input.brand
        model                  : $input.model
        year                   : $input.year
        mileage                : $input.mileage
        fuel_type              : $input.fuel_type
        transmission           : $input.transmission
        vehicle_type           : $input.vehicle_type
        body_type              : $input.body_type
        engine_volume          : $input.engine_volume
        drivetrain             : $input.drivetrain
        color                  : $input.color
        first_registration     : $input.first_registration
        first_registration_date: $input.first_registration_date
        owners_count           : $input.owners_count
        owner_count            : $input.owner_count
        vin                    : $input.vin
        doors                  : $input.doors
        seats                  : $input.seats
        seller_type            : $input.seller_type
        condition              : $input.condition
        vehicle_condition      : $input.vehicle_condition|first_notnull:$input.condition
        has_valid_tuv          : $input.has_valid_tuv
        tuv_valid_until        : $normalized_tuv_valid_until
        price                  : $input.price
        currency               : $input.currency
        city                   : $input.city
        country                : $input.country
        seller_name            : $input.seller_name
        seller_phone           : $input.seller_phone
        seller_email           : $input.seller_email
        description            : $input.description
        status                 : "draft"
      }
    } as $car

    var $translation_source_document {
      value = {
        title          : ("/\\r\\n?/"|regex_replace:"\n":$input.title)|trim
        description    : ("/\\r\\n?/"|regex_replace:"\n":($input.description|first_notnull:""))|trim
        seo_title      : null
        seo_description: null
        image_alt_texts: null
        search_keywords: null
        source_locale  : $source_locale|trim
        schema_version : "listing-i18n-v1"
      }
    }

    var $translation_source_hash {
      value = $translation_source_document|json_encode|sha256:false
    }

    conditional {
      if (($car.translation_source_hash|first_notnull:"") != $translation_source_hash) {
        var $translation_version {
          value = 1
        }

        conditional {
          if (($car.translation_source_hash|first_notnull:"") != "") {
            var.update $translation_version {
              value = ($car.translation_version|first_notnull:0) + 1
            }
          }
        }

    db.edit car_listings {
      field_name = "id"
      field_value = $input.id
      data = {
        updated_at             : "now"
        source_locale          : $source_locale
        translation_source_hash: $translation_source_hash
        translation_version   : $translation_version
        translations_ready    : false
        translation_updated_at: "now"
      }
    } as $car

    db.query car_listing_translations {
      where = (($db.car_listing_translations.car_listing_id == $car.id) && ($db.car_listing_translations.locale_code != $source_locale))
      return = {type: "list"}
    } as $other_translations

    foreach ($other_translations) {
      each as $other_translation {
        conditional {
          if ($other_translation.source_hash != $translation_source_hash) {
            db.edit car_listing_translations {
              field_name = "id"
              field_value = $other_translation.id
              data = {updated_at: "now", translation_status: "outdated"}
            } as $outdated_translation
          }
        }
      }
    }

    db.query car_listing_translations {
      where = (($db.car_listing_translations.car_listing_id == $car.id) && ($db.car_listing_translations.locale_code == $source_locale))
      return = {type: "single"}
    } as $original_translation

    conditional {
      if ($original_translation == null) {
        db.add car_listing_translations {
          data = {
            created_at              : "now"
            updated_at              : "now"
            car_listing_id          : $car.id
            locale_code             : $source_locale
            title                   : $input.title
            description             : $input.description|first_notnull:""
            translation_status      : "original"
            translation_source      : "original"
            source_locale           : $source_locale
            source_hash             : $translation_source_hash
          }
        } as $created_original_translation
      }

      else {
        db.edit car_listing_translations {
          field_name = "id"
          field_value = $original_translation.id
          data = {
            updated_at        : "now"
            title             : $input.title
            description       : $input.description|first_notnull:""
            translation_status: "original"
            translation_source: "original"
            source_locale     : $source_locale
            source_hash       : $translation_source_hash
          }
        } as $updated_original_translation
      }
    }

    db.query locales {
      where = (($db.locales.is_active == true) && ($db.locales.code != $source_locale))
      sort = {locales.sort_order: "asc"}
      return = {type: "list"}
    } as $target_locales

    foreach ($target_locales) {
      each as $target_locale {
        db.query translation_jobs {
          where = (($db.translation_jobs.entity_type == "car_listing") && ($db.translation_jobs.entity_id == $car.id) && ($db.translation_jobs.target_locale == $target_locale.code) && ($db.translation_jobs.source_hash != $translation_source_hash) && (($db.translation_jobs.status == "pending") || ($db.translation_jobs.status == "processing")))
          return = {type: "list"}
        } as $stale_translation_jobs

        foreach ($stale_translation_jobs) {
          each as $stale_translation_job {
            db.edit translation_jobs {
              field_name = "id"
              field_value = $stale_translation_job.id
              data = {updated_at: "now", status: "outdated"}
            } as $outdated_translation_job
          }
        }

        var $translation_job_key {
          value = "car_listing:"
            |concat:$car.id
            |concat:":"
            |concat:$target_locale.code
            |concat:":"
            |concat:$translation_source_hash
        }

        db.query translation_jobs {
          where = ($db.translation_jobs.idempotency_key == $translation_job_key)
          return = {type: "single"}
        } as $existing_translation_job

        conditional {
          if ($existing_translation_job == null) {
            db.add translation_jobs {
              data = {
                created_at     : "now"
                updated_at     : "now"
                entity_type    : "car_listing"
                entity_id      : $car.id
                source_locale  : $source_locale
                target_locale  : $target_locale.code
                source_hash    : $translation_source_hash
                idempotency_key: $translation_job_key
                status         : "pending"
                priority       : 0
                attempt_count  : 0
                max_attempts   : 3
              }
            } as $created_translation_job
          }
        }
      }
    }
      }
    }

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
              data = {updated_at: "now", is_deleted: true, is_main: false}
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
                  data = {updated_at: "now", is_deleted: true, is_main: false}
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

    var $r2_images {
      value = []
    }

    conditional {
      if (($input.r2_images != null) && ($input.r2_images != "")) {
        var.update $r2_images {
          value = $input.r2_images|json_decode
        }
      }
    }

    foreach ($r2_images) {
      each as $r2_image {
        conditional {
          if (($sort_order < 5) && ($r2_image.url != null) && ($r2_image.url != "")) {
            db.add car_listing_images {
              data = {
                created_at       : "now"
                updated_at       : "now"
                car_listing_id   : $input.id
                image_url        : $r2_image.url
                sort_order       : $sort_order
                is_main          : false
                is_primary       : false
                mime_type        : $r2_image.contentType
                original_filename: $r2_image.key
                size_bytes       : $r2_image.size
                image_metadata   : $r2_image
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

    conditional {
      if (($sort_order < 5) && ($input.new_image_urls != null) && ($input.new_image_urls != "") && (($input.r2_images == null) || ($input.r2_images == ""))) {
        var $new_image_urls {
          value = $input.new_image_urls|json_decode
        }

        foreach ($new_image_urls) {
          each as $new_image_url {
            conditional {
              if (($sort_order < 5) && ($new_image_url != null) && ($new_image_url != "")) {
                db.add car_listing_images {
                  data = {
                    created_at    : "now"
                    updated_at    : "now"
                    car_listing_id: $input.id
                    image_url     : $new_image_url
                    sort_order    : $sort_order
                    is_main       : false
                    is_primary    : false
                    image_metadata: {url: $new_image_url, provider: "cloudflare_r2"}
                    is_deleted    : false
                  }
                } as $image_url_row

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
      value = $env.XANO_PUBLIC_BASE_URL
    }

    conditional {
      if (($xano_public_base_url == null) || ($xano_public_base_url == "")) {
        var.update $xano_public_base_url {
          value = "https://x8ki-letl-twmt.n7.xano.io"
        }
      }
    }

    conditional {
      if ($input.photos != null) {
        foreach ($input.photos) {
          each as $photo {
            conditional {
              if ($sort_order < 5) {
                storage.create_image {
                  value = $photo
                  access = "public"
                  filename = "car-listing-image.jpg"
                } as $image_metadata

                var $uploaded_image_url {
                  value = $xano_public_base_url|concat:$image_metadata.path
                }

                db.add car_listing_images {
                  data = {
                    created_at       : "now"
                    updated_at       : "now"
                    car_listing_id   : $input.id
                    image_url        : $uploaded_image_url
                    sort_order       : $sort_order
                    is_main          : false
                    is_primary       : false
                    mime_type        : $image_metadata.mime
                    original_filename: $image_metadata.name
                    size_bytes       : $image_metadata.size
                    image_metadata   : $image_metadata
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
            sort_order: $new_sort_order
            is_main   : $new_sort_order == 0
            is_primary: $new_sort_order == 0
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
          value = $images[0].image_url
        }
      }
    }

    db.edit car_listings {
      field_name = "id"
      field_value = $input.id
      data = {updated_at: "now", main_image_url: $main_image_url}
    } as $car

    var $result {
      value = $car|set:"images":$images
    }
  }

  response = $result
}
