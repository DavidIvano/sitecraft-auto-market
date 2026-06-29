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
        status       : "draft"
      }
    } as $updated_car
  }

  response = $updated_car

  tags = ["sitecraft-auto-market", "dashboard", "cars", "update"]
}
