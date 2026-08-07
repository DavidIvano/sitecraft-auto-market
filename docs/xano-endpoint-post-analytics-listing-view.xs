query "analytics/listing-view" verb=POST {
  api_group = "sitecraft-auto-market"

  input {
    int car_id
    text slug filters=trim
    text session_id filters=trim
    text source? filters=trim
    text viewed_at? filters=trim
  }

  stack {
    precondition ($input.car_id > 0 && $input.slug != "" && $input.session_id != "") {
      error_type = "inputerror"
      error = "slug and session_id are required"
    }

    db.get car_listings {
      field_name = "id"
      field_value = $input.car_id
    } as $car

    precondition ($car != null && $car.slug == $input.slug) {
      error_type = "notfound"
      error = "Public listing not found"
    }

    var $is_public {
      value = false
    }

    conditional {
      if (($car.status == "approved") || ($car.status == "published") || ($car.status == "sold") || ($car.moderation_status == "approved") || ($car.moderation_status == "published") || ($car.moderation_status == "sold")) {
        var.update $is_public {
          value = true
        }
      }
    }

    conditional {
      if (($car.status == "draft") || ($car.status == "ai_draft") || ($car.status == "pending_review") || ($car.status == "needs_fix") || ($car.status == "rejected") || ($car.status == "blocked") || ($car.status == "deleted") || ($car.status == "archived") || ($car.moderation_status == "draft") || ($car.moderation_status == "ai_draft") || ($car.moderation_status == "pending_review") || ($car.moderation_status == "needs_fix") || ($car.moderation_status == "rejected") || ($car.moderation_status == "blocked") || ($car.moderation_status == "deleted") || ($car.moderation_status == "archived")) {
        var.update $is_public {
          value = false
        }
      }
    }

    precondition ($is_public) {
      error_type = "notfound"
      error = "Public listing not found"
    }

    var $dedupe_after {
      value = now|add_secs_to_timestamp:-86400
    }

    db.query listing_views {
      where = (($db.listing_views.car_id == $car.id) && ($db.listing_views.session_id == $input.session_id) && ($db.listing_views.created_at >= $dedupe_after))
      sort = {listing_views.created_at: "desc"}
      return = {type: "single"}
    } as $recent_view

    var $result {
      value = {
        success: true
        tracked: false
        counted: false
        deduped: false
      }
    }

    conditional {
      if ($recent_view != null) {
        var.update $result {
          value = {
            success: true
            deduped: true
            tracked: false
            counted: false
            message: "View already tracked recently"
          }
        }
      }

      else {
        var $viewed_at {
          value = $input.viewed_at
        }

        conditional {
          if (($viewed_at == null) || ($viewed_at == "")) {
            var.update $viewed_at {
              value = now
            }
          }
        }

        db.add listing_views {
          data = {
            created_at   : "now"
            updated_at   : "now"
            car_id       : $car.id
            slug         : $input.slug
            session_id   : $input.session_id
            user_id      : null
            source       : $input.source
            search_params: ""
            viewed_at    : $viewed_at
            user_agent   : ""
            ip_hash      : ""
            metadata     : null
          }
        } as $view

        var.update $result {
          value = {
            success: true
            tracked: true
            deduped: false
            counted: true
            view_id: $view.id
          }
        }
      }
    }
  }

  response = $result
  tags = ["sitecraft-auto-market", "analytics", "listing-view"]
}

// Stage 3 rule: public listing only; one opaque anonymous browser session per
// car_id per rolling 24 hours. Xano public endpoints cannot safely resolve
// optional authenticated identity; owner exclusion requires a separate protected path.
// Live test, 2026-07-11:
// First request:
// {"success":true,"tracked":true,"deduped":false,"view_id":3}
// Immediate repeated request:
// {"success":true,"deduped":true,"tracked":false,"message":"View already tracked recently"}
