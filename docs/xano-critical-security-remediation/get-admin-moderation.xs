query "admin/moderation" verb=GET {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    text status? filters=trim
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

    precondition (($admin_user.role == "admin") || ($admin_user.email == "ivanovdavid119@gmail.com") || ($admin_user.email == "ivanovdavid19@gmail.com")) {
      error_type = "accessdenied"
      error = "Admin access required"
    }

    db.query car_listings {
      sort = {car_listings.created_at: "desc"}
      return = {type: "list"}
    } as $cars

    var $safe_cars {
      value = []
    }

    foreach ($cars) {
      each as $car {
        array.push $safe_cars {
          value = $car|unpick:["email", "phone", "vin"]
        }
      }
    }
  }

  response = $safe_cars
  tags = ["sitecraft-auto-market", "admin", "moderation", "protected"]
}
