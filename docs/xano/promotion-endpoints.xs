// Production endpoint: owner-only listing detail used by the promotion page.
query "dashboard/listings/{id}" verb=GET {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"
  input {
    int id filters=min:1
  }
  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "UNAUTHORIZED"
    }
    db.get car_listings {
      field_name = "id"
      field_value = $input.id
    } as $listing
    precondition ($listing != null) {
      error_type = "notfound"
      error = "LISTING_NOT_FOUND"
    }
    precondition ($listing.user_id == $auth.id) {
      error_type = "accessdenied"
      error = "NOT_LISTING_OWNER"
    }
    db.query car_listing_images {
      where = (($db.car_listing_images.car_listing_id == $listing.id) && ($db.car_listing_images.is_deleted != true))
      sort = {car_listing_images.sort_order: "asc"}
      return = {type: "list"}
    } as $images
    var $result {
      value = $listing|set:"images":$images
    }
  }
  response = $result
  tags = ["sitecraft-auto-market", "dashboard", "listings", "promotions", "owner-only"]
}

// Atomic internal-credit purchase. Cost and duration are a server allowlist.
query "dashboard/listings/{id}/promote" verb=POST {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"
  input {
    int id filters=min:1
    text product_slug filters=trim|lower|max:40
    text idempotency_key filters=trim|lower|max:64
  }
  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "UNAUTHORIZED"
    }
    precondition (($input.idempotency_key|strlen) >= 32) {
      error_type = "inputerror"
      error = "INVALID_IDEMPOTENCY_KEY"
    }

    var $credits_required {
      value = 0
    }
    var $duration_days {
      value = 0
    }
    var $description {
      value = ""
    }
    conditional {
      if ($input.product_slug == "boost_7_days") {
        var.update $credits_required {
          value = 5
        }
        var.update $duration_days {
          value = 7
        }
        var.update $description {
          value = "Продвижение объявления: Поднять на 7 дней"
        }
      }
      elseif ($input.product_slug == "featured_14_days") {
        var.update $credits_required {
          value = 12
        }
        var.update $duration_days {
          value = 14
        }
        var.update $description {
          value = "Продвижение объявления: Выделить на 14 дней"
        }
      }
      elseif ($input.product_slug == "homepage_premium_7_days") {
        var.update $credits_required {
          value = 20
        }
        var.update $duration_days {
          value = 7
        }
        var.update $description {
          value = "Продвижение объявления: Премиум на главной на 7 дней"
        }
      }
    }
    precondition ($credits_required > 0) {
      error_type = "inputerror"
      error = "INVALID_PRODUCT"
    }

    db.transaction {
      stack {
        db.get car_listings {
          field_name = "id"
          field_value = $input.id
          lock = true
        } as $listing
        precondition ($listing != null) {
          error_type = "notfound"
          error = "LISTING_NOT_FOUND"
        }
        precondition ($listing.user_id == $auth.id) {
          error_type = "accessdenied"
          error = "NOT_LISTING_OWNER"
        }
        conditional {
          if (($listing.status == "blocked") || ($listing.status == "deleted") || ($listing.status == "archived") || ($listing.status == "sold") || ($listing.moderation_status == "blocked") || ($listing.moderation_status == "deleted") || ($listing.moderation_status == "archived")) {
            util.set_header {
              value = "HTTP/1.1 409 Conflict"
              duplicates = "replace"
            }
            return {
              value = {code: "LISTING_BLOCKED", message: "LISTING_BLOCKED"}
            }
          }
          elseif (($listing.status != "approved") && ($listing.status != "published") && ($listing.moderation_status != "approved") && ($listing.moderation_status != "published")) {
            util.set_header {
              value = "HTTP/1.1 409 Conflict"
              duplicates = "replace"
            }
            return {
              value = {code: "LISTING_NOT_PUBLISHED", message: "LISTING_NOT_PUBLISHED"}
            }
          }
        }

        db.query user_credits {
          where = ($db.user_credits.user_id == $auth.id)
          return = {type: "single"}
          lock = true
        } as $wallet
        conditional {
          if ($wallet == null) {
            db.add user_credits {
              data = {created_at: now, updated_at: now, user_id: $auth.id, ai_credits: 0}
            } as $wallet
          }
        }

        db.query credit_transactions {
          where = (($db.credit_transactions.user_id == $auth.id) && ($db.credit_transactions.idempotency_key == $input.idempotency_key))
          return = {type: "single"}
        } as $existing_transaction
        conditional {
          if ($existing_transaction != null) {
            util.set_header {
              value = "HTTP/1.1 409 Conflict"
              duplicates = "replace"
            }
            return {
              value = {code: "DUPLICATE_OPERATION", message: "DUPLICATE_OPERATION"}
            }
          }
        }

        var $balance_before {
          value = $wallet.ai_credits|first_notnull:0|to_int
        }
        conditional {
          if ($balance_before < $credits_required) {
            util.set_header {
              value = "HTTP/1.1 422 Unprocessable Entity"
              duplicates = "replace"
            }
            return {
              value = {code: "INSUFFICIENT_CREDITS", message: "INSUFFICIENT_CREDITS"}
            }
          }
        }
        var $balance_after {
          value = $balance_before - $credits_required
        }
        var $duration_seconds {
          value = $duration_days * 86400
        }
        var $base_time {
          value = now
        }
        conditional {
          if (($input.product_slug == "boost_7_days") && ($listing.boosted_until != null) && ($listing.boosted_until > now)) {
            var.update $base_time {
              value = $listing.boosted_until
            }
          }
          elseif (($input.product_slug == "featured_14_days") && ($listing.featured_until != null) && ($listing.featured_until > now)) {
            var.update $base_time {
              value = $listing.featured_until
            }
          }
          elseif (($input.product_slug == "homepage_premium_7_days") && ($listing.homepage_until != null) && ($listing.homepage_until > now)) {
            var.update $base_time {
              value = $listing.homepage_until
            }
          }
        }
        var $active_until {
          value = $base_time|add_secs_to_timestamp:$duration_seconds
        }

        db.edit user_credits {
          field_name = "id"
          field_value = $wallet.id
          data = {updated_at: now, ai_credits: $balance_after}
        } as $wallet_updated

        conditional {
          if ($input.product_slug == "boost_7_days") {
            db.edit car_listings {
              field_name = "id"
              field_value = $listing.id
              data = {updated_at: now, boosted_at: now, boosted_until: $active_until, last_promoted_at: now}
            } as $listing_updated
          }
          elseif ($input.product_slug == "featured_14_days") {
            db.edit car_listings {
              field_name = "id"
              field_value = $listing.id
              data = {updated_at: now, featured_at: now, featured_until: $active_until, last_promoted_at: now}
            } as $listing_updated
          }
          elseif ($input.product_slug == "homepage_premium_7_days") {
            db.edit car_listings {
              field_name = "id"
              field_value = $listing.id
              data = {updated_at: now, homepage_at: now, homepage_until: $active_until, last_promoted_at: now}
            } as $listing_updated
          }
        }

        db.add credit_transactions {
          data = {
            created_at        : now
            updated_at        : now
            user_id           : $auth.id
            type              : "promotion_purchase"
            amount            : 0 - $credits_required
            balance_before    : $balance_before
            balance_after     : $balance_after
            related_car_id    : $listing.id
            notes             : $description
            product_slug      : $input.product_slug
            status            : "completed"
            idempotency_key   : $input.idempotency_key
            metadata          : {duration_days: $duration_days, active_until: $active_until, listing_id: $listing.id, listing_title: $listing.title}
          }
        } as $transaction
      }
    }
  }
  response = {
    success       : true
    listing_id    : $listing_updated.id
    product_slug  : $input.product_slug
    credits_spent : $credits_required
    balance_before: $balance_before
    balance_after : $balance_after
    active_until  : $active_until
    promotion     : {
      boosted_until : $listing_updated.boosted_until
      featured_until: $listing_updated.featured_until
      homepage_until: $listing_updated.homepage_until
    }
  }
  tags = ["sitecraft-auto-market", "dashboard", "promotions", "credits", "owner-only"]
}

