// Bounded public recommendations for an existing public listing.
query "cars/{slug}/related" verb=GET {
  api_group = "sitecraft-auto-market"

  input {
    text slug
  }

  stack {
    db.get car_listings {
      field_name = "slug"
      field_value = $input.slug
    } as $car

    precondition ($car != null) {
      error_type = "notfound"
      error = "Listing not found"
    }

    var $is_public {
      value = ((($car.status == "approved") || ($car.status == "published") || ($car.status == "sold") || ($car.moderation_status == "approved") || ($car.moderation_status == "published") || ($car.moderation_status == "sold")) && (($car.status == null) || (($car.status != "draft") && ($car.status != "ai_draft") && ($car.status != "pending_review") && ($car.status != "needs_fix") && ($car.status != "rejected") && ($car.status != "blocked") && ($car.status != "deleted") && ($car.status != "archived"))) && (($car.moderation_status == null) || (($car.moderation_status != "draft") && ($car.moderation_status != "ai_draft") && ($car.moderation_status != "pending_review") && ($car.moderation_status != "needs_fix") && ($car.moderation_status != "rejected") && ($car.moderation_status != "blocked") && ($car.moderation_status != "deleted") && ($car.moderation_status != "archived"))))
    }

    precondition ($is_public) {
      error_type = "notfound"
      error = "Listing not found"
    }

    db.query car_listings {
      where = (($db.car_listings.id != $car.id) && (($car.user_id == null) || ($db.car_listings.user_id != $car.user_id)) && (($car.brand != null) && ($car.brand != "") && ($db.car_listings.brand == $car.brand)) && (($db.car_listings.status == "approved") || ($db.car_listings.status == "published") || ($db.car_listings.moderation_status == "approved") || ($db.car_listings.moderation_status == "published")) && (($db.car_listings.status == null) || (($db.car_listings.status != "draft") && ($db.car_listings.status != "ai_draft") && ($db.car_listings.status != "pending_review") && ($db.car_listings.status != "needs_fix") && ($db.car_listings.status != "rejected") && ($db.car_listings.status != "blocked") && ($db.car_listings.status != "deleted") && ($db.car_listings.status != "archived") && ($db.car_listings.status != "sold"))) && (($db.car_listings.moderation_status == null) || (($db.car_listings.moderation_status != "draft") && ($db.car_listings.moderation_status != "ai_draft") && ($db.car_listings.moderation_status != "pending_review") && ($db.car_listings.moderation_status != "needs_fix") && ($db.car_listings.moderation_status != "rejected") && ($db.car_listings.moderation_status != "blocked") && ($db.car_listings.moderation_status != "deleted") && ($db.car_listings.moderation_status != "archived") && ($db.car_listings.moderation_status != "sold"))))
      sort = {car_listings.created_at: "desc"}
      return = {type: "list", paging: {page: 1, per_page: 6}}
    } as $brand_candidates

    db.query car_listings {
      where = (($db.car_listings.id != $car.id) && (($car.user_id == null) || ($db.car_listings.user_id != $car.user_id)) && (($car.body_type != null) && ($car.body_type != "") && ($db.car_listings.body_type == $car.body_type)) && (($db.car_listings.status == "approved") || ($db.car_listings.status == "published") || ($db.car_listings.moderation_status == "approved") || ($db.car_listings.moderation_status == "published")) && (($db.car_listings.status == null) || (($db.car_listings.status != "draft") && ($db.car_listings.status != "ai_draft") && ($db.car_listings.status != "pending_review") && ($db.car_listings.status != "needs_fix") && ($db.car_listings.status != "rejected") && ($db.car_listings.status != "blocked") && ($db.car_listings.status != "deleted") && ($db.car_listings.status != "archived") && ($db.car_listings.status != "sold"))) && (($db.car_listings.moderation_status == null) || (($db.car_listings.moderation_status != "draft") && ($db.car_listings.moderation_status != "ai_draft") && ($db.car_listings.moderation_status != "pending_review") && ($db.car_listings.moderation_status != "needs_fix") && ($db.car_listings.moderation_status != "rejected") && ($db.car_listings.moderation_status != "blocked") && ($db.car_listings.moderation_status != "deleted") && ($db.car_listings.moderation_status != "archived") && ($db.car_listings.moderation_status != "sold"))))
      sort = {car_listings.created_at: "desc"}
      return = {type: "list", paging: {page: 1, per_page: 6}}
    } as $body_candidates

    db.query car_listings {
      where = (($db.car_listings.id != $car.id) && (($car.user_id == null) || ($db.car_listings.user_id != $car.user_id)) && (($car.fuel_type != null) && ($car.fuel_type != "") && ($db.car_listings.fuel_type == $car.fuel_type)) && (($db.car_listings.status == "approved") || ($db.car_listings.status == "published") || ($db.car_listings.moderation_status == "approved") || ($db.car_listings.moderation_status == "published")) && (($db.car_listings.status == null) || (($db.car_listings.status != "draft") && ($db.car_listings.status != "ai_draft") && ($db.car_listings.status != "pending_review") && ($db.car_listings.status != "needs_fix") && ($db.car_listings.status != "rejected") && ($db.car_listings.status != "blocked") && ($db.car_listings.status != "deleted") && ($db.car_listings.status != "archived") && ($db.car_listings.status != "sold"))) && (($db.car_listings.moderation_status == null) || (($db.car_listings.moderation_status != "draft") && ($db.car_listings.moderation_status != "ai_draft") && ($db.car_listings.moderation_status != "pending_review") && ($db.car_listings.moderation_status != "needs_fix") && ($db.car_listings.moderation_status != "rejected") && ($db.car_listings.moderation_status != "blocked") && ($db.car_listings.moderation_status != "deleted") && ($db.car_listings.moderation_status != "archived") && ($db.car_listings.moderation_status != "sold"))))
      sort = {car_listings.created_at: "desc"}
      return = {type: "list", paging: {page: 1, per_page: 6}}
    } as $fuel_candidates

    db.query car_listings {
      where = (($db.car_listings.id != $car.id) && (($car.user_id == null) || ($db.car_listings.user_id != $car.user_id)) && (($car.city != null) && ($car.city != "") && ($db.car_listings.city == $car.city)) && (($db.car_listings.status == "approved") || ($db.car_listings.status == "published") || ($db.car_listings.moderation_status == "approved") || ($db.car_listings.moderation_status == "published")) && (($db.car_listings.status == null) || (($db.car_listings.status != "draft") && ($db.car_listings.status != "ai_draft") && ($db.car_listings.status != "pending_review") && ($db.car_listings.status != "needs_fix") && ($db.car_listings.status != "rejected") && ($db.car_listings.status != "blocked") && ($db.car_listings.status != "deleted") && ($db.car_listings.status != "archived") && ($db.car_listings.status != "sold"))) && (($db.car_listings.moderation_status == null) || (($db.car_listings.moderation_status != "draft") && ($db.car_listings.moderation_status != "ai_draft") && ($db.car_listings.moderation_status != "pending_review") && ($db.car_listings.moderation_status != "needs_fix") && ($db.car_listings.moderation_status != "rejected") && ($db.car_listings.moderation_status != "blocked") && ($db.car_listings.moderation_status != "deleted") && ($db.car_listings.moderation_status != "archived") && ($db.car_listings.moderation_status != "sold"))))
      sort = {car_listings.created_at: "desc"}
      return = {type: "list", paging: {page: 1, per_page: 6}}
    } as $city_candidates

    db.query car_listings {
      where = (($db.car_listings.id != $car.id) && (($car.user_id == null) || ($db.car_listings.user_id != $car.user_id)) && (($db.car_listings.status == "approved") || ($db.car_listings.status == "published") || ($db.car_listings.moderation_status == "approved") || ($db.car_listings.moderation_status == "published")) && (($db.car_listings.status == null) || (($db.car_listings.status != "draft") && ($db.car_listings.status != "ai_draft") && ($db.car_listings.status != "pending_review") && ($db.car_listings.status != "needs_fix") && ($db.car_listings.status != "rejected") && ($db.car_listings.status != "blocked") && ($db.car_listings.status != "deleted") && ($db.car_listings.status != "archived") && ($db.car_listings.status != "sold"))) && (($db.car_listings.moderation_status == null) || (($db.car_listings.moderation_status != "draft") && ($db.car_listings.moderation_status != "ai_draft") && ($db.car_listings.moderation_status != "pending_review") && ($db.car_listings.moderation_status != "needs_fix") && ($db.car_listings.moderation_status != "rejected") && ($db.car_listings.moderation_status != "blocked") && ($db.car_listings.moderation_status != "deleted") && ($db.car_listings.moderation_status != "archived") && ($db.car_listings.moderation_status != "sold"))))
      sort = {car_listings.created_at: "desc"}
      return = {type: "list", paging: {page: 1, per_page: 6}}
    } as $recent_candidates

    var $candidate_pool { value = [] }
    foreach ($brand_candidates.items) { each as $candidate { array.push $candidate_pool { value = $candidate } } }
    foreach ($body_candidates.items) { each as $candidate { array.push $candidate_pool { value = $candidate } } }
    foreach ($fuel_candidates.items) { each as $candidate { array.push $candidate_pool { value = $candidate } } }
    foreach ($city_candidates.items) { each as $candidate { array.push $candidate_pool { value = $candidate } } }
    foreach ($recent_candidates.items) { each as $candidate { array.push $candidate_pool { value = $candidate } } }

    var $candidate_ids { value = [] }
    foreach ($candidate_pool) {
      each as $candidate {
        array.push $candidate_ids { value = $candidate.id }
      }
    }
    var.update $candidate_ids { value = $candidate_ids|unique }

    var $public_views { value = [] }
    conditional {
      if (($candidate_ids|count) > 0) {
        try_catch {
          try {
            db.query listing_views {
              where = $db.listing_views.car_id in $candidate_ids
              return = {type: "list"}
            } as $all_public_views
            var.update $public_views { value = $all_public_views }
          }
          catch { var.update $public_views { value = [] } }
        }
      }
    }

    var $related { value = [] }
    foreach ($candidate_pool) {
      each as $candidate {
        var $already_selected { value = false }
        foreach ($related) {
          each as $selected {
            conditional {
              if ($selected.id == $candidate.id) {
                var.update $already_selected { value = true }
              }
            }
          }
        }

        conditional {
          if (($already_selected == false) && (($related|count) < 6)) {
            array.filter ($public_views) if ($this.car_id == $candidate.id) as $candidate_views
            array.push $related {
              value = {
                id                   : $candidate.id
                slug                 : $candidate.slug
                title                : $candidate.title
                brand                : $candidate.brand
                model                : $candidate.model
                year                 : $candidate.year
                mileage              : $candidate.mileage
                fuel_type            : $candidate.fuel_type
                transmission         : $candidate.transmission
                body_type            : $candidate.body_type
                price                : $candidate.price
                currency             : $candidate.currency
                city                 : $candidate.city
                country              : $candidate.country
                is_ai_generated      : $candidate.is_ai_generated
                listing_quality_score: $candidate.listing_quality_score
                photo_quality_score  : $candidate.photo_quality_score
                trust_score          : $candidate.trust_score
                main_image_url       : $candidate.main_image_url
                thumbnail_url        : $candidate.thumbnail_url
                primary_image_url    : $candidate.primary_image_url
                image_url            : $candidate.image_url
                cover_image_url      : $candidate.cover_image_url
                views_total          : $candidate_views|count
              }
            }
          }
        }
      }
    }
  }

  response = $related
  tags = ["sitecraft-auto-market", "cars", "related", "public-only", "bounded", "privacy-v1", "views-public"]
  guid = "61Pgbepe4f8_U765Ih2-1CKGI5k"
}
