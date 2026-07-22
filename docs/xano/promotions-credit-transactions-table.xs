table credit_transactions {
  auth = false
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    int user_id
    text type filters=trim
    int amount
    int? balance_before?
    int balance_after
    int related_purchase_id?=0
    int related_car_id?=0
    text notes?
    text? product_slug? filters=trim|lower|max:40
    text? status? filters=trim|lower|max:20
    text? idempotency_key? filters=trim|lower|max:64
    json? metadata?
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "user_id", op: "asc"}]}
    {type: "btree", field: [{name: "related_car_id", op: "asc"}]}
    {type: "btree|unique", field: [{name: "user_id", op: "asc"}, {name: "idempotency_key", op: "asc"}]}
  ]
  tags = ["sitecraft-auto-market", "credits", "ledger"]
}
