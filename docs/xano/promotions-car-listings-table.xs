table car_listings {
  auth = false
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    text slug
    text title
    text brand
    text model
    int year
    int mileage
    text fuel_type
    text transmission
    decimal price
    text currency?=EUR
    text city
    text country?="Германия"
    text description
    enum status {
      values = [
        "draft"
        "pending_review"
        "approved"
        "rejected"
        "archived"
        "blocked"
        "deleted"
        "sold"
      ]
    }
    text main_image_url?
    int user_id? { table = "automarket_users" }
    text seller_name?
    text seller_phone?
    email? seller_email
    text? vehicle_type?
    text? body_type?
    text? engine_volume?
    text? drivetrain?
    text? color?
    text? first_registration?
    text? first_registration_date?
    int? owners_count?=0
    int? owner_count?=0
    text? vin?
    text? doors?
    text? seats?
    text? seller_type?
    text? condition?
    bool? is_ai_generated?
    int? draft_id?=0
    text? moderation_status?
    text? vehicle_condition?
    bool? has_valid_tuv?
    text? tuv_valid_until?
    int? listing_quality_score?
    int? photo_quality_score?
    int? trust_score?
    timestamp? boosted_at?
    timestamp? boosted_until?
    timestamp? featured_at?
    timestamp? featured_until?
    timestamp? homepage_at?
    timestamp? homepage_until?
    timestamp? last_promoted_at?
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "user_id", op: "asc"}]}
    {type: "btree|unique", field: [{name: "slug", op: "asc"}]}
    {type: "btree", field: [{name: "status", op: "asc"}]}
    {type: "btree", field: [{name: "created_at", op: "desc"}]}
    {type: "btree", field: [{name: "boosted_until", op: "desc"}]}
    {type: "btree", field: [{name: "featured_until", op: "desc"}]}
    {type: "btree", field: [{name: "homepage_until", op: "desc"}]}
    {type: "btree", field: [{name: "last_promoted_at", op: "desc"}]}
  ]
  tags = ["sitecraft-auto-market"]
}
