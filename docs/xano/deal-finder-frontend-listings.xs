query "deal-finder/listings" verb=GET {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    int page?=1 filters=min:1
    int per_page?=100 filters=min:1|max:100
    text search?="" filters=trim
    text search_id?="" filters=trim
    text brand?="" filters=trim
    text model?="" filters=trim
    text price_min?="" filters=trim
    text price_max?="" filters=trim
    text year_min?="" filters=trim
    text year_max?="" filters=trim
    text mileage_max?="" filters=trim
    text fuel_type?="" filters=trim
    text transmission?="" filters=trim
    text source_status?="active" filters=trim|lower
    text user_status?="" filters=trim|lower
    text deal_score_min?="" filters=trim
    text deal_score_max?="" filters=trim
    text is_saved?="" filters=trim|lower
    text is_new?="" filters=trim|lower
    text is_hidden?="false" filters=trim|lower
    text sort?="newest" filters=trim|lower
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

    precondition (($input.sort == "newest") || ($input.sort == "oldest") || ($input.sort == "price_asc") || ($input.sort == "price_desc") || ($input.sort == "deal_score_desc") || ($input.sort == "deal_score_asc") || ($input.sort == "profit_desc") || ($input.sort == "last_checked_asc")) {
      error_type = "inputerror"
      error = "Invalid sort"
    }

    // Parse optional numeric text once before the database expression. This keeps
    // empty query parameters out of SQL casts while preserving nullable filters.
    var $search_id { value = 0 }
    var $price_min { value = 0 }
    var $price_max { value = 0 }
    var $year_min { value = 0 }
    var $year_max { value = 0 }
    var $mileage_max { value = 0 }
    var $deal_score_min { value = 0 }
    var $deal_score_max { value = 100 }
    conditional {
      if ($input.search_id != "") {
        var.update $search_id {
          value = $input.search_id|to_int
        }
      }
    }
    conditional {
      if ($input.price_min != "") {
        var.update $price_min {
          value = $input.price_min|to_decimal
        }
      }
    }
    conditional {
      if ($input.price_max != "") {
        var.update $price_max {
          value = $input.price_max|to_decimal
        }
      }
    }
    conditional {
      if ($input.year_min != "") {
        var.update $year_min {
          value = $input.year_min|to_int
        }
      }
    }
    conditional {
      if ($input.year_max != "") {
        var.update $year_max {
          value = $input.year_max|to_int
        }
      }
    }
    conditional {
      if ($input.mileage_max != "") {
        var.update $mileage_max {
          value = $input.mileage_max|to_int
        }
      }
    }
    conditional {
      if ($input.deal_score_min != "") {
        var.update $deal_score_min {
          value = $input.deal_score_min|to_int
        }
      }
    }
    conditional {
      if ($input.deal_score_max != "") {
        var.update $deal_score_max {
          value = $input.deal_score_max|to_int
        }
      }
    }

    var $paged { value = null }
    conditional {
      if ($input.sort == "oldest") {
        db.query deal_finder_listings {
          where = (($db.deal_finder_listings.user_id == $current_user.id)
            && (($input.search_id == "") || ($db.deal_finder_listings.search_id == $search_id))
            && (($input.brand == "") || ($db.deal_finder_listings.brand == $input.brand))
            && (($input.model == "") || ($db.deal_finder_listings.model == $input.model))
            && (($input.price_min == "") || ($db.deal_finder_listings.price >= $price_min))
            && (($input.price_max == "") || ($db.deal_finder_listings.price <= $price_max))
            && (($input.year_min == "") || ($db.deal_finder_listings.year >= $year_min))
            && (($input.year_max == "") || ($db.deal_finder_listings.year <= $year_max))
            && (($input.mileage_max == "") || ($db.deal_finder_listings.mileage <= $mileage_max))
            && (($input.fuel_type == "") || ($db.deal_finder_listings.fuel_type == $input.fuel_type))
            && (($input.transmission == "") || ($db.deal_finder_listings.transmission == $input.transmission))
            && (($input.source_status == "") || ($db.deal_finder_listings.source_status == $input.source_status))
            && (($input.user_status == "") || ($db.deal_finder_listings.user_status == $input.user_status))
            && (($input.is_saved == "") || (($input.is_saved == "true") && ($db.deal_finder_listings.is_saved == true)) || (($input.is_saved == "false") && ($db.deal_finder_listings.is_saved == false)))
            && (($input.is_new == "") || (($input.is_new == "true") && ($db.deal_finder_listings.is_new == true)) || (($input.is_new == "false") && ($db.deal_finder_listings.is_new == false)))
            && ((($input.is_hidden == "true") && ($db.deal_finder_listings.is_hidden == true)) || (($input.is_hidden == "false") && ($db.deal_finder_listings.is_hidden == false)))
            && (($input.search == "") || (($db.deal_finder_listings.title includes $input.search) || ($db.deal_finder_listings.brand includes $input.search) || ($db.deal_finder_listings.model includes $input.search) || ($db.deal_finder_listings.city includes $input.search))))
          sort = {deal_finder_listings.first_seen_at: "asc"}
          return = {type: "list", paging: {page: $input.page, per_page: $input.per_page, totals: true, metadata: true}}
        } as $oldest_page
        var.update $paged { value = $oldest_page }
      }
      elseif ($input.sort == "price_asc") {
        db.query deal_finder_listings {
          where = (($db.deal_finder_listings.user_id == $current_user.id)
            && (($input.search_id == "") || ($db.deal_finder_listings.search_id == $search_id))
            && (($input.brand == "") || ($db.deal_finder_listings.brand == $input.brand))
            && (($input.model == "") || ($db.deal_finder_listings.model == $input.model))
            && (($input.price_min == "") || ($db.deal_finder_listings.price >= $price_min))
            && (($input.price_max == "") || ($db.deal_finder_listings.price <= $price_max))
            && (($input.year_min == "") || ($db.deal_finder_listings.year >= $year_min))
            && (($input.year_max == "") || ($db.deal_finder_listings.year <= $year_max))
            && (($input.mileage_max == "") || ($db.deal_finder_listings.mileage <= $mileage_max))
            && (($input.fuel_type == "") || ($db.deal_finder_listings.fuel_type == $input.fuel_type))
            && (($input.transmission == "") || ($db.deal_finder_listings.transmission == $input.transmission))
            && (($input.source_status == "") || ($db.deal_finder_listings.source_status == $input.source_status))
            && (($input.user_status == "") || ($db.deal_finder_listings.user_status == $input.user_status))
            && (($input.is_saved == "") || (($input.is_saved == "true") && ($db.deal_finder_listings.is_saved == true)) || (($input.is_saved == "false") && ($db.deal_finder_listings.is_saved == false)))
            && (($input.is_new == "") || (($input.is_new == "true") && ($db.deal_finder_listings.is_new == true)) || (($input.is_new == "false") && ($db.deal_finder_listings.is_new == false)))
            && ((($input.is_hidden == "true") && ($db.deal_finder_listings.is_hidden == true)) || (($input.is_hidden == "false") && ($db.deal_finder_listings.is_hidden == false)))
            && (($input.search == "") || (($db.deal_finder_listings.title includes $input.search) || ($db.deal_finder_listings.brand includes $input.search) || ($db.deal_finder_listings.model includes $input.search) || ($db.deal_finder_listings.city includes $input.search))))
          sort = {deal_finder_listings.price: "asc"}
          return = {type: "list", paging: {page: $input.page, per_page: $input.per_page, totals: true, metadata: true}}
        } as $price_asc_page
        var.update $paged { value = $price_asc_page }
      }
      elseif ($input.sort == "price_desc") {
        db.query deal_finder_listings {
          where = (($db.deal_finder_listings.user_id == $current_user.id)
            && (($input.search_id == "") || ($db.deal_finder_listings.search_id == $search_id))
            && (($input.brand == "") || ($db.deal_finder_listings.brand == $input.brand))
            && (($input.model == "") || ($db.deal_finder_listings.model == $input.model))
            && (($input.price_min == "") || ($db.deal_finder_listings.price >= $price_min))
            && (($input.price_max == "") || ($db.deal_finder_listings.price <= $price_max))
            && (($input.year_min == "") || ($db.deal_finder_listings.year >= $year_min))
            && (($input.year_max == "") || ($db.deal_finder_listings.year <= $year_max))
            && (($input.mileage_max == "") || ($db.deal_finder_listings.mileage <= $mileage_max))
            && (($input.fuel_type == "") || ($db.deal_finder_listings.fuel_type == $input.fuel_type))
            && (($input.transmission == "") || ($db.deal_finder_listings.transmission == $input.transmission))
            && (($input.source_status == "") || ($db.deal_finder_listings.source_status == $input.source_status))
            && (($input.user_status == "") || ($db.deal_finder_listings.user_status == $input.user_status))
            && (($input.is_saved == "") || (($input.is_saved == "true") && ($db.deal_finder_listings.is_saved == true)) || (($input.is_saved == "false") && ($db.deal_finder_listings.is_saved == false)))
            && (($input.is_new == "") || (($input.is_new == "true") && ($db.deal_finder_listings.is_new == true)) || (($input.is_new == "false") && ($db.deal_finder_listings.is_new == false)))
            && ((($input.is_hidden == "true") && ($db.deal_finder_listings.is_hidden == true)) || (($input.is_hidden == "false") && ($db.deal_finder_listings.is_hidden == false)))
            && (($input.search == "") || (($db.deal_finder_listings.title includes $input.search) || ($db.deal_finder_listings.brand includes $input.search) || ($db.deal_finder_listings.model includes $input.search) || ($db.deal_finder_listings.city includes $input.search))))
          sort = {deal_finder_listings.price: "desc"}
          return = {type: "list", paging: {page: $input.page, per_page: $input.per_page, totals: true, metadata: true}}
        } as $price_desc_page
        var.update $paged { value = $price_desc_page }
      }
      elseif ($input.sort == "last_checked_asc") {
        db.query deal_finder_listings {
          where = (($db.deal_finder_listings.user_id == $current_user.id)
            && (($input.search_id == "") || ($db.deal_finder_listings.search_id == $search_id))
            && (($input.brand == "") || ($db.deal_finder_listings.brand == $input.brand))
            && (($input.model == "") || ($db.deal_finder_listings.model == $input.model))
            && (($input.price_min == "") || ($db.deal_finder_listings.price >= $price_min))
            && (($input.price_max == "") || ($db.deal_finder_listings.price <= $price_max))
            && (($input.year_min == "") || ($db.deal_finder_listings.year >= $year_min))
            && (($input.year_max == "") || ($db.deal_finder_listings.year <= $year_max))
            && (($input.mileage_max == "") || ($db.deal_finder_listings.mileage <= $mileage_max))
            && (($input.fuel_type == "") || ($db.deal_finder_listings.fuel_type == $input.fuel_type))
            && (($input.transmission == "") || ($db.deal_finder_listings.transmission == $input.transmission))
            && (($input.source_status == "") || ($db.deal_finder_listings.source_status == $input.source_status))
            && (($input.user_status == "") || ($db.deal_finder_listings.user_status == $input.user_status))
            && (($input.is_saved == "") || (($input.is_saved == "true") && ($db.deal_finder_listings.is_saved == true)) || (($input.is_saved == "false") && ($db.deal_finder_listings.is_saved == false)))
            && (($input.is_new == "") || (($input.is_new == "true") && ($db.deal_finder_listings.is_new == true)) || (($input.is_new == "false") && ($db.deal_finder_listings.is_new == false)))
            && ((($input.is_hidden == "true") && ($db.deal_finder_listings.is_hidden == true)) || (($input.is_hidden == "false") && ($db.deal_finder_listings.is_hidden == false)))
            && (($input.search == "") || (($db.deal_finder_listings.title includes $input.search) || ($db.deal_finder_listings.brand includes $input.search) || ($db.deal_finder_listings.model includes $input.search) || ($db.deal_finder_listings.city includes $input.search))))
          sort = {deal_finder_listings.last_checked_at: "asc"}
          return = {type: "list", paging: {page: $input.page, per_page: $input.per_page, totals: true, metadata: true}}
        } as $checked_page
        var.update $paged { value = $checked_page }
      }
      else {
        db.query deal_finder_listings {
          where = (($db.deal_finder_listings.user_id == $current_user.id)
            && (($input.search_id == "") || ($db.deal_finder_listings.search_id == $search_id))
            && (($input.brand == "") || ($db.deal_finder_listings.brand == $input.brand))
            && (($input.model == "") || ($db.deal_finder_listings.model == $input.model))
            && (($input.price_min == "") || ($db.deal_finder_listings.price >= $price_min))
            && (($input.price_max == "") || ($db.deal_finder_listings.price <= $price_max))
            && (($input.year_min == "") || ($db.deal_finder_listings.year >= $year_min))
            && (($input.year_max == "") || ($db.deal_finder_listings.year <= $year_max))
            && (($input.mileage_max == "") || ($db.deal_finder_listings.mileage <= $mileage_max))
            && (($input.fuel_type == "") || ($db.deal_finder_listings.fuel_type == $input.fuel_type))
            && (($input.transmission == "") || ($db.deal_finder_listings.transmission == $input.transmission))
            && (($input.source_status == "") || ($db.deal_finder_listings.source_status == $input.source_status))
            && (($input.user_status == "") || ($db.deal_finder_listings.user_status == $input.user_status))
            && (($input.is_saved == "") || (($input.is_saved == "true") && ($db.deal_finder_listings.is_saved == true)) || (($input.is_saved == "false") && ($db.deal_finder_listings.is_saved == false)))
            && (($input.is_new == "") || (($input.is_new == "true") && ($db.deal_finder_listings.is_new == true)) || (($input.is_new == "false") && ($db.deal_finder_listings.is_new == false)))
            && ((($input.is_hidden == "true") && ($db.deal_finder_listings.is_hidden == true)) || (($input.is_hidden == "false") && ($db.deal_finder_listings.is_hidden == false)))
            && (($input.search == "") || (($db.deal_finder_listings.title includes $input.search) || ($db.deal_finder_listings.brand includes $input.search) || ($db.deal_finder_listings.model includes $input.search) || ($db.deal_finder_listings.city includes $input.search))))
          sort = {deal_finder_listings.first_seen_at: "desc"}
          return = {type: "list", paging: {page: $input.page, per_page: $input.per_page, totals: true, metadata: true}}
        } as $newest_page
        var.update $paged { value = $newest_page }
      }
    }

    var $data { value = [] }
    foreach ($paged.items) {
      each as $listing {
        db.query deal_finder_analyses {
          where = (($db.deal_finder_analyses.listing_id == $listing.id) && ($db.deal_finder_analyses.status == "completed"))
          sort = {deal_finder_analyses.completed_at: "desc"}
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
                analysis_version: $analysis.analysis_version,
                completed_at: $analysis.completed_at, analyzed_at: $analysis.analyzed_at
              }
            }
          }
        }

        var $include { value = true }
        conditional {
          if (($input.deal_score_min != "") && (($analysis == null) || ($analysis.deal_score < $deal_score_min))) {
            var.update $include { value = false }
          }
        }
        conditional {
          if (($input.deal_score_max != "") && (($analysis == null) || ($analysis.deal_score > $deal_score_max))) {
            var.update $include { value = false }
          }
        }

        conditional {
          if ($include == true) {
            array.push $data {
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
                is_hidden: $listing.is_hidden, analysis: $safe_analysis
              }
            }
          }
        }
      }
    }
  }

  response = {
    data: $data
    pagination: {
      page: $paged.curPage
      per_page: $paged.perPage
      total: $paged.itemsTotal
      total_pages: $paged.pageTotal
      has_next: ($paged.nextPage != null)
      has_previous: ($paged.prevPage != null)
    }
  }
  tags = ["deal-finder", "frontend", "owner-only", "list"]
}
