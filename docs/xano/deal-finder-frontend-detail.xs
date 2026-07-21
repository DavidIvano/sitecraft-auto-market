query "deal-finder/listings/{id}" verb=GET {
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

    db.query deal_finder_analyses {
      where = ($db.deal_finder_analyses.listing_id == $listing.id)
      sort = {deal_finder_analyses.created_at: "desc"}
      return = {type: "single"}
    } as $analysis

    var $safe_analysis { value = null }
    conditional {
      if ($analysis != null) {
        var.update $safe_analysis {
          value = {
            id: $analysis.id, listing_id: $analysis.listing_id,
            status: $analysis.status, deal_score: $analysis.deal_score,
            risk_score: $analysis.risk_score, liquidity_score: $analysis.liquidity_score,
            data_quality_score: $analysis.data_quality_score, confidence_score: $analysis.confidence_score,
            positive_signals: $analysis.positive_signals, negative_signals: $analysis.negative_signals,
            missing_information: $analysis.missing_information,
            known_defects: $analysis.known_defects,
            recommended_questions: $analysis.recommended_questions,
            recommendation: $analysis.recommendation, ai_summary: $analysis.ai_summary,
            analysis_status: $analysis.status, model: $analysis.model,
            analysis_version: $analysis.analysis_version, started_at: $analysis.started_at,
            completed_at: $analysis.completed_at, failed_at: $analysis.failed_at,
            analyzed_at: $analysis.analyzed_at, error_code: $analysis.error_code,
            retry_count: $analysis.retry_count, created_at: $analysis.created_at
          }
        }
      }
    }

    db.query deal_finder_searches {
      where = (($db.deal_finder_searches.id == $listing.search_id) && ($db.deal_finder_searches.user_id == $current_user.id))
      return = {type: "single"}
    } as $search

    var $safe_listing {
      value = {
        id: $listing.id, platform: $listing.platform, external_id: $listing.external_id,
        source_url: $listing.source_url, title: $listing.title, description: $listing.description,
        price: $listing.price, currency: $listing.currency, brand: $listing.brand, model: $listing.model,
        variant: $listing.variant, year: $listing.year, mileage: $listing.mileage,
        fuel_type: $listing.fuel_type, transmission: $listing.transmission,
        power_kw: $listing.power_kw, power_hp: $listing.power_hp, engine_volume: $listing.engine_volume,
        body_type: $listing.body_type, color: $listing.color, city: $listing.city,
        postal_code: $listing.postal_code, distance_km: $listing.distance_km,
        source_image_url: $listing.source_image_url, source_images: $listing.source_images,
        image_status: $listing.image_status, published_at: $listing.published_at,
        first_seen_at: $listing.first_seen_at, last_seen_at: $listing.last_seen_at,
        last_checked_at: $listing.last_checked_at, source_status: $listing.source_status,
        user_status: $listing.user_status, unavailable_checks: $listing.unavailable_checks,
        is_new: $listing.is_new, is_saved: $listing.is_saved, is_viewed: $listing.is_viewed,
        is_hidden: $listing.is_hidden
      }
    }
    var $safe_search {
      value = {
        id: $search.id, name: $search.name, platform: $search.platform, source_type: $search.source_type,
        price_min: $search.price_min, price_max: $search.price_max, postal_code: $search.postal_code,
        location_id: $search.location_id, location_name: $search.location_name, category_id: $search.category_id,
        radius_km: $search.radius_km, sync_enabled: $search.sync_enabled, is_active: $search.is_active,
        last_sync_at: $search.last_sync_at, last_sync_status: $search.last_sync_status
      }
    }
  }

  response = {
    listing: $safe_listing
    analysis: $safe_analysis
    search: $safe_search
    allowed_actions: {view: true, save: true, hide: true, reanalyze: true}
  }
  tags = ["deal-finder", "frontend", "owner-only", "detail"]
}
