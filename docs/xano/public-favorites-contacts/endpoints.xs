// Production endpoint scripts for workspace 115940, live branch v1.\n\n// Source: sitecraft_auto_market/favorites_GET.xs\nquery favorites verb=GET {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    int page?=1 filters=min:1
    int per_page?=24 filters=min:1|max:100
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "UNAUTHORIZED"
    }

    db.query car_listing_favorites {
      where = ($db.car_listing_favorites.user_id == $auth.id)
      sort = {car_listing_favorites.created_at: "desc"}
      return = {type: "list", paging: {page: $input.page, per_page: $input.per_page, totals: true, metadata: true}}
    } as $favorites

    var $listing_ids { value = [] }
    foreach ($favorites.items) {
      each as $favorite {
        array.push $listing_ids { value = $favorite.car_listing_id }
      }
    }
    var.update $listing_ids { value = $listing_ids|unique }

    db.query car_listings {
      where = (($db.car_listings.id in $listing_ids) && (($db.car_listings.status == "approved") || ($db.car_listings.status == "published") || ($db.car_listings.moderation_status == "approved") || ($db.car_listings.moderation_status == "published")) && (($db.car_listings.status == null) || (($db.car_listings.status != "draft") && ($db.car_listings.status != "ai_draft") && ($db.car_listings.status != "pending_review") && ($db.car_listings.status != "needs_fix") && ($db.car_listings.status != "rejected") && ($db.car_listings.status != "blocked") && ($db.car_listings.status != "deleted") && ($db.car_listings.status != "archived") && ($db.car_listings.status != "sold"))) && (($db.car_listings.moderation_status == null) || (($db.car_listings.moderation_status != "draft") && ($db.car_listings.moderation_status != "ai_draft") && ($db.car_listings.moderation_status != "pending_review") && ($db.car_listings.moderation_status != "needs_fix") && ($db.car_listings.moderation_status != "rejected") && ($db.car_listings.moderation_status != "blocked") && ($db.car_listings.moderation_status != "deleted") && ($db.car_listings.moderation_status != "archived") && ($db.car_listings.moderation_status != "sold"))))
      return = {type: "list"}
    } as $listings

    var $items { value = [] }
    foreach ($favorites.items) {
      each as $favorite {
        foreach ($listings) {
          each as $listing {
            conditional {
              if ($listing.id == $favorite.car_listing_id) {
                array.push $items {
                  value = {
                    id: $listing.id, slug: $listing.slug, title: $listing.title,
                    brand: $listing.brand, model: $listing.model, year: $listing.year,
                    mileage: $listing.mileage, fuel_type: $listing.fuel_type,
                    transmission: $listing.transmission, price: $listing.price,
                    currency: $listing.currency, city: $listing.city, country: $listing.country,
                    body_type: $listing.body_type, vehicle_type: $listing.vehicle_type,
                    main_image_url: $listing.main_image_url, cover_image_url: $listing.cover_image_url,
                    image_urls: $listing.image_urls, images: $listing.images,
                    status: $listing.status, moderation_status: $listing.moderation_status,
                    published_at: $listing.published_at, created_at: $listing.created_at,
                    is_saved: true, saved_at: $favorite.created_at
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  response = {items: $items, total: ($items|count), page: $favorites.curPage, per_page: $favorites.perPage}
  tags = ["favorites", "owner-only", "public-projection"]
  guid = "yxeL_xEq6d0bSRGvBjvtuZ7Z3r4"
}\n\n// Source: favorites/status_POST.xs\nquery "favorites/status" verb=POST {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input { int[] listing_ids }

  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "UNAUTHORIZED"
    }
    precondition (($input.listing_ids|count) <= 100) {
      error_type = "inputerror"
      error = "INVALID_LISTING_IDS"
    }

    var $normalized_ids { value = [] }
    foreach ($input.listing_ids) {
      each as $listing_id {
        precondition ($listing_id > 0) {
          error_type = "inputerror"
          error = "INVALID_LISTING_IDS"
        }
        array.push $normalized_ids { value = $listing_id }
      }
    }
    var.update $normalized_ids { value = $normalized_ids|unique }

    db.query car_listing_favorites {
      where = (($db.car_listing_favorites.user_id == $auth.id) && ($db.car_listing_favorites.car_listing_id in $normalized_ids))
      return = {type: "list"}
    } as $favorites

    var $saved_listing_ids { value = [] }
    foreach ($favorites) {
      each as $favorite {
        array.push $saved_listing_ids { value = $favorite.car_listing_id }
      }
    }
    var.update $saved_listing_ids { value = $saved_listing_ids|unique }

    var $items { value = [] }
    foreach ($normalized_ids) {
      each as $listing_id {
        var $is_saved { value = false }
        foreach ($saved_listing_ids) {
          each as $saved_listing_id {
            conditional {
              if ($saved_listing_id == $listing_id) {
                var.update $is_saved { value = true }
              }
            }
          }
        }
        array.push $items { value = {listing_id: $listing_id, is_saved: $is_saved} }
      }
    }
  }

  response = {items: $items, saved_listing_ids: $saved_listing_ids}
  tags = ["favorites", "owner-only", "batch"]
  guid = "xwi0JHC8HCvOjX0vPv1cbXPVbfE"
}\n\n// Source: favorites/listing_id_POST.xs\nquery "favorites/{listing_id}" verb=POST {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input { int listing_id filters=min:1 }

  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "UNAUTHORIZED"
    }
    db.get car_listings {
      field_name = "id"
      field_value = $input.listing_id
    } as $listing
    precondition (($listing != null) && (($listing.status == "approved") || ($listing.status == "published") || ($listing.moderation_status == "approved") || ($listing.moderation_status == "published")) && ($listing.status != "blocked") && ($listing.status != "deleted") && ($listing.status != "archived") && ($listing.status != "sold") && ($listing.moderation_status != "blocked") && ($listing.moderation_status != "deleted") && ($listing.moderation_status != "archived") && ($listing.moderation_status != "sold")) {
      error_type = "notfound"
      error = "LISTING_NOT_FOUND"
    }

    db.query car_listing_favorites {
      where = (($db.car_listing_favorites.user_id == $auth.id) && ($db.car_listing_favorites.car_listing_id == $listing.id))
      return = {type: "single"}
    } as $existing

    conditional {
      if ($existing == null) {
        try_catch {
          try {
            db.add car_listing_favorites { data = {created_at: now, user_id: $auth.id, car_listing_id: $listing.id} } as $favorite
          }
          catch {
            db.query car_listing_favorites {
              where = (($db.car_listing_favorites.user_id == $auth.id) && ($db.car_listing_favorites.car_listing_id == $listing.id))
              return = {type: "single"}
            } as $favorite
          }
        }
      }
      else {
        var $favorite { value = $existing }
      }
    }
  }

  response = {is_saved: true, favorite_id: $favorite.id, saved_at: $favorite.created_at}
  tags = ["favorites", "owner-only", "idempotent"]
  guid = "sfpXdIz_2sFQYsU9uizp57QVtdI"
}\n\n// Source: favorites/listing_id_DELETE.xs\nquery "favorites/{listing_id}" verb=DELETE {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input { int listing_id filters=min:1 }

  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "UNAUTHORIZED"
    }
    db.query car_listing_favorites {
      where = (($db.car_listing_favorites.user_id == $auth.id) && ($db.car_listing_favorites.car_listing_id == $input.listing_id))
      return = {type: "single"}
    } as $favorite
    conditional {
      if ($favorite != null) {
        db.del car_listing_favorites {
          field_name = "id"
          field_value = $favorite.id
        }
      }
    }
  }

  response = {is_saved: false}
  tags = ["favorites", "owner-only", "idempotent"]
  guid = "jOUE0EuuGF-J8smS6JtGP9GJsRU"
}\n\n// Source: me/contact_profile_GET.xs\nquery "me/contact-profile" verb=GET {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "UNAUTHORIZED"
    }
    db.get automarket_users {
      field_name = "id"
      field_value = $auth.id
    } as $user
    precondition ($user != null) {
      error_type = "notfound"
      error = "USER_NOT_FOUND"
    }
  }

  response = {first_name: $user.first_name, last_name: $user.last_name, display_name: $user.display_name, contact_phone: $user.contact_phone, contact_email: $user.contact_email, show_phone: ($user.show_phone == true), show_email: ($user.show_email == true), preferred_contact_method: $user.preferred_contact_method}
  tags = ["contacts", "owner-only"]
  guid = "l7J-e1KD1fJg96OQ1r_Cm_9GwzA"
}\n\n// Source: me/contact_profile_PATCH.xs\nquery "me/contact-profile" verb=PATCH {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    text first_name? filters=trim
    text last_name? filters=trim
    text display_name? filters=trim
    text contact_phone? filters=trim
    email contact_email? filters=trim|lower
    bool show_phone?
    bool show_email?
    enum preferred_contact_method? {
      values = ["phone", "email"]
    }
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "UNAUTHORIZED"
    }
    db.get automarket_users {
      field_name = "id"
      field_value = $auth.id
    } as $current
    precondition ($current != null) {
      error_type = "notfound"
      error = "USER_NOT_FOUND"
    }
    precondition (($input.first_name == null) || (($input.first_name|strlen) <= 80)) {
      error_type = "inputerror"
      error = "FIRST_NAME_TOO_LONG"
    }
    precondition (($input.last_name == null) || (($input.last_name|strlen) <= 80)) {
      error_type = "inputerror"
      error = "LAST_NAME_TOO_LONG"
    }
    precondition (($input.display_name == null) || (($input.display_name|strlen) <= 120)) {
      error_type = "inputerror"
      error = "DISPLAY_NAME_TOO_LONG"
    }
    precondition (($input.contact_phone == null) || (($input.contact_phone|strlen) <= 32)) {
      error_type = "inputerror"
      error = "PHONE_TOO_LONG"
    }
    precondition (($input.contact_email == null) || (($input.contact_email|strlen) <= 254)) {
      error_type = "inputerror"
      error = "EMAIL_TOO_LONG"
    }

    var $next_first_name { value = $input.first_name|first_notnull:$current.first_name }
    var $next_last_name { value = $input.last_name|first_notnull:$current.last_name }
    var $next_display_name { value = $input.display_name|first_notnull:$current.display_name }
    var $next_phone { value = $input.contact_phone|first_notnull:$current.contact_phone }
    var $next_email { value = $input.contact_email|first_notnull:$current.contact_email }
    var $next_method { value = $input.preferred_contact_method|first_notnull:$current.preferred_contact_method }

    conditional { if (($next_first_name|first_notnull:""|trim) == "") { var.update $next_first_name { value = null } } }
    conditional { if (($next_last_name|first_notnull:""|trim) == "") { var.update $next_last_name { value = null } } }
    conditional { if (($next_display_name|first_notnull:""|trim) == "") { var.update $next_display_name { value = null } } }
    conditional { if (($next_phone|first_notnull:""|trim) == "") { var.update $next_phone { value = null } } }
    conditional { if (($next_email|first_notnull:""|trim) == "") { var.update $next_email { value = null } } }
    conditional { if (($next_method|first_notnull:""|trim) == "") { var.update $next_method { value = null } } }

    var $next_show_phone { value = $input.show_phone|first_notnull:$current.show_phone|first_notnull:false }
    var $next_show_email { value = $input.show_email|first_notnull:$current.show_email|first_notnull:false }

    precondition (($next_phone == null) || ($next_phone|regex_matches:"^\\+[1-9][0-9]{7,14}$")) {

      error_type = "inputerror"

      error = "INVALID_PHONE"

    }
    precondition (($next_show_phone != true) || ($next_phone != null)) {
      error_type = "inputerror"
      error = "PHONE_REQUIRED"
    }
    precondition (($next_show_email != true) || ($next_email != null)) {
      error_type = "inputerror"
      error = "EMAIL_REQUIRED"
    }

    db.edit automarket_users {
      field_name = "id"
      field_value = $auth.id
      data = {
        first_name: $next_first_name
        last_name: $next_last_name
        display_name: $next_display_name
        contact_phone: $next_phone
        contact_email: $next_email
        show_phone: $next_show_phone
        show_email: $next_show_email
        preferred_contact_method: $next_method
      }
    } as $user
  }

  response = {first_name: $user.first_name, last_name: $user.last_name, display_name: $user.display_name, contact_phone: $user.contact_phone, contact_email: $user.contact_email, show_phone: ($user.show_phone == true), show_email: ($user.show_email == true), preferred_contact_method: $user.preferred_contact_method}
  tags = ["contacts", "owner-only", "whitelist"]
  guid = "hVtI2MMwQcAxy6tQq26VlrxCosk"
}\n
