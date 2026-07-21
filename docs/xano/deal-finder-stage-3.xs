// Stage 3 blueprint. Publish only inside the authenticated Deal Finder API group.
// Every browser endpoint derives user_id from auth; it never accepts user_id from input.

table deal_comparisons {
  id int
  user_id int index
  name text filters=trim|max:120
  created_at timestamp
  updated_at timestamp
}

table deal_comparison_items {
  id int
  comparison_id int index
  user_id int index
  listing_id int index
  position int filters=min:0|max:3
  created_at timestamp
  unique = [comparison_id, listing_id]
}

table notification_preferences {
  id int
  user_id int unique
  email_enabled bool
  web_push_enabled bool
  frequency enum=instant|daily|weekly
  quiet_hours_enabled bool
  quiet_start text filters=trim|max:5
  quiet_end text filters=trim|max:5
  minimum_score int filters=min:0|max:100
  events json
  timezone text filters=trim|max:64
  created_at timestamp
  updated_at timestamp
}

table notification_deliveries {
  id int
  user_id int index
  listing_id int index
  event enum=hot_deal|new_match|price_change|next_action
  channel enum=email|web_push
  dedupe_key text filters=trim|max:180
  status enum=pending|sent|suppressed|failed
  scheduled_for timestamp?
  sent_at timestamp?
  error_code text? filters=trim|max:80
  created_at timestamp
  updated_at timestamp
  unique = [user_id, channel, dedupe_key]
}

query "GET /deal-finder/comparison" verb=GET {
  auth = "automarket_users"
  stack {
    precondition (($auth.id > 0) && (($auth.role == "admin") || ($auth.role == "employee"))) {
      error_type = "accessdenied"
      error = "FORBIDDEN"
    }
    db.query deal_comparisons {
      where = ($db.deal_comparisons.user_id == $auth.id)
      sort = {deal_comparisons.updated_at: "desc"}
      return = {type: "single"}
    } as $comparison
    conditional {
      if ($comparison != null) {
        db.query deal_comparison_items {
          where = (($db.deal_comparison_items.user_id == $auth.id) && ($db.deal_comparison_items.comparison_id == $comparison.id))
          sort = {deal_comparison_items.position: "asc"}
        } as $items
      }
      else { var $items { value = [] } }
    }
  }
  response = {comparison: $comparison, items: $items}
}

query "PUT /deal-finder/comparison" verb=PUT {
  auth = "automarket_users"
  input { json listing_ids }
  stack {
    precondition (($auth.id > 0) && (($auth.role == "admin") || ($auth.role == "employee"))) {
      error_type = "accessdenied"
      error = "FORBIDDEN"
    }
    precondition (($input.listing_ids|is_array) && (($input.listing_ids|count) <= 4)) {
      error_type = "inputerror"
      error = "INVALID_COMPARISON"
    }
    // Normalize unique positive ids, then verify every listing belongs to auth.id.
    var $normalized_ids { value = [] }
    foreach ($input.listing_ids) {
      each as $listing_id {
        precondition (($listing_id|is_int) && ($listing_id > 0) && !(($normalized_ids|includes:$listing_id))) {
          error_type = "inputerror"
          error = "INVALID_COMPARISON_ITEM"
        }
        db.get deal_finder_listings { field_name = "id" field_value = $listing_id } as $listing
        precondition (($listing != null) && ($listing.user_id == $auth.id)) {
          error_type = "notfound"
          error = "LISTING_NOT_FOUND"
        }
        array.push $normalized_ids { value = $listing_id }
      }
    }
    transaction {
      db.query deal_comparisons {
        where = ($db.deal_comparisons.user_id == $auth.id)
        return = {type: "single"}
      } as $comparison
      conditional {
        if ($comparison == null) {
          db.add deal_comparisons { data = {user_id: $auth.id, name: "Основное сравнение", created_at: now, updated_at: now} } as $comparison
        }
        else { db.edit deal_comparisons { field_name = "id" field_value = $comparison.id data = {updated_at: now} } as $comparison }
      }
      db.query deal_comparison_items { where = ($db.deal_comparison_items.comparison_id == $comparison.id) } as $old_items
      foreach ($old_items) { each as $old_item { db.del deal_comparison_items { field_name = "id" field_value = $old_item.id } } }
      foreach ($normalized_ids) {
        each as $listing_id index as $position {
          db.add deal_comparison_items { data = {comparison_id: $comparison.id, user_id: $auth.id, listing_id: $listing_id, position: $position, created_at: now} }
        }
      }
    }
  }
  response = {listing_ids: $normalized_ids, storage: "server"}
}

