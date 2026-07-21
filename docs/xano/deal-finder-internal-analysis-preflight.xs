query "deal-finder/internal/analyses/{id}/preflight" verb=GET {
  api_group = "sitecraft-auto-market"
  input {
    int id filters=min:1
  }
  stack {
    var $provided_secret { value = $env.$http_headers."X-Deal-Finder-Secret"|first_notnull:""|to_text }
    precondition (($provided_secret != "") && ($provided_secret == "__DEAL_FINDER_SECRET_RAW__")) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }
    db.get deal_finder_listings {
      field_name = "id"
      field_value = $input.id
    } as $listing
    precondition ($listing != null) {
      error_type = "notfound"
      error = "Listing not found"
    }
    var $analysis_version { value = "deal-finder-v1" }
    db.query deal_finder_analyses {
      where = (($db.deal_finder_analyses.listing_id == $listing.id) && ($db.deal_finder_analyses.input_hash == $listing.content_hash) && ($db.deal_finder_analyses.analysis_version == $analysis_version) && (($db.deal_finder_analyses.status == "pending") || ($db.deal_finder_analyses.status == "processing")))
      return = {type: "exists"}
    } as $active_same_hash
    db.query deal_finder_analyses {
      where = (($db.deal_finder_analyses.listing_id == $listing.id) && ($db.deal_finder_analyses.input_hash == $listing.content_hash) && ($db.deal_finder_analyses.analysis_version == $analysis_version) && ($db.deal_finder_analyses.status == "completed"))
      return = {type: "exists"}
    } as $completed_same_hash
  }
  response = {
    listing_id: $listing.id
    source_active: ($listing.source_status == "active")
    detail_data: ($listing.data_level == "detail")
    provider_detail_loaded: ($listing.provider_detail_loaded == true)
    content_hash_present: (($listing.content_hash != null) && ($listing.content_hash != ""))
    title_present: (($listing.title != null) && ($listing.title != ""))
    first_seen_at_present: ($listing.first_seen_at != null)
    active_same_hash: $active_same_hash
    completed_same_hash: $completed_same_hash
  }
  tags = ["deal-finder", "internal", "worker", "analysis-preflight"]
}
