// Canonical, isolated Deal Finder schema blueprint. None of these tables
// relate to or mutate the public car_listings table.
table deal_finder_emails {
  auth = false
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    text gmail_message_id filters=trim
    text? gmail_thread_id
    text? sender
    text? recipient
    text? subject
    timestamp? received_at
    text? body_html
    text? body_text
    text processing_status?=pending filters=trim|lower
    text? processing_error
    text? content_hash
    json links_found?
    json images_found?
    timestamp? processed_at
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree|unique", field: [{name: "gmail_message_id", op: "asc"}]}
    {type: "btree", field: [{name: "processing_status", op: "asc"}]}
    {type: "btree", field: [{name: "received_at", op: "desc"}]}
    {type: "btree", field: [{name: "content_hash", op: "asc"}]}
  ]
  tags = ["deal-finder", "internal", "email"]
}

table deal_finder_sync_logs {
  auth = false
  schema {
    int id
    timestamp created_at?=now
    text job_type filters=trim|lower
    text status filters=trim|lower
    int emails_found?=0
    int emails_processed?=0
    int listings_found?=0
    int listings_created?=0
    int listings_updated?=0
    int duplicates_found?=0
    int listings_removed?=0
    text? error_message
    json? metadata
    timestamp? started_at
    timestamp? finished_at
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "job_type", op: "asc"}]}
    {type: "btree", field: [{name: "status", op: "asc"}]}
    {type: "btree", field: [{name: "created_at", op: "desc"}]}
  ]
  tags = ["deal-finder", "internal", "sync"]
}

table deal_finder_searches {
  auth = false
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    int user_id { table = "automarket_users" }
    text name filters=trim
    text platform?=kleinanzeigen filters=trim|lower
    text source_type?=kleinanzeigen_agent filters=trim|lower
    json? source_config
    text? email_subject_pattern
    text? search_url
    text? brand
    text? model
    decimal? price_min
    decimal? price_max
    int? year_min
    int? year_max
    int? mileage_min
    int? mileage_max
    json fuel_types?
    json transmissions?
    text? postal_code
    text? location_id
    text? location_name
    text? category_id
    int? radius_km
    json required_keywords?
    json excluded_keywords?
    int minimum_deal_score?=70
    bool picture_required?
    json seller_types?
    bool sync_enabled?
    int? sync_interval_minutes
    timestamp? last_sync_at
    timestamp? next_sync_at
    text? last_sync_status
    text? last_sync_error
    bool is_active?=true
    timestamp? last_email_at
    timestamp? last_listing_at
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "user_id", op: "asc"}]}
    {type: "btree", field: [{name: "is_active", op: "asc"}]}
    {type: "btree", field: [{name: "platform", op: "asc"}]}
    {type: "btree", field: [{name: "source_type", op: "asc"}]}
    {type: "btree", field: [{name: "sync_enabled", op: "asc"}]}
  ]
  tags = ["deal-finder", "internal", "search"]
}

table deal_finder_listings {
  auth = false
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    int user_id { table = "automarket_users" }
    int? search_id { table = "deal_finder_searches" }
    int? email_id { table = "deal_finder_emails" }
    text platform?=kleinanzeigen filters=trim|lower
    text external_id filters=trim
    text source_url filters=trim
    text title filters=trim
    text? description
    decimal? price
    text currency?=EUR filters=trim|upper
    text? brand
    text? model
    text? variant
    int? year
    int? mileage
    text? fuel_type
    text? transmission
    int? power_kw
    int? power_hp
    decimal? engine_volume
    text? body_type
    text? color
    text? city
    text? postal_code
    decimal? distance_km
    text? source_image_url
    json source_images?
    text image_status?=unknown filters=trim|lower
    timestamp? published_at
    timestamp first_seen_at?=now
    timestamp last_seen_at?=now
    timestamp? last_checked_at
    text source_status?=active filters=trim|lower
    text user_status?=new filters=trim|lower
    int unavailable_checks?=0
    bool is_new?=true
    bool is_saved?
    bool is_viewed?
    bool is_hidden?
    text? content_hash
    json? raw_data
    text data_level?=search filters=trim|max:20|lower
    bool provider_detail_loaded?
    timestamp? provider_detail_fetched_at
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "user_id", op: "asc"}]}
    {type: "btree", field: [{name: "search_id", op: "asc"}]}
    {type: "btree", field: [{name: "source_status", op: "asc"}]}
    {type: "btree", field: [{name: "user_status", op: "asc"}]}
    {type: "btree", field: [{name: "first_seen_at", op: "desc"}]}
    {type: "btree", field: [{name: "last_checked_at", op: "asc"}]}
    {type: "btree", field: [{name: "is_saved", op: "asc"}]}
    {type: "btree", field: [{name: "is_hidden", op: "asc"}]}
    {type: "unique", field: [{name: "user_id", op: "asc"}, {name: "platform", op: "asc"}, {name: "external_id", op: "asc"}]}
  ]
  tags = ["deal-finder", "internal", "listing"]
}

table deal_finder_analyses {
  auth = false

  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    int? user_id { table = "automarket_users" }
    int listing_id { table = "deal_finder_listings" }

    // Queue and immutable input identity.
    text status?=pending filters=trim|lower
    text analysis_status?=pending filters=trim|lower
    text? analysis_version
    text? model
    text? model_used
    text? input_hash
    text? listing_content_hash
    json? input_snapshot

    // Version 1 does not claim exact market or profit figures. Legacy nullable
    // columns remain for backwards compatibility and are not populated.
    decimal? market_price_low
    decimal? market_price_average
    decimal? market_price_high
    decimal? repair_cost_low
    decimal? repair_cost_high
    decimal? potential_profit_low
    decimal? potential_profit_high
    decimal? discount_percent

    int? deal_score
    int? risk_score
    int? liquidity_score
    int? data_quality_score
    decimal? confidence_score
    json positive_signals?
    json negative_signals?
    json missing_information?
    json known_defects?
    json recommended_questions?
    text? recommendation
    text? ai_summary

    text? provider_response_id
    int input_tokens?=0
    int output_tokens?=0
    int total_tokens?=0
    decimal? estimated_cost
    timestamp? started_at
    timestamp? completed_at
    timestamp? failed_at
    timestamp? analyzed_at
    text? error_code
    text? error_message
    int retry_count?=0
  }

  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "user_id", op: "asc"}]}
    {type: "btree", field: [{name: "listing_id", op: "asc"}, {name: "created_at", op: "desc"}]}
    {type: "btree", field: [{name: "status", op: "asc"}, {name: "created_at", op: "asc"}]}
    {type: "btree", field: [{name: "input_hash", op: "asc"}, {name: "analysis_version", op: "asc"}]}
    {type: "btree", field: [{name: "deal_score", op: "desc"}]}
    {type: "btree", field: [{name: "recommendation", op: "asc"}]}
    {type: "btree", field: [{name: "completed_at", op: "desc"}]}
  ]

  tags = ["deal-finder", "internal", "analysis", "queue"]
}
