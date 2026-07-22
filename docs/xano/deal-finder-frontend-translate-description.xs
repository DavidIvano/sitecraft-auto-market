// POST /deal-finder/listings/{id}/translate-description
// Installation status: blueprint only. No provider call is present here.
query "deal-finder/listings/{id}/translate-description" verb=POST {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    int id filters=min:1
    text target_language filters=trim|lower|max:10
  }

  stack {
    precondition ($auth.id != null) { error_type = "accessdenied" error = "Unauthorized" }
    db.get automarket_users { field_name = "id" field_value = $auth.id } as $current_user
    precondition (($current_user != null) && (($current_user.role == "admin") || ($current_user.role == "deal_finder_admin"))) {
      error_type = "accessdenied"
      error = "Deal Finder access required"
    }
    precondition ($input.target_language == "ru") {
      error_type = "inputerror"
      error = "Unsupported target language"
    }

    db.query deal_finder_listings {
      where = (($db.deal_finder_listings.id == $input.id) && ($db.deal_finder_listings.user_id == $current_user.id))
      return = {type: "single"}
    } as $listing
    precondition ($listing != null) { error_type = "notfound" error = "Listing not found" }
    precondition (($listing.description != null) && (($listing.description|trim) != "")) {
      error_type = "inputerror"
      error = "Description required"
    }

    // Use Xano's server-side SHA-256 filter/function when installing. Never
    // accept the description or hash from the browser.
    var $source_text_hash { value = $listing.description|sha256 }
    db.query deal_finder_listing_translations {
      where = (($db.deal_finder_listing_translations.user_id == $current_user.id) && ($db.deal_finder_listing_translations.listing_id == $listing.id) && ($db.deal_finder_listing_translations.target_language == "ru") && ($db.deal_finder_listing_translations.source_text_hash == $source_text_hash) && ($db.deal_finder_listing_translations.status == "completed"))
      sort = {deal_finder_listing_translations.completed_at: "desc"}
      return = {type: "single"}
    } as $completed
    db.query deal_finder_listing_translations {
      where = (($db.deal_finder_listing_translations.user_id == $current_user.id) && ($db.deal_finder_listing_translations.listing_id == $listing.id) && ($db.deal_finder_listing_translations.target_language == "ru") && ($db.deal_finder_listing_translations.source_text_hash == $source_text_hash) && (($db.deal_finder_listing_translations.status == "pending") || ($db.deal_finder_listing_translations.status == "processing")))
      sort = {deal_finder_listing_translations.created_at: "desc"}
      return = {type: "single"}
    } as $active

    var $translation { value = $completed }
    var $cached { value = ($completed != null) }
    conditional {
      if (($translation == null) && ($active != null)) {
        var.update $translation { value = $active }
      }
      elseif ($translation == null) {
        // Before creation, install an update-many step that marks completed
        // rows for the same owner/listing/language and another hash as stale.
        db.add deal_finder_listing_translations {
          data = {
            user_id: $current_user.id
            listing_id: $listing.id
            source_language: "de"
            target_language: "ru"
            source_text_hash: $source_text_hash
            translated_text: null
            status: "pending"
            provider: null
            model: null
            completed_at: null
            failed_at: null
            error_code: null
          }
        } as $translation
      }
    }
  }

  response = {
    translation: {
      id: $translation.id
      listing_id: $translation.listing_id
      source_language: $translation.source_language
      target_language: $translation.target_language
      status: $translation.status
      translated_text: $translation.translated_text
      completed_at: $translation.completed_at
      cached: $cached
    }
  }
  tags = ["deal-finder", "frontend", "owner-only", "translation", "queue-only"]
}
