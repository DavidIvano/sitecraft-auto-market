// READY FOR XANO REVIEW. Publish through Xano metadata after checking existing fields/indexes.
table car_listing_favorites {
  auth = false
  schema {
    int id
    timestamp created_at?=now
    int user_id { table = "automarket_users" }
    int car_listing_id { table = "car_listings" }
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree|unique", field: [{name: "user_id", op: "asc"}, {name: "car_listing_id", op: "asc"}]}
    {type: "btree", field: [{name: "user_id", op: "asc"}, {name: "created_at", op: "desc"}]}
    {type: "btree", field: [{name: "car_listing_id", op: "asc"}]}
  ]
  tags = ["favorites", "public-catalog"]
}

// Add these nullable fields to automarket_users through a reviewed table patch:
// text first_name? filters=trim
// text last_name? filters=trim
// text display_name? filters=trim
// text contact_phone? filters=trim
// email contact_email? filters=trim|lower
// bool show_phone?=false
// bool show_email?=false
// enum preferred_contact_method? values=["phone", "email"]
// Deletion policy: use relation cascade if enabled in the workspace; otherwise run a server-side cleanup
// of car_listing_favorites before deleting an automarket_users or car_listings row.
