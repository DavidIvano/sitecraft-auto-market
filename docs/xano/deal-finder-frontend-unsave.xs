query "deal-finder/listings/{id}/unsave" verb=POST {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"
  input {
    int id filters=min:1
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
    db.query deal_finder_listings {
      where = (($db.deal_finder_listings.id == $input.id) && ($db.deal_finder_listings.user_id == $current_user.id))
      return = {type: "single"}
    } as $listing
    precondition ($listing != null) {
      error_type = "notfound"
      error = "Listing not found"
    }
    var $next_status { value = "new" }
    conditional {
      if ($listing.is_viewed == true) {
        var.update $next_status { value = "viewed" }
      }
    }
    db.edit deal_finder_listings {
      field_name = "id"
      field_value = $listing.id
      data = {updated_at: "now", is_saved: false, user_status: $next_status}
    } as $updated
  }
  response = {id: $updated.id, user_status: $updated.user_status, is_new: $updated.is_new, is_saved: $updated.is_saved, is_viewed: $updated.is_viewed, is_hidden: $updated.is_hidden}
  tags = ["deal-finder", "frontend", "owner-only", "action"]
}
