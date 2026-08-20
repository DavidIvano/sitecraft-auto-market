// Stage 3 scaling schema. Additive only: preserve all legacy production data.
// Validate names against the live Metadata API before applying.

table seo_listing_locale_index {
  auth = false
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    text generation filters=trim
    text locale_code filters=trim|lower
    int car_listing_id { table = "car_listings" }
    text slug filters=trim
    timestamp listing_updated_at
    int promotion_rank?=0
    timestamp sort_published_at
    bool is_active?=false
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree|unique", field: [{name: "generation", op: "asc"}, {name: "locale_code", op: "asc"}, {name: "car_listing_id", op: "asc"}]}
    {type: "btree|unique", field: [{name: "generation", op: "asc"}, {name: "locale_code", op: "asc"}, {name: "slug", op: "asc"}]}
    {type: "btree", field: [{name: "is_active", op: "asc"}, {name: "locale_code", op: "asc"}, {name: "promotion_rank", op: "desc"}, {name: "sort_published_at", op: "desc"}, {name: "car_listing_id", op: "desc"}]}
  ]
  tags = ["sitecraft-auto-market", "seo", "catalog-index", "stage-3", "additive"]
}

table seo_sitemap_locale_generations {
  auth = false
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    text generation filters=trim
    text locale_code filters=trim|lower
    int listing_total?=0
    int shard_size?=10000
    int shard_count?=0
    timestamp? last_listing_updated_at
    bool is_active?=false
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree|unique", field: [{name: "generation", op: "asc"}, {name: "locale_code", op: "asc"}]}
    {type: "btree", field: [{name: "is_active", op: "asc"}, {name: "locale_code", op: "asc"}]}
  ]
  tags = ["sitecraft-auto-market", "seo", "sitemap-generation", "stage-3", "additive"]
}