query "GET /deal-finder/notifications/preferences" verb=GET {
  auth = "automarket_users"
  stack {
    precondition (($auth.id > 0) && (($auth.role == "admin") || ($auth.role == "employee"))) { error_type = "accessdenied" error = "FORBIDDEN" }
    db.query notification_preferences {
      where = ($db.notification_preferences.user_id == $auth.id)
      return = {type: "single"}
    } as $preferences
  }
  response = $preferences
}

query "PATCH /deal-finder/notifications/preferences" verb=PATCH {
  auth = "automarket_users"
  input {
    bool email_enabled
    bool web_push_enabled
    enum frequency { values = ["instant", "daily", "weekly"] }
    bool quiet_hours_enabled
    text quiet_start filters=trim|max:5
    text quiet_end filters=trim|max:5
    int minimum_score filters=min:0|max:100
    json events
    text timezone filters=trim|max:64
  }
  stack {
    precondition (($auth.id > 0) && (($auth.role == "admin") || ($auth.role == "employee"))) { error_type = "accessdenied" error = "FORBIDDEN" }
    precondition (($input.quiet_start|regex_match:"^(?:[01]\\d|2[0-3]):[0-5]\\d$") && ($input.quiet_end|regex_match:"^(?:[01]\\d|2[0-3]):[0-5]\\d$")) { error_type = "inputerror" error = "INVALID_QUIET_HOURS" }
    precondition (($input.events|is_array) && (($input.events|count) <= 4)) { error_type = "inputerror" error = "INVALID_EVENTS" }
    db.query notification_preferences { where = ($db.notification_preferences.user_id == $auth.id) return = {type: "single"} } as $preferences
    var $payload { value = {user_id: $auth.id, email_enabled: $input.email_enabled, web_push_enabled: $input.web_push_enabled, frequency: $input.frequency, quiet_hours_enabled: $input.quiet_hours_enabled, quiet_start: $input.quiet_start, quiet_end: $input.quiet_end, minimum_score: $input.minimum_score, events: $input.events, timezone: $input.timezone, updated_at: now} }
    conditional {
      if ($preferences == null) { db.add notification_preferences { data = $payload|set:"created_at":now } as $preferences }
      else { db.edit notification_preferences { field_name = "id" field_value = $preferences.id data = $payload } as $preferences }
    }
  }
  response = $preferences|set:"storage":"server"
}

query "GET /deal-finder/notifications/deliveries" verb=GET {
  auth = "automarket_users"
  input { int page?=1 filters=min:1 int per_page?=25 filters=min:1|max:100 }
  stack {
    precondition (($auth.id > 0) && (($auth.role == "admin") || ($auth.role == "employee"))) { error_type = "accessdenied" error = "FORBIDDEN" }
    db.query notification_deliveries {
      where = ($db.notification_deliveries.user_id == $auth.id)
      sort = {notification_deliveries.created_at: "desc"}
      paging = {page: $input.page, per_page: $input.per_page}
    } as $deliveries
  }
  response = $deliveries
}

// Worker delivery contract:
// 1. Authenticate only with X-Deal-Finder-Secret, never browser auth.
// 2. Insert notification_deliveries before sending.
// 3. The unique [user_id, channel, dedupe_key] constraint turns a duplicate insert
//    into ALREADY_QUEUED. Treat it as a successful no-op.
// 4. Apply quiet hours and frequency server-side. Browser values are preferences,
//    not permission to bypass scheduling.
// 5. Store only provider message id and safe error_code; never email bodies or push payloads.
