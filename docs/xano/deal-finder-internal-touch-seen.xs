// Worker-only endpoint for existing provider listings. It updates discovery
// timestamps/status only and never accepts listing content or user flags.
query "deal-finder/internal/listings/touch-seen" verb=POST {
  api_group = "sitecraft-auto-market"

  input {
    text platform filters=trim|lower
    int search_id filters=min:1
    timestamp seen_at
    json external_ids
    bool log_sync?
    json sync_metadata?
  }

  stack {
    var $provided_secret {
      value = $env.$http_headers."X-Deal-Finder-Secret"|first_notnull:""|to_text
    }

    precondition (($provided_secret != "") && ($provided_secret == "__DEAL_FINDER_SECRET_RAW__")) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }

    precondition (($input.platform == "kleinanzeigen") && (($input.external_ids|count) <= 100)) {
      error_type = "inputerror"
      error = "Invalid request"
    }

    var $normalized_ids { value = [] }

    foreach ($input.external_ids) {
      each as $external_id {
        var $normalized_id { value = $external_id|to_text|trim }
        conditional {
          if ($normalized_id != "") {
            array.push $normalized_ids { value = $normalized_id }
          }
        }
      }
    }

    var.update $normalized_ids { value = $normalized_ids|unique }

    precondition ((($normalized_ids|count) > 0) && (($normalized_ids|count) <= 100)) {
      error_type = "inputerror"
      error = "Invalid request"
    }

    db.get deal_finder_searches {
      field_name = "id"
      field_value = $input.search_id
    } as $search

    precondition (($search != null) && ($search.source_type == "kleinanzeigen_agent")) {
      error_type = "notfound"
      error = "Search profile not found"
    }

    var $touched { value = 0 }
    var $missing_external_ids { value = [] }

    foreach ($normalized_ids) {
      each as $external_id {
        db.query deal_finder_listings {
          where = (($db.deal_finder_listings.platform == $input.platform) && ($db.deal_finder_listings.external_id == $external_id) && ($db.deal_finder_listings.user_id == $search.user_id))
          return = {type: "single"}
        } as $existing

        conditional {
          if ($existing != null) {
            db.edit deal_finder_listings {
              field_name = "id"
              field_value = $existing.id
              data = {
                last_seen_at      : $input.seen_at
                last_checked_at   : $input.seen_at
                source_status     : "active"
                unavailable_checks: 0
              }
            } as $touched_listing

            var.update $touched { value = $touched + 1 }
          }

          else {
            array.push $missing_external_ids { value = $external_id }
          }
        }
      }
    }

    conditional {
      if ($input.log_sync == true) {
        db.add deal_finder_sync_logs {
          data = {
            created_at        : "now"
            job_type          : "manual_seed"
            status            : "completed"
            emails_found      : 0
            emails_processed  : 0
            listings_found    : ($input.sync_metadata|get:"candidates_found":($normalized_ids|count))
            listings_created  : 0
            listings_updated  : 0
            duplicates_found  : ($input.sync_metadata|get:"existing_candidates":$touched)
            listings_removed  : 0
            error_message     : null
            metadata          : {
              source_type       : "kleinanzeigen_agent"
              search_id         : $search.id
              candidates_found  : ($input.sync_metadata|get:"candidates_found":($normalized_ids|count))
              new_candidates    : ($input.sync_metadata|get:"new_candidates":0)
              existing_candidates: ($input.sync_metadata|get:"existing_candidates":$touched)
              details_fetched   : ($input.sync_metadata|get:"details_fetched":0)
              detail_failures   : ($input.sync_metadata|get:"detail_failures":0)
              created           : 0
              updated           : 0
              touched           : $touched
              rejected          : ($input.sync_metadata|get:"rejected":0)
            }
            started_at        : $input.seen_at
            finished_at       : "now"
          }
        } as $sync_log
      }
    }
  }

  response = {
    touched             : $touched
    missing             : ($missing_external_ids|count)
    missing_external_ids: $missing_external_ids
  }

  tags = ["deal-finder", "internal", "worker", "touch-seen"]
}
