// Compatibility copy of docs/xano-endpoint-patch-dashboard-listings-delete.xs.
// Endpoint: PATCH /dashboard/listings/{id}/delete
// Owner-only, idempotent soft-delete. No image/R2/draft/credit mutations.

query "dashboard/listings/{id}/delete" verb=PATCH {
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

    precondition ($current_user != null) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }

    db.query car_listings {
      where = (($db.car_listings.id == $input.id) && ($db.car_listings.user_id == $current_user.id))
      return = {type: "single"}
    } as $car

    precondition ($car != null) {
      error_type = "notfound"
      error = "Listing not found"
    }

    precondition ($car.status != "blocked") {
      error_type = "accessdenied"
      error = "This listing cannot be deleted by the seller."
    }

    var $result {
      value = {
        success        : true
        deleted        : true
        id             : $car.id
        listing_id     : $car.id
        status         : "deleted"
        already_deleted: true
        message        : "Listing already deleted"
      }
    }

    conditional {
      if ($car.status != "deleted") {
        precondition (($car.status == "draft") || ($car.status == "ai_draft") || ($car.status == "pending_review") || ($car.status == "needs_fix") || ($car.status == "rejected") || ($car.status == "approved") || ($car.status == "published") || ($car.status == "sold") || ($car.status == "archived")) {
          error_type = "badrequest"
          error = "Listing status does not allow seller deletion"
        }

        db.edit car_listings {
          field_name = "id"
          field_value = $car.id
          data = {
            updated_at: "now"
            status    : "deleted"
          }
        } as $deleted_car

        var.update $result {
          value = {
            success        : true
            deleted        : true
            id             : $deleted_car.id
            listing_id     : $deleted_car.id
            status         : $deleted_car.status
            already_deleted: false
            message        : "Listing deleted"
          }
        }
      }
    }
  }

  response = $result
  tags = ["sitecraft-auto-market", "dashboard", "listings", "owner-only", "soft-delete"]
}
