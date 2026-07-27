table deal_finder_translations {
  auth = false

  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    int user_id {
      table = "automarket_users"
    }
    int deal_finder_listing_id {
      table = "deal_finder_listings"
    }
    text source_language?=de filters=trim|lower|max:10
    text target_language filters=trim|lower|max:10
    text source_hash filters=trim|max:128
    timestamp? source_text_updated_at
    text? translated_text
    text? model filters=trim|max:128
    text status?=pending filters=trim|lower|max:20
    text? error_code filters=trim|max:80
    timestamp? completed_at
  }

  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree|unique", field: [{name: "user_id", op: "asc"}, {name: "deal_finder_listing_id", op: "asc"}, {name: "target_language", op: "asc"}, {name: "source_hash", op: "asc"}]}
    {type: "btree", field: [{name: "user_id", op: "asc"}, {name: "status", op: "asc"}, {name: "created_at", op: "asc"}]}
    {type: "btree", field: [{name: "deal_finder_listing_id", op: "asc"}, {name: "updated_at", op: "desc"}]}
  ]

  tags = ["deal-finder", "translation", "owner-only"]
  guid = "j-Qazulb68iaMTq4I1gMovMP9XA"
}
