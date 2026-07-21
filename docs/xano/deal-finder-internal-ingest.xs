// Worker-only, isolated ingestion. This endpoint never writes car_listings,
// downloads images, invokes AI, or mutates owner-managed flags on updates.
query "deal-finder/internal/listings/ingest" verb=POST {
  api_group = "sitecraft-auto-market"

  input {
    text source_type filters=trim|lower
    int search_id filters=min:1
    timestamp? fetched_at
    json listings
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

    precondition (($input.source_type == "kleinanzeigen_agent") && (($input.listings|count) <= 100)) {
      error_type = "inputerror"
      error = "Invalid request"
    }

    db.get deal_finder_searches {
      field_name = "id"
      field_value = $input.search_id
    } as $search

    precondition (($search != null) && ($search.is_active == true) && ($search.source_type == $input.source_type)) {
      error_type = "notfound"
      error = "Search profile not found"
    }

    var $created { value = 0 }
    var $updated { value = 0 }
    var $duplicates { value = 0 }
    var $rejected { value = 0 }
    var $created_listing_ids { value = [] }
    var $seen_at { value = $input.fetched_at|first_notnull:"now" }

    foreach ($input.listings) {
      each as $listing {
        var $platform { value = $listing|get:"platform":""|to_text|trim|to_lower }
        var $external_id { value = $listing|get:"external_id":""|to_text|trim }
        var $source_url { value = $listing|get:"source_url":""|to_text|trim }
        var $title { value = $listing|get:"title":""|to_text|trim }
        var $content_hash { value = $listing|get:"content_hash":""|to_text|trim }
        var $data_level { value = $listing|get:"data_level":"search"|to_text|trim|to_lower }
        var $provider_detail_loaded { value = $listing|get:"provider_detail_loaded":false }
        var $provider_detail_fetched_at { value = $listing|get:"provider_detail_fetched_at":null }
        var $source_image_url { value = $listing|get:"source_image_url":null }
        var $image_status { value = "placeholder" }
        var $valid_listing {
          value = (($platform == "kleinanzeigen") && ($external_id != "") && ($title != "") && ($source_url|starts_with:"https://"))
        }

        conditional {
          if (($source_image_url != null) && (($source_image_url|to_text)|starts_with:"https://")) {
            var.update $image_status { value = "available" }
          }
        }

        conditional {
          if ($valid_listing != true) {
            var.update $rejected { value = $rejected + 1 }
          }

          else {
            db.query deal_finder_listings {
              where = (($db.deal_finder_listings.user_id == $search.user_id) && ($db.deal_finder_listings.platform == $platform) && ($db.deal_finder_listings.external_id == $external_id))
              return = {type: "single"}
            } as $existing

            conditional {
              if ($existing != null) {
                conditional {
                  if ($data_level == "search") {
                    // Defense in depth: a search-level record may refresh only
                    // safe discovery state. It can never replace detail fields.
                    db.edit deal_finder_listings {
                      field_name = "id"
                      field_value = $existing.id
                      data = {
                        updated_at        : "now"
                        last_seen_at      : $seen_at
                        source_status     : "active"
                        unavailable_checks: 0
                      }
                    } as $search_seen

                    var.update $duplicates { value = $duplicates + 1 }
                  }

                  elseif (($data_level == "detail") && ($provider_detail_loaded == true) && ($content_hash != "") && ($existing.content_hash == $content_hash)) {
                    db.edit deal_finder_listings {
                      field_name = "id"
                      field_value = $existing.id
                      data = {
                        updated_at   : "now"
                        last_seen_at : $seen_at
                        source_status: "active"
                        unavailable_checks: 0
                      }
                    } as $duplicate_seen

                    var.update $duplicates { value = $duplicates + 1 }
                  }

                  elseif (($data_level == "detail") && ($provider_detail_loaded == true)) {
                    db.edit deal_finder_listings {
                      field_name = "id"
                      field_value = $existing.id
                      data = {
                        updated_at      : "now"
                        search_id       : $search.id
                        source_url      : $source_url
                        title           : $title
                        description     : ($listing|get:"description":null)
                        price           : ($listing|get:"price":null)
                        currency        : ($listing|get:"currency":"EUR")
                        brand           : ($listing|get:"brand":null)
                        model           : ($listing|get:"model":null)
                        variant         : ($listing|get:"variant":null)
                        year            : ($listing|get:"year":null)
                        mileage         : ($listing|get:"mileage":null)
                        fuel_type       : ($listing|get:"fuel_type":null)
                        transmission    : ($listing|get:"transmission":null)
                        power_kw        : ($listing|get:"power_kw":null)
                        power_hp        : ($listing|get:"power_hp":null)
                        city            : ($listing|get:"city":null)
                        postal_code     : ($listing|get:"postal_code":null)
                        source_image_url: $source_image_url
                        source_images   : ($listing|get:"source_images":[])
                        image_status    : $image_status
                        published_at    : ($listing|get:"published_at":null)
                        last_seen_at    : $seen_at
                        source_status   : "active"
                        unavailable_checks: 0
                        content_hash    : $content_hash
                        data_level      : "detail"
                        provider_detail_loaded: true
                        provider_detail_fetched_at: $provider_detail_fetched_at
                        raw_data        : ($listing|get:"raw_data":null)
                      }
                    } as $updated_listing

                    var.update $updated { value = $updated + 1 }
                  }

                  else {
                    var.update $rejected { value = $rejected + 1 }
                  }
                }
              }

              else {
                conditional {
                  if (($data_level == "detail") && ($provider_detail_loaded == true)) {
                    db.add deal_finder_listings {
                  data = {
                    created_at      : "now"
                    updated_at      : "now"
                    user_id         : $search.user_id
                    search_id       : $search.id
                    email_id        : null
                    platform        : $platform
                    external_id     : $external_id
                    source_url      : $source_url
                    title           : $title
                    description     : ($listing|get:"description":null)
                    price           : ($listing|get:"price":null)
                    currency        : ($listing|get:"currency":"EUR")
                    brand           : ($listing|get:"brand":null)
                    model           : ($listing|get:"model":null)
                    variant         : ($listing|get:"variant":null)
                    year            : ($listing|get:"year":null)
                    mileage         : ($listing|get:"mileage":null)
                    fuel_type       : ($listing|get:"fuel_type":null)
                    transmission    : ($listing|get:"transmission":null)
                    power_kw        : ($listing|get:"power_kw":null)
                    power_hp        : ($listing|get:"power_hp":null)
                    city            : ($listing|get:"city":null)
                    postal_code     : ($listing|get:"postal_code":null)
                    source_image_url: $source_image_url
                    source_images   : ($listing|get:"source_images":[])
                    image_status    : $image_status
                    published_at    : ($listing|get:"published_at":null)
                    first_seen_at   : $seen_at
                    last_seen_at    : $seen_at
                    last_checked_at : null
                    source_status   : "active"
                    user_status     : "new"
                    unavailable_checks: 0
                    is_new          : true
                    is_saved        : false
                    is_viewed       : false
                    is_hidden       : false
                    content_hash    : $content_hash
                    data_level      : "detail"
                    provider_detail_loaded: true
                    provider_detail_fetched_at: $provider_detail_fetched_at
                    raw_data        : ($listing|get:"raw_data":null)
                  }
                    } as $created_listing

                    array.push $created_listing_ids { value = $created_listing.id }
                    var.update $created { value = $created + 1 }
                  }

                  else {
                    var.update $rejected { value = $rejected + 1 }
                  }
                }
              }
            }
          }
        }
      }
    }

    db.add deal_finder_sync_logs {
      data = {
        created_at        : "now"
        job_type          : "manual_seed"
        status            : "completed"
        emails_found      : 0
        emails_processed  : 0
        listings_found    : ($input.sync_metadata|get:"candidates_found":($input.listings|count))
        listings_created  : $created
        listings_updated  : $updated
        duplicates_found  : $duplicates
        listings_removed  : 0
        error_message     : null
        metadata          : {
          source_type       : $input.source_type
          search_id         : $search.id
          candidates_found  : ($input.sync_metadata|get:"candidates_found":($input.listings|count))
          new_candidates    : ($input.sync_metadata|get:"new_candidates":($input.listings|count))
          existing_candidates: ($input.sync_metadata|get:"existing_candidates":0)
          details_fetched   : ($input.sync_metadata|get:"details_fetched":($input.listings|count))
          detail_failures   : ($input.sync_metadata|get:"detail_failures":0)
          created           : $created
          updated           : $updated
          touched           : ($input.sync_metadata|get:"touched":0)
          rejected          : $rejected
        }
        started_at        : $seen_at
        finished_at       : "now"
      }
    } as $sync_log
  }

  response = {
    created            : $created
    updated            : $updated
    duplicates         : $duplicates
    rejected           : $rejected
    created_listing_ids: $created_listing_ids
  }

  tags = ["deal-finder", "internal", "worker", "ingest"]
}
