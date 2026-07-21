// SiteCraft Auto Market
// Endpoint: POST /analytics/listing-view
// Xano API id: 3981281
// Auth: none / public
// Table: listing_views, id 866168
// Purpose: store anonymous on-site listing view analytics for buyer recommendations.
//
// Privacy:
// - Do not store email, phone, Google profile, or real name.
// - Do not store raw IP at this stage.
// - metadata must be sanitized if new fields are added later.

query "analytics/listing-view" verb=POST {
  api_group = "sitecraft-auto-market"

  input {
    int car_id?
    text slug filters=trim
    text session_id filters=trim
    text source? filters=trim
    text search_params? filters=trim
    text viewed_at? filters=trim
    json metadata?
  }

  stack {
    precondition ($input.slug != "" && $input.session_id != "") {
      error_type = "inputerror"
      error = "slug and session_id are required"
    }

    var $dedupe_after {
      value = now|add_secs_to_timestamp:-600
    }

    db.query listing_views {
      where = (($db.listing_views.slug == $input.slug) && ($db.listing_views.session_id == $input.session_id) && ($db.listing_views.created_at >= $dedupe_after))
      sort = {listing_views.created_at: "desc"}
      return = {type: "single"}
    } as $recent_view

    var $result {
      value = {
        success: true
        tracked: false
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

        var $car_id {
          value = $input.car_id
        }

        conditional {
          if ($car_id == 0) {
            var.update $car_id {
              value = null
            }
          }
        }

        db.add listing_views {
          data = {
            created_at   : "now"
            updated_at   : "now"
            car_id       : $car_id
            slug         : $input.slug
            session_id   : $input.session_id
            user_id      : null
            source       : $input.source
            search_params: $input.search_params
            viewed_at    : $viewed_at
            user_agent   : ""
            ip_hash      : ""
            metadata     : $input.metadata
          }
        } as $view

        var.update $result {
          value = {
            success: true
            tracked: true
            deduped: false
            view_id: $view.id
          }
        }
      }
    }
  }

  response = $result
  tags = ["sitecraft-auto-market", "analytics", "listing-view"]
}

// Live test, 2026-07-11:
// First request:
// {"success":true,"tracked":true,"deduped":false,"view_id":3}
// Immediate repeated request:
// {"success":true,"deduped":true,"tracked":false,"message":"View already tracked recently"}
