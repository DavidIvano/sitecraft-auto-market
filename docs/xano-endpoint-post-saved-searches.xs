// SiteCraft Auto Market
// Endpoint: POST /saved-searches
// Xano API id: 3981320
// Auth: automarket_users required
// Table: saved_searches, id 866178
// Purpose: let an authenticated buyer save catalog filters or AI search results.
//
// Privacy:
// - Do not store email, phone, Google profile, or raw IP.
// - filters_json is stored as JSON, not as a double-encoded string.
// - Duplicate handling currently uses user_id + query_text + is_active.
// - filters_hash exists for a future stronger duplicate rule by normalized filters.

query "saved-searches" verb=POST {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    text query_text? filters=trim
    json filters_json
    text ai_summary? filters=trim
    bool notify_enabled?
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }

    precondition ($input.filters_json != null) {
      error_type = "inputerror"
      error = "filters_json is required"
    }

    var $query_text {
      value = $input.query_text
    }

    conditional {
      if ($query_text == null) {
        var.update $query_text {
          value = ""
        }
      }
    }

    var $ai_summary {
      value = $input.ai_summary
    }

    conditional {
      if ($ai_summary == null) {
        var.update $ai_summary {
          value = ""
        }
      }
    }

    var $notify_enabled {
      value = ($input.notify_enabled == true)
    }

    var $filters_hash {
      value = ""
    }

    db.query saved_searches {
      where = (($db.saved_searches.user_id == $auth.id) && ($db.saved_searches.is_active == true) && ($query_text != "") && ($db.saved_searches.query_text == $query_text))
      sort = {saved_searches.updated_at: "desc"}
      return = {type: "single"}
    } as $existing

    var $result {
      value = {
        success: true
        saved: false
        updated: false
      }
    }

    conditional {
      if ($existing != null) {
        db.edit saved_searches {
          field_name = "id"
          field_value = $existing.id
          data = {
            updated_at    : "now"
            query_text    : $query_text
            filters_json  : $input.filters_json
            ai_summary    : $ai_summary
            notify_enabled: $notify_enabled
            filters_hash  : $filters_hash
          }
        } as $saved

        var.update $result {
          value = {
            success: true
            saved: true
            updated: true
            saved_search_id: $saved.id
            message: "Saved search updated"
          }
        }
      }

      else {
        db.add saved_searches {
          data = {
            created_at      : "now"
            updated_at      : "now"
            user_id         : $auth.id
            query_text      : $query_text
            filters_json    : $input.filters_json
            ai_summary      : $ai_summary
            notify_enabled  : $notify_enabled
            is_active       : true
            last_checked_at : null
            last_notified_at: null
            matches_count   : 0
            filters_hash    : $filters_hash
            metadata        : null
          }
        } as $saved

        var.update $result {
          value = {
            success: true
            saved: true
            updated: false
            saved_search_id: $saved.id
            message: "Search saved"
          }
        }
      }
    }
  }

  response = $result
  tags = ["sitecraft-auto-market", "saved-searches", "buyer"]
}

// Live tests, 2026-07-11:
// Without auth:
// 401 {"code":"ERROR_CODE_UNAUTHORIZED","message":"Unauthorized - Authentication Required"}
//
// First authenticated request:
// {"success":true,"saved":true,"updated":false,"saved_search_id":1,"message":"Search saved"}
//
// Immediate repeated authenticated request:
// {"success":true,"saved":true,"updated":true,"saved_search_id":1,"message":"Saved search updated"}
//
// Missing filters_json with auth:
// 400 {"code":"ERROR_CODE_INPUT_ERROR","message":"Missing param: filters_json","payload":{"param":"filters_json"}}
