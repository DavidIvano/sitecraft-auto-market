query "admin/cars/{id}/assign-owner" verb=PATCH {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    int id filters=min:1
    int user_id filters=min:1
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

    db.get automarket_users {
      field_name = "id"
      field_value = $input.user_id
    } as $owner

    precondition ($owner != null) {
      error_type = "notfound"
      error = "Owner user not found"
    }

    db.edit car_listings {
      field_name = "id"
      field_value = $input.id
      data = {user_id: $owner.id, updated_at: "now"}
    } as $updated

    debug.log {
      value = {admin_id: $auth.id, listing_id: $input.id}
    }
  }

  response = {success: true, car: $updated}
  tags = [
    "sitecraft-auto-market"
    "admin"
    "cars"
    "assign-owner"
    "protected"
  ]
}
