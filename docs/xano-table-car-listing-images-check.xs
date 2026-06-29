table car_listing_images {
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?
    int car_listing_id
    json image
    text image_url
    int sort_order?=0
    bool is_main?=false
    bool is_deleted?=false
    timestamp deleted_at?
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "car_listing_id", op: "asc"}]}
    {type: "btree", field: [{name: "sort_order", op: "asc"}]}
    {type: "btree", field: [{name: "is_deleted", op: "asc"}]}
  ]
}
