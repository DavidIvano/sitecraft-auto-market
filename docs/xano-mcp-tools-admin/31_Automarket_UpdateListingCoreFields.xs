tool Automarket_UpdateListingCoreFields {
  instructions = "Update editable core fields of one SiteCraft Auto Market listing. Use only when the user asks to fix a listing."

  input {
    int id filters=min:1
    text title filters=trim
    text brand filters=trim
    text model filters=trim
    int year
    int mileage
    decimal price
    text city filters=trim
    text country filters=trim
    text fuel_type filters=trim
    text transmission filters=trim
    text seller_phone filters=trim
    email seller_email filters=trim|lower
    text description filters=trim
    text status filters=trim
  }

  stack {
    db.get car_listings {
      field_name = "id"
      field_value = $input.id
    } as $before

    precondition ($before != null) {
      error_type = "notfound"
      error = "Listing not found"
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
        mileage      : $input.mileage
        price        : $input.price
        city         : $input.city
        country      : $input.country
        fuel_type    : $input.fuel_type
        transmission : $input.transmission
        seller_phone : $input.seller_phone
        seller_email : $input.seller_email
        description  : $input.description
        status       : $input.status
      }
    } as $after
  }

  response = {
    updated: ($after != null)
    before : $before
    after  : $after
  }

  tags = ["sitecraft-auto-market", "cars", "update"]
  guid = "automarket-tool-update-listing-core-fields"
}
