// Stage 2 scaling schema. Additive only: do not delete or rename legacy data.
// Apply via Xano Metadata API only after comparing these names to live schema.

table seo_taxonomy_facets {
  auth = false
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    text generation filters=trim
    text taxonomy_type filters=trim|lower
    text slug filters=trim|lower
    text? parent_slug filters=trim|lower
    text label filters=trim
    text? region_slug filters=trim|lower
    text? code filters=trim|lower
    decimal? price_min
    decimal? price_max
    bool price_max_exclusive?=true
    bool is_active?=false
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree|unique", field: [{name: "generation", op: "asc"}, {name: "taxonomy_type", op: "asc"}, {name: "parent_slug", op: "asc"}, {name: "slug", op: "asc"}]}
    {type: "btree", field: [{name: "is_active", op: "asc"}, {name: "taxonomy_type", op: "asc"}, {name: "slug", op: "asc"}]}
  ]
  tags = ["sitecraft-auto-market", "seo", "taxonomy", "stage-2", "additive"]
}

table seo_taxonomy_listing_edges {
  auth = false
  schema {
    int id
    timestamp created_at?=now
    text generation filters=trim
    int facet_id { table = "seo_taxonomy_facets" }
    int car_listing_id { table = "car_listings" }
    text locale_code filters=trim|lower
    timestamp listing_updated_at
    bool is_active?=false
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree|unique", field: [{name: "generation", op: "asc"}, {name: "facet_id", op: "asc"}, {name: "locale_code", op: "asc"}, {name: "car_listing_id", op: "asc"}]}
    {type: "btree", field: [{name: "is_active", op: "asc"}, {name: "locale_code", op: "asc"}, {name: "facet_id", op: "asc"}, {name: "listing_updated_at", op: "desc"}]}
    {type: "btree", field: [{name: "car_listing_id", op: "asc"}, {name: "locale_code", op: "asc"}]}
  ]
  tags = ["sitecraft-auto-market", "seo", "taxonomy-edge", "stage-2", "additive"]
}

table seo_taxonomy_locale_stats {
  auth = false
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    text generation filters=trim
    int facet_id { table = "seo_taxonomy_facets" }
    text locale_code filters=trim|lower
    int ready_listing_count?=0
    timestamp? last_listing_updated_at
    bool is_indexable?=false
    bool is_active?=false
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree|unique", field: [{name: "generation", op: "asc"}, {name: "facet_id", op: "asc"}, {name: "locale_code", op: "asc"}]}
    {type: "btree", field: [{name: "is_active", op: "asc"}, {name: "locale_code", op: "asc"}, {name: "is_indexable", op: "asc"}, {name: "ready_listing_count", op: "desc"}]}
  ]
  tags = ["sitecraft-auto-market", "seo", "taxonomy-stats", "stage-2", "additive"]
}

table seo_taxonomy_related {
  auth = false
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    text generation filters=trim
    int source_facet_id { table = "seo_taxonomy_facets" }
    int related_facet_id { table = "seo_taxonomy_facets" }
    text locale_code filters=trim|lower
    int overlap_count?=0
    int rank?=0
    bool is_active?=false
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree|unique", field: [{name: "generation", op: "asc"}, {name: "source_facet_id", op: "asc"}, {name: "related_facet_id", op: "asc"}, {name: "locale_code", op: "asc"}]}
    {type: "btree", field: [{name: "is_active", op: "asc"}, {name: "locale_code", op: "asc"}, {name: "source_facet_id", op: "asc"}, {name: "rank", op: "asc"}]}
  ]
  tags = ["sitecraft-auto-market", "seo", "taxonomy-related", "stage-2", "additive"]
}
