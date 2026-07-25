query "admin/cars/{id}/reject" verb=PATCH {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    int id filters=min:1
    text reason? filters=trim
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "unauthorized"
      error = "Unauthorized"
    }

    db.get automarket_users {
      field_name = "id"
      field_value = $auth.id
    } as $admin_user

    precondition ($admin_user != null) {
      error_type = "unauthorized"
      error = "Unauthorized"
    }

    precondition ($admin_user.role == "admin") {
      error_type = "accessdenied"
      error = "Admin access required"
    }

    db.get car_listings {
      field_name = "id"
      field_value = $input.id
    } as $car

    precondition ($car != null) {
      error_type = "notfound"
      error = "Listing not found"
    }

    db.edit car_listings {
      field_name = "id"
      field_value = $input.id
      data = {
        updated_at       : "now"
        status           : "rejected"
        moderation_status: "rejected"
      }
    } as $updated
  }

  response = {success: true, car: $updated}
  tags = ["sitecraft-auto-market", "admin", "cars", "reject", "protected"]
}
