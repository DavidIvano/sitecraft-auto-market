query "deal-finder/stats" verb=GET {
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

    db.query deal_finder_listings {
      where = ($db.deal_finder_listings.user_id == $current_user.id)
      return = {type: "list"}
    } as $owner_listings

    var $active { value = 0 }
    var $new { value = 0 }
    var $saved { value = 0 }
    var $hidden { value = 0 }
    var $hot { value = 0 }
    var $analysis_pending { value = 0 }
    var $source_removed { value = 0 }

    foreach ($owner_listings) {
      each as $listing {
        conditional {
          if (($listing.source_status == "active") && ($listing.is_hidden != true)) {
            var.update $active { value = $active + 1 }
          }
        }
        conditional {
          if (($listing.is_new == true) && ($listing.is_hidden != true)) {
            var.update $new { value = $new + 1 }
          }
        }
        conditional {
          if ($listing.is_saved == true) {
            var.update $saved { value = $saved + 1 }
          }
        }
        conditional {
          if ($listing.is_hidden == true) {
            var.update $hidden { value = $hidden + 1 }
          }
        }
        conditional {
          if ($listing.source_status == "source_removed") {
            var.update $source_removed { value = $source_removed + 1 }
          }
        }

        db.query deal_finder_analyses {
          where = (($db.deal_finder_analyses.listing_id == $listing.id) && ($db.deal_finder_analyses.status == "completed"))
          sort = {deal_finder_analyses.completed_at: "desc"}
          return = {type: "single"}
        } as $completed_analysis

        db.query deal_finder_analyses {
          where = (($db.deal_finder_analyses.listing_id == $listing.id) && (($db.deal_finder_analyses.status == "pending") || ($db.deal_finder_analyses.status == "processing")))
          sort = {deal_finder_analyses.created_at: "desc"}
          return = {type: "single"}
        } as $active_analysis

        conditional {
          if (($completed_analysis != null) && ($completed_analysis.deal_score >= 80)) {
            var.update $hot { value = $hot + 1 }
          }
        }
        conditional {
          if ($active_analysis != null) {
            var.update $analysis_pending { value = $analysis_pending + 1 }
          }
        }
      }
    }

    db.query deal_finder_searches {
      where = ($db.deal_finder_searches.user_id == $current_user.id)
      sort = {deal_finder_searches.last_sync_at: "desc"}
      return = {type: "single"}
    } as $latest_search

    var $last_sync_at {
      value = null
    }

    conditional {
      if ($latest_search != null) {
        var.update $last_sync_at {
          value = $latest_search.last_sync_at
        }
      }
    }
  }

  response = {
    active          : $active
    new             : $new
    saved           : $saved
    hidden          : $hidden
    hot             : $hot
    analysis_pending: $analysis_pending
    source_removed  : $source_removed
    last_sync_at    : $last_sync_at
  }
  tags = ["deal-finder", "frontend", "owner-only", "stats"]
}
