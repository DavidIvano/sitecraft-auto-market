table seo_refresh_queue {
  auth = false
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    text event_key filters=trim|max:255
    text event_type filters=trim|lower|max:80
    int? car_listing_id?
    text? locale_code? filters=trim|lower|max:35
    int? translation_version?
    enum status?=pending { values = ["pending", "processing", "completed", "failed"] }
    int attempts?=0
    timestamp? available_at?=now
    timestamp? locked_at?
    text? locked_by? filters=trim|max:120
    text? last_error_code? filters=trim|max:120
    text? materialization_generation? filters=trim|max:80
    int materialization_cursor?=0
    text? completed_generation? filters=trim|max:80
    timestamp? completed_at?
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree|unique", field: [{name: "event_key", op: "asc"}]}
    {type: "btree", field: [{name: "status", op: "asc"}, {name: "available_at", op: "asc"}, {name: "id", op: "asc"}]}
    {type: "btree", field: [{name: "car_listing_id", op: "asc"}, {name: "locale_code", op: "asc"}]}
  ]
  tags = ["sitecraft-auto-market", "seo", "queue", "materializer"]
}
