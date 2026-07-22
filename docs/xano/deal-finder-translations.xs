// Ready-to-install isolated translation queue. This table never mutates
// deal_finder_listings.description and has no relation to car_listings.
table deal_finder_listing_translations {
  auth = false
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    int user_id { table = "automarket_users" }
    int listing_id { table = "deal_finder_listings" }
    text source_language?=de filters=trim|lower|max:10
    text target_language filters=trim|lower|max:10
    text source_text_hash filters=trim|max:128
    text? translated_text
    text status?=pending filters=trim|lower|max:20
    text? provider filters=trim|max:64
    text? model filters=trim|max:128
    timestamp? completed_at
    timestamp? failed_at
    text? error_code filters=trim|max:80
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "unique", field: [{name: "user_id", op: "asc"}, {name: "listing_id", op: "asc"}, {name: "target_language", op: "asc"}, {name: "source_text_hash", op: "asc"}]}
    {type: "btree", field: [{name: "user_id", op: "asc"}, {name: "status", op: "asc"}, {name: "created_at", op: "asc"}]}
    {type: "btree", field: [{name: "listing_id", op: "asc"}, {name: "updated_at", op: "desc"}]}
  ]
  tags = ["deal-finder", "translation", "queue", "owner-only"]
}
