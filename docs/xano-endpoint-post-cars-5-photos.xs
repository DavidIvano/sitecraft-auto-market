query cars verb=POST {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    text title filters=trim
    text brand filters=trim
    text model filters=trim
    int year
    int mileage
    text fuel_type filters=trim
    text transmission filters=trim
    decimal price
    text currency?=EUR filters=trim|upper
    text city filters=trim
    text country?=Германия filters=trim
    text seller_name? filters=trim
    text seller_phone? filters=trim
    email? seller_email filters=trim|lower
    text description? filters=trim
    file[] photos?
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }

    var $timestamp {
      value = now|format_timestamp:"U"
    }

    var $slug {
      value = $input.brand|concat:" "|concat:$input.model|concat:" "|concat:$input.year|lower|replace:" ":"-"|concat:"-"|concat:$timestamp
    }

    db.add car_listings {
      data = {
        created_at     : "now"
        updated_at     : "now"
        user_id        : $auth.id
        slug           : $slug
        title          : $input.title
        brand          : $input.brand
        model          : $input.model
        year           : $input.year
        mileage        : $input.mileage
        fuel_type      : $input.fuel_type
        transmission   : $input.transmission
        price          : $input.price
        currency       : $input.currency
        city           : $input.city
        country        : $input.country
        seller_name    : $input.seller_name
        seller_phone   : $input.seller_phone
        seller_email   : $input.seller_email
        description    : $input.description
        status         : "draft"
        main_image_url : null
      }
    } as $car

    var $sort_order {
      value = 0
    }

    conditional {
      if ($input.photos != null) {
        foreach ($input.photos) {
          each as $photo {
            conditional {
              if ($sort_order < 5) {
                storage.create_image {
                  access = "public"
                  value = $photo
                  filename = "car-listing-image.jpg"
                } as $image_metadata

                db.add car_listing_images {
                  data = {
                    created_at     : "now"
                    updated_at     : "now"
                    car_listing_id : $car.id
                    image          : $image_metadata
                    image_url      : $image_metadata.url
                    sort_order     : $sort_order
                    is_main        : $sort_order == 0
                    is_deleted     : false
                  }
                } as $image_row

                conditional {
                  if ($sort_order == 0) {
                    db.edit car_listings {
                      field_name = "id"
                      field_value = $car.id
                      data = {
                        updated_at     : "now"
                        main_image_url : $image_metadata.url
                      }
                    } as $car
                  }
                }

                var.update $sort_order {
                  value = $sort_order + 1
                }
              }
            }
          }
        }
      }
    }

    db.query car_listing_images {
      where = (($db.car_listing_images.car_listing_id == $car.id) && ($db.car_listing_images.is_deleted != true))
      sort = {car_listing_images.sort_order: "asc"}
      return = {type: "list"}
    } as $images

    var $result {
      value = $car|set:"images":$images
    }
  }

  response = $result
}
