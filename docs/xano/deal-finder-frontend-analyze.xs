query "deal-finder/listings/{id}/analyze" verb=POST {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    int id filters=min:1
    bool force?
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
    precondition ($listing.source_status == "active") {
      error_type = "inputerror"
      error = "Listing source is not active"
    }

    var $analysis_version { value = "deal-finder-v1" }
    var $model { value = $env.OPENAI_DEAL_FINDER_MODEL }
    conditional { if (($model == null) || ($model == "")) { var.update $model { value = $env.OPENAI_DEFAULT_MODEL } } }
    conditional { if (($model == null) || ($model == "")) { var.update $model { value = "gpt-5.6-luna" } } }
    var $input_snapshot {
      value = {
        id: $listing.id, content_hash: $listing.content_hash, title: $listing.title,
        description: $listing.description, price: $listing.price, currency: $listing.currency,
        brand: $listing.brand, model: $listing.model, variant: $listing.variant,
        year: $listing.year, mileage: $listing.mileage, fuel_type: $listing.fuel_type,
        transmission: $listing.transmission, power_kw: $listing.power_kw, power_hp: $listing.power_hp,
        engine_volume: $listing.engine_volume, body_type: $listing.body_type, city: $listing.city,
        postal_code: $listing.postal_code, published_at: $listing.published_at,
        first_seen_at: $listing.first_seen_at
      }
    }
    var $input_hash { value = $listing.content_hash }

    db.query deal_finder_analyses {
      where = (($db.deal_finder_analyses.user_id == $current_user.id) && ($db.deal_finder_analyses.listing_id == $listing.id) && ($db.deal_finder_analyses.input_hash == $input_hash) && ($db.deal_finder_analyses.analysis_version == $analysis_version) && (($db.deal_finder_analyses.status == "pending") || ($db.deal_finder_analyses.status == "processing")))
      sort = {deal_finder_analyses.created_at: "desc"}
      return = {type: "single"}
    } as $active_analysis
    db.query deal_finder_analyses {
      where = (($db.deal_finder_analyses.user_id == $current_user.id) && ($db.deal_finder_analyses.listing_id == $listing.id) && ($db.deal_finder_analyses.input_hash == $input_hash) && ($db.deal_finder_analyses.analysis_version == $analysis_version) && ($db.deal_finder_analyses.status == "completed"))
      sort = {deal_finder_analyses.completed_at: "desc"}
      return = {type: "single"}
    } as $completed_analysis

    var $analysis { value = null }
    var $reused { value = false }
    conditional {
      if ($active_analysis != null) {
        var.update $analysis { value = $active_analysis }
        var.update $reused { value = true }
      }
      elseif (($completed_analysis != null) && ($input.force != true)) {
        var.update $analysis { value = $completed_analysis }
        var.update $reused { value = true }
      }
      else {
        db.query user_credits {
          where = ($db.user_credits.user_id == $current_user.id)
          return = {type: "single"}
        } as $wallet
        precondition (($wallet != null) && (($wallet.ai_credits|first_notnull:0|to_int) >= 1)) {
          error_type = "accessdenied"
          error = "INSUFFICIENT_CREDITS"
        }
        db.add deal_finder_analyses {
          data = {
            created_at: "now", updated_at: "now", user_id: $current_user.id, listing_id: $listing.id,
            status: "pending", analysis_status: "pending", analysis_version: $analysis_version,
            model: $model, model_used: $model, input_hash: $input_hash,
            listing_content_hash: $listing.content_hash, input_snapshot: $input_snapshot,
            positive_signals: [], negative_signals: [], missing_information: [], known_defects: [],
            recommended_questions: [], input_tokens: 0, output_tokens: 0, total_tokens: 0,
            retry_count: 0
          }
        } as $created_analysis
        var.update $analysis { value = $created_analysis }
      }
    }
  }

  response = {analysis: {id: $analysis.id, listing_id: $analysis.listing_id, status: $analysis.status, created_at: $analysis.created_at, reused: $reused, credits_required: 1}}
  tags = ["deal-finder", "frontend", "owner-only", "analysis-queue", "credits-precheck"]
}
