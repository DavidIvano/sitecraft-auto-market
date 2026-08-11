query "translations/internal/sources/{id}" verb=POST {
  api_group = "sitecraft-auto-market"
  input {
    int id filters=min:1
  }
  stack {
    var $provided_secret { value = $env.$http_headers."X-Translation-Worker-Secret"|first_notnull:""|to_text }
    precondition (($provided_secret != "") && ($provided_secret == "__TRANSLATION_WORKER_SECRET_RAW__")) {
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
    var $source_locale { value = $car.source_locale|first_notnull:"ru"|trim }
    var $source_document {
      value = {
        title: ("/\\r\\n?/"|regex_replace:"\n":$car.title)|trim
        description: ("/\\r\\n?/"|regex_replace:"\n":$car.description)|trim
        seo_title: null
        seo_description: null
        image_alt_texts: null
        search_keywords: null
        source_locale: $source_locale
        schema_version: "listing-i18n-v1"
      }
    }
    var $source_hash { value = $source_document|json_encode|sha256:false }
  }
  response = {listing_id: $car.id, public: ($car.status == "approved"), source_locale: $source_locale, source_hash: $source_hash, stored_source_hash: $car.translation_source_hash, hash_matches: ($source_hash == $car.translation_source_hash)}
  tags = ["translations", "internal", "worker", "source", "read-only"]
}
