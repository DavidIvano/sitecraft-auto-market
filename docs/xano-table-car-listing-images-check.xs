table car_listing_images {
  schema {
    int id
    timestamp created_at?=now
    int car_listing_id
    json image
    text image_url
    int sort_order?=0
    bool is_main?=false
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "car_listing_id", op: "asc"}]}
    {type: "btree", field: [{name: "sort_order", op: "asc"}]}
  ]
}
