# SiteCraft Auto Market — AI credits, scanner, badges, quality upgrade

// P11. Add these fields to table automarket_users.
table automarket_users {
  schema {
    int free_ai_credits?=10
    int paid_ai_credits?=0
    int ai_credits_total?=10
    bool free_ai_credits_granted?=false
    timestamp free_ai_credits_granted_at?
    int ai_credits_used_total?=0
  }
}

// P11. Transaction log for every credit change.
table ai_credit_transactions {
  schema {
    int id
    timestamp created_at?=now
    int user_id
    text type filters=trim
    int amount
    text source? filters=trim
    int related_listing_id?
    int related_purchase_id?
    json metadata?
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "user_id", op: "asc"}]}
    {type: "btree", field: [{name: "created_at", op: "desc"}]}
  ]
}

// P12-P17. Add these fields to car_listings.
table car_listings {
  schema {
    text ai_scan_status? filters=trim
    int ai_scan_score?
    json ai_scan_badges?
    json ai_scan_errors_json?
    json ai_scan_warnings_json?
    json ai_scan_recommendations_json?
    timestamp ai_scan_last_checked_at?
    text ai_scan_recommendation? filters=trim
    int ai_listing_score?
    int photo_quality_score?
    json ai_analysis?
    json ai_recommendations?
    json ai_warnings?
    json ai_missing_fields?
    bool ai_quality_upgrade_requested?=false
    timestamp ai_quality_upgrade_requested_at?
    timestamp sold_at?
    timestamp deleted_at?
  }
}

query "me/credits" verb=GET {
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
    } as $user

    precondition ($user != null) {
      error_type = "notfound"
      error = "User not found"
    }

    conditional {
      if ($user.free_ai_credits_granted != true) {
        db.edit automarket_users {
          field_name = "id"
          field_value = $user.id
          data = {
            updated_at                 : "now"
            free_ai_credits            : 10
            paid_ai_credits            : $user.paid_ai_credits
            ai_credits_total           : 10 + $user.paid_ai_credits
            free_ai_credits_granted    : true
            free_ai_credits_granted_at : "now"
          }
        } as $user

        db.add ai_credit_transactions {
          data = {
            created_at : "now"
            user_id    : $user.id
            type       : "free_grant"
            amount     : 10
            source     : "new_user_demo"
            metadata   : {note: "10 free AI demo credits"}
          }
        } as $tx
      }
    }
  }

  response = {
    free_ai_credits: $user.free_ai_credits
    paid_ai_credits: $user.paid_ai_credits
    ai_credits_total: $user.ai_credits_total
    ai_credits_used_total: $user.ai_credits_used_total
    free_ai_credits_granted: $user.free_ai_credits_granted
  }
}

query "admin/ai/scan-listings" verb=POST {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    text mode?=pending_review filters=trim
    int[] selected_ids?
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }

    db.get automarket_users {
      field_name = "id"
      field_value = $auth.id
    } as $admin_user

    precondition (($admin_user.role == "admin") || ($admin_user.email == "ivanovdavid19@gmail.com") || ($admin_user.email == "ivanovdavid119@gmail.com")) {
      error_type = "accessdenied"
      error = "Admin access required"
    }

    conditional {
      if ($input.mode == "selected") {
        db.query car_listings {
          where = ($db.car_listings.id in $input.selected_ids)
          return = {type: "list"}
        } as $listings
      }
      else {
        db.query car_listings {
          where = (
            ($input.mode == "all") ||
            ($db.car_listings.status == $input.mode) ||
            ($db.car_listings.moderation_status == $input.mode)
          )
          return = {type: "list"}
        } as $listings
      }
    }

    var $updated_count {
      value = 0
    }

    foreach ($listings) {
      each as $listing {
        var $score {
          value = 0
        }

        conditional { if ($listing.main_image_url != null && $listing.main_image_url != "") { var.update $score { value = $score + 20 } } }
        conditional { if ($listing.year != null) { var.update $score { value = $score + 10 } } }
        conditional { if ($listing.mileage != null && $listing.mileage >= 0) { var.update $score { value = $score + 10 } } }
        conditional { if ($listing.price != null && $listing.price >= 100 && $listing.price <= 500000) { var.update $score { value = $score + 15 } } }
        conditional { if ($listing.city != null && $listing.city != "") { var.update $score { value = $score + 10 } } }
        conditional { if ($listing.fuel_type != null && $listing.fuel_type != "") { var.update $score { value = $score + 10 } } }
        conditional { if ($listing.transmission != null && $listing.transmission != "") { var.update $score { value = $score + 10 } } }
        conditional { if ($listing.description != null && ($listing.description|length) >= 80) { var.update $score { value = $score + 15 } } }

        var $badges {
          value = []
        }

        conditional {
          if ($score >= 85) {
            array.push $badges {
              value = "ai_checked"
            }
          }
          else {
            array.push $badges {
              value = "needs_improvement"
            }
          }
        }

        db.edit car_listings {
          field_name = "id"
          field_value = $listing.id
          data = {
            updated_at                       : "now"
            ai_scan_status                   : "checked"
            ai_scan_score                    : $score
            ai_listing_score                 : $score
            ai_scan_badges                   : $badges
            ai_scan_errors_json              : []
            ai_scan_warnings_json            : []
            ai_scan_recommendations_json     : ["Добавьте больше фото, точную цену, пробег и продающее описание."]
            ai_scan_last_checked_at          : "now"
            ai_scan_recommendation           : "Проверьте заполненность объявления перед публикацией."
          }
        } as $updated

        var.update $updated_count {
          value = $updated_count + 1
        }
      }
    }
  }

  response = {
    scanned: $updated_count
  }
}

query "listings/{id}/quality-upgrade" verb=POST {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    int id
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }

    db.get car_listings {
      field_name = "id"
      field_value = $input.id
    } as $listing

    precondition ($listing != null) {
      error_type = "notfound"
      error = "Listing not found"
    }

    precondition ($listing.user_id == $auth.id) {
      error_type = "accessdenied"
      error = "This listing belongs to another user"
    }

    db.edit car_listings {
      field_name = "id"
      field_value = $listing.id
      data = {
        updated_at                    : "now"
        ai_quality_upgrade_requested  : true
        ai_quality_upgrade_requested_at: "now"
      }
    } as $updated
  }

  response = $updated
}