query "dashboard/summary" verb=GET {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"
  input {
  }
  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "UNAUTHORIZED"
    }
    db.query user_credits {
      where = ($db.user_credits.user_id == $auth.id)
      return = {type: "single"}
    } as $wallet
    conditional {
      if ($wallet == null) {
        db.add user_credits {
          data = {created_at: now, updated_at: now, user_id: $auth.id, ai_credits: 0}
        } as $wallet
      }
    }
    db.query car_listings {
      where = (($db.car_listings.user_id == $auth.id) && ($db.car_listings.status != "deleted"))
      return = {type: "list"}
    } as $listings
    var $draft {
      value = 0
    }
    var $pending {
      value = 0
    }
    var $published {
      value = 0
    }
    var $promoted {
      value = 0
    }
    var $boosted {
      value = 0
    }
    var $featured {
      value = 0
    }
    var $homepage {
      value = 0
    }
    foreach ($listings) {
      each as $listing {
        conditional {
          if (($listing.status == "draft") || ($listing.status == "rejected")) {
            var.update $draft {
              value = $draft + 1
            }
          }
          elseif ($listing.status == "pending_review") {
            var.update $pending {
              value = $pending + 1
            }
          }
          elseif ($listing.status == "approved") {
            var.update $published {
              value = $published + 1
            }
          }
        }
        var $has_promotion {
          value = false
        }
        conditional {
          if (($listing.boosted_until != null) && ($listing.boosted_until > now)) {
            var.update $boosted {
              value = $boosted + 1
            }
            var.update $has_promotion {
              value = true
            }
          }
        }
        conditional {
          if (($listing.featured_until != null) && ($listing.featured_until > now)) {
            var.update $featured {
              value = $featured + 1
            }
            var.update $has_promotion {
              value = true
            }
          }
        }
        conditional {
          if (($listing.homepage_until != null) && ($listing.homepage_until > now)) {
            var.update $homepage {
              value = $homepage + 1
            }
            var.update $has_promotion {
              value = true
            }
          }
        }
        conditional {
          if ($has_promotion) {
            var.update $promoted {
              value = $promoted + 1
            }
          }
        }
      }
    }
  }
  response = {
    credits: {balance: $wallet.ai_credits|first_notnull:0|to_int}
    listings: {total: $listings|count, draft: $draft, pending_review: $pending, published: $published, promoted: $promoted}
    active_promotions: {boosted: $boosted, featured: $featured, homepage: $homepage}
  }
  tags = ["sitecraft-auto-market", "dashboard", "summary", "owner-only"]
}

query "dashboard/credits/transactions" verb=GET {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"
  input {
    int page?=1 filters=min:1
    int per_page?=20 filters=min:1|max:50
  }
  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "UNAUTHORIZED"
    }
    db.query credit_transactions {
      where = ($db.credit_transactions.user_id == $auth.id)
      sort = {credit_transactions.created_at: "desc"}
      return = {type: "list", paging: {page: $input.page, per_page: $input.per_page, totals: true, metadata: true}}
    } as $transactions
  }
  response = {
    items: $transactions.items
    page: $transactions.curPage
    per_page: $transactions.perPage
    total: $transactions.itemsTotal
    page_total: $transactions.pageTotal
  }
  tags = ["sitecraft-auto-market", "dashboard", "credits", "transactions", "owner-only"]
}
