// Worker-only endpoint. It returns identifiers only and never listing content.
query "deal-finder/internal/listings/existing-ids" verb=POST {
  api_group = "sitecraft-auto-market"

  input {
    text platform filters=trim|lower
    int search_id filters=min:1
    json external_ids
  }

  stack {
    var $provided_secret {
      value = $env.$http_headers."X-Deal-Finder-Secret"|first_notnull:""|to_text
    }

    precondition (($provided_secret != "") && ($provided_secret == "__DEAL_FINDER_SECRET_RAW__")) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }

    precondition (($input.platform != "") && (($input.external_ids|count) <= 100)) {
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

    var $existing_ids {
      value = []
    }

    foreach ($input.external_ids) {
      each as $external_id {
        var $normalized_id {
          value = $external_id|to_text|trim
        }

        conditional {
          if ($normalized_id != "") {
            db.query deal_finder_listings {
              where = (($db.deal_finder_listings.user_id == $search.user_id) && ($db.deal_finder_listings.platform == $input.platform) && ($db.deal_finder_listings.external_id == $normalized_id))
              return = {type: "single"}
            } as $existing

            conditional {
              if ($existing != null) {
                array.push $existing_ids {
                  value = $normalized_id
                }
              }
            }
          }
        }
      }
    }
  }

  response = {existing_ids: $existing_ids}
  tags = ["deal-finder", "internal", "worker", "dedupe"]
}
