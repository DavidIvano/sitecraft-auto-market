// Stage 10 Release 1: additive-only schema. Existing fields and endpoints remain unchanged.
table locales {
  auth = false
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    text code filters=trim
    text base_language filters=trim|lower
    text native_name filters=trim
    text english_name filters=trim
    text direction?=ltr filters=trim|lower
    bool is_active?=true
    bool is_default?=false
    bool is_public?=false
    text? fallback_locale filters=trim
    int sort_order?=0
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree|unique", field: [{name: "code", op: "asc"}]}
    {type: "btree", field: [{name: "is_active", op: "asc"}, {name: "sort_order", op: "asc"}]}
  ]
  tags = ["automarket", "i18n", "release-1"]
}

table taxonomy_translations {
  auth = false
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    text taxonomy filters=trim|lower
    text value_code filters=trim|lower
    text locale_code filters=trim
    text label filters=trim
    text? short_label filters=trim
    text? description filters=trim
    bool is_active?=true
    int sort_order?=0
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree|unique", field: [{name: "taxonomy", op: "asc"}, {name: "value_code", op: "asc"}, {name: "locale_code", op: "asc"}]}
    {type: "btree", field: [{name: "locale_code", op: "asc"}, {name: "is_active", op: "asc"}]}
  ]
  tags = ["automarket", "i18n", "taxonomy", "release-1"]
}

table car_listing_translations {
  auth = false
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    int car_listing_id { table = "car_listings" }
    text locale_code filters=trim
    text title filters=trim
    text description
    text? seo_title filters=trim
    text? seo_description filters=trim
    json? image_alt_texts
    json? search_keywords
    text translation_status?=pending filters=trim|lower
    text translation_source?=original filters=trim|lower
    text source_locale filters=trim
    text source_hash filters=trim|lower
    text? translation_provider filters=trim|lower
    text? translation_model filters=trim
    text? translation_prompt_version filters=trim
    decimal? quality_score
    decimal? language_detection_score
    int? reviewed_by { table = "automarket_users" }
    timestamp? reviewed_at
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree|unique", field: [{name: "car_listing_id", op: "asc"}, {name: "locale_code", op: "asc"}]}
    {type: "btree", field: [{name: "locale_code", op: "asc"}, {name: "translation_status", op: "asc"}]}
    {type: "btree", field: [{name: "source_hash", op: "asc"}]}
  ]
  tags = ["automarket", "i18n", "listing-translation", "release-1"]
}

table translation_jobs {
  auth = false
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    text entity_type filters=trim|lower
    int entity_id
    text source_locale filters=trim
    text target_locale filters=trim
    text source_hash filters=trim|lower
    text idempotency_key filters=trim
    text status?=pending filters=trim|lower
    int priority?=0
    int attempt_count?=0
    int max_attempts?=3
    text? provider filters=trim|lower
    text? model filters=trim
    text? prompt_version filters=trim
    text? last_error
    timestamp? locked_at
    text? locked_by filters=trim
    timestamp? started_at
    timestamp? completed_at
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree|unique", field: [{name: "idempotency_key", op: "asc"}]}
    {type: "btree", field: [{name: "status", op: "asc"}, {name: "priority", op: "desc"}, {name: "created_at", op: "asc"}]}
    {type: "btree", field: [{name: "entity_type", op: "asc"}, {name: "entity_id", op: "asc"}]}
  ]
  tags = ["automarket", "i18n", "translation-queue", "release-1"]
}

table content_migration_logs {
  auth = false
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    text entity_type filters=trim|lower
    int entity_id
    text migration_version filters=trim
    text status?=pending filters=trim|lower
    text? source_locale filters=trim
    json? legacy_values
    json? normalized_values
    json? translations_created
    json? warnings
    text? error
    timestamp? started_at
    timestamp? completed_at
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree|unique", field: [{name: "entity_type", op: "asc"}, {name: "entity_id", op: "asc"}, {name: "migration_version", op: "asc"}]}
    {type: "btree", field: [{name: "status", op: "asc"}, {name: "created_at", op: "asc"}]}
  ]
  tags = ["automarket", "i18n", "migration-log", "release-1"]
}

// Add with Metadata API after checking the live schema:
// automarket_users.preferred_locale: nullable text, trim, default "de"
// car_listings.source_locale: nullable text, trim
// car_listings.translation_source_hash: nullable text, trim|lower
// car_listings.translation_version: nullable int, default 1
// car_listings.translations_ready: nullable bool, default false
// car_listings.translation_updated_at: nullable timestamp
