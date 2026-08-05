// Endpoint: GET /admin/listings/{id}/translations
// Read-only Release 2 view for inspecting one listing's source, translations and queue.
query "admin/listings/{id}/translations" verb=GET {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    int id
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "unauthorized"
      error = "Unauthorized"
    }
  
    db.get automarket_users {
      field_name = "id"
      field_value = $auth.id
    } as $current_user
  
    precondition (($current_user != null) && ($current_user.id == $auth.id) && ($current_user.role == "admin")) {
      error_type = "accessdenied"
      error = "Forbidden"
    }
  
    db.get car_listings {
      field_name = "id"
      field_value = $input.id
    } as $listing
  
    precondition ($listing != null) {
      error_type = "notfound"
      error = "Listing not found"
    }
  
    db.query car_listing_translations {
      where = ($db.car_listing_translations.car_listing_id == $listing.id)
      sort = {car_listing_translations.locale_code: "asc"}
      return = {type: "list"}
    } as $translations
  
    db.query translation_jobs {
      where = (($db.translation_jobs.entity_type == "car_listing") && ($db.translation_jobs.entity_id == $listing.id))
      sort = {translation_jobs.created_at: "desc"}
      return = {type: "list"}
    } as $jobs
  }

  response = {
    listing     : ```
      {
        id                     : $listing.id
        title                  : $listing.title
        source_locale          : $listing.source_locale
        translation_source_hash: $listing.translation_source_hash
        translation_version    : $listing.translation_version
        translations_ready     : $listing.translations_ready
        translation_updated_at : $listing.translation_updated_at
      }
      ```
    translations: $translations
    jobs        : $jobs
  }

  tags = [
    "sitecraft-auto-market"
    "admin"
    "i18n"
    "translations"
    "release-2"
  ]
}
