query "admin/cars/{id}/sold" verb=PATCH {
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
    } as $admin_user

    precondition ($admin_user != null) {
      error_type = "accessdenied"
      error = "User not found"
    }

    precondition (($admin_user.role == "admin") || ($admin_user.email == "ivanovdavid19@gmail.com") || ($admin_user.email == "ivanovdavid119@gmail.com")) {
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
        updated_at        : "now"
        status            : "sold"
        moderation_status : "sold"
        sold_at           : "now"
      }
    } as $updated
  }

  response = $updated
  tags = ["sitecraft-auto-market", "admin", "cars", "sold"]
}
