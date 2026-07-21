// SiteCraft Auto Market AI draft tables.
// Вставить в Xano как tables script.

table car_drafts {
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    int user_id
    int car_id?
    text status?="draft" filters=trim
    bool is_ai_generated?=true
    text source?="openai_responses" filters=trim

    text title? filters=trim
    text brand? filters=trim
    text model? filters=trim
    int year?
    int mileage?
    text fuel_type? filters=trim
    text transmission? filters=trim
    text body_type? filters=trim
    text vehicle_type? filters=trim
    text color? filters=trim
    text engine_volume? filters=trim
    text first_registration? filters=trim
    int owners_count?
    int price?
    text city? filters=trim
    text description?

    decimal confidence?
    json ai_payload?
    json ai_raw_response?
    text ai_notes?
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "user_id", op: "asc"}]}
    {type: "btree", field: [{name: "status", op: "asc"}]}
    {type: "btree", field: [{name: "created_at", op: "desc"}]}
  ]
}

table car_draft_images {
  schema {
    int id
    timestamp created_at?=now
    int user_id
    int draft_id
    int sort_order?=0
    bool is_primary?=false
    file image?
    text image_url?
    text mime_type?
    text original_filename?
    int size_bytes?
    json image_metadata?
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "draft_id", op: "asc"}]}
    {type: "btree", field: [{name: "user_id", op: "asc"}]}
    {type: "btree", field: [{name: "sort_order", op: "asc"}]}
  ]
}

table ai_generation_logs {
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    int user_id
    int draft_id?
    text endpoint?="ai/generate-listing" filters=trim
    text model?
    text status?="started" filters=trim
    int photo_count?=0
    int total_photo_bytes?=0
    int credits_before?=0
    int credits_after?=0
    text error_code?
    text error_message?
    json request_summary?
    json raw_response?
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "user_id", op: "asc"}]}
    {type: "btree", field: [{name: "draft_id", op: "asc"}]}
    {type: "btree", field: [{name: "created_at", op: "desc"}]}
    {type: "btree", field: [{name: "status", op: "asc"}]}
  ]
}

table user_credits {
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    int user_id
    int ai_credits?=0
    int ai_daily_generations?=0
    int ai_monthly_generations?=0
    date ai_daily_reset_date?
    date ai_monthly_reset_date?
    timestamp last_monthly_reset_at?
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree|unique", field: [{name: "user_id", op: "asc"}]}
  ]
}

table credit_transactions {
  schema {
    int id
    timestamp created_at?=now
    int user_id
    text type filters=trim
    int amount
    int balance_after
    int related_purchase_id?
    int related_car_id?
    text notes?
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "user_id", op: "asc"}]}
  ]
}

