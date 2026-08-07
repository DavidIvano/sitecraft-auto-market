table car_drafts {
  auth = false

  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    int user_id
    int car_id?
    text? idempotency_key?
    text status?=draft
    bool is_ai_generated?=true
    text source?="openai_responses"
    text title?
    text brand?
    text model?
    int year?
    int mileage?
    text fuel_type?
    text transmission?
    text body_type?
    text vehicle_type?
    text color?
    text engine_volume?
    text first_registration?
    int owners_count?
    int price?
    text city?
    text description?
    decimal confidence?
    json ai_payload?
    json ai_raw_response?
    text ai_notes?
    text? currency?=EUR
    text? country?="Германия"
    text? drivetrain?
    text? doors?
    text? seats?
    text? vehicle_condition?
    text? seller_type?
    text? seller_name?
    text? seller_phone?
    email? seller_email?
    text? vin?
    bool? has_valid_tuv?
    text? tuv_valid_until?

    // Canonical AI quality score (0-100); null means not calculated.
    int? listing_quality_score?

    // Canonical AI quality score (0-100); null means not calculated.
    int? photo_quality_score?

    // Canonical AI quality score (0-100); null means not calculated.
    int? trust_score?
  }

  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "user_id", op: "asc"}]}
    {type: "btree", field: [{name: "status", op: "asc"}]}
    {type: "btree", field: [{name: "created_at", op: "desc"}]}
    {type: "btree|unique", field: [{name: "user_id", op: "asc"}, {name: "idempotency_key", op: "asc"}]}
  ]

  guid = "MyVBziBBIBIBkTHuf4EiTa2ifRE"
}
