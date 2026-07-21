query "deal-finder/searches" verb=GET {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"
  input {
  }
  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }
    db.get automarket_users {
      field_name = "id"
      field_value = $auth.id
    } as $current_user
    precondition (($current_user != null) && (($current_user.role == "admin") || ($current_user.role == "deal_finder_admin"))) {
      error_type = "accessdenied"
      error = "Deal Finder access required"
    }
    db.query deal_finder_searches {
      where = ($db.deal_finder_searches.user_id == $current_user.id)
      sort = {deal_finder_searches.created_at: "desc"}
      return = {type: "list"}
      output = ["id", "name", "platform", "source_type", "price_min", "price_max", "postal_code", "location_id", "location_name", "category_id", "radius_km", "minimum_deal_score", "picture_required", "sync_enabled", "last_sync_at", "last_sync_status", "is_active", "created_at", "updated_at"]
    } as $searches
  }
  response = {data: $searches}
  tags = ["deal-finder", "frontend", "owner-only", "searches"]
}
