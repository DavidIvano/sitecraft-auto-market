query dashboard/listings/{id} verb=PATCH {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    int id filters=min:1
    text title filters=trim
    text brand filters=trim
    text model filters=trim
    int year filters=min:1900
    decimal price filters=min:0
    int mileage filters=min:0
    text city filters=trim
    text country? filters=trim
    text fuel_type filters=trim
    text transmission filters=trim
    text description? filters=trim
    bool has_valid_tuv?
    text tuv_valid_until? filters=trim
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }

    db.get car_listings {
      field_name = "id"
      field_value = $input.id
    } as $car

    precondition ($car != null) {
      error_type = "notfound"
      error = "Listing not found"
    }

    precondition ($car.user_id == $auth.id) {
      error_type = "accessdenied"
      error = "You can edit only your own listing"
    }

    var $tuv_valid_until {
      value = null
    }

    conditional {
      if ($input.has_valid_tuv == true) {
        precondition ("/^\\d{4}-(0[1-9]|1[0-2])$/"|regex_matches:($input.tuv_valid_until|first_notnull:"")) {
          error_type = "inputerror"
          error = "TUV_DATE_REQUIRED"
        }
        var.update $tuv_valid_until {
          value = $input.tuv_valid_until
        }
      }
    }

    db.edit car_listings {
      field_name = "id"
      field_value = $input.id
      data = {
        updated_at   : "now"
        title        : $input.title
        brand        : $input.brand
        model        : $input.model
        year         : $input.year
        price        : $input.price
        mileage      : $input.mileage
        city         : $input.city
        country      : $input.country
        fuel_type    : $input.fuel_type
        transmission : $input.transmission
        description  : $input.description
        has_valid_tuv: $input.has_valid_tuv
        tuv_valid_until: $tuv_valid_until
        status       : "draft"
      }
    } as $updated_car
  }

  response = $updated_car

  tags = ["sitecraft-auto-market", "dashboard", "cars", "update"]
}
