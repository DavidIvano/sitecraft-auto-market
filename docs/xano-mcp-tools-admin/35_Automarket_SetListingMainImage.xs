tool Automarket_SetListingMainImage {
  instructions = "Set one active image as the main listing image and copy its URL into car_listings.main_image_url."

  input {
    int listing_id filters=min:1
    int image_id filters=min:1
  }

  stack {
    db.get car_listing_images {
      field_name = "id"
      field_value = $input.image_id
    } as $chosen

    precondition ($chosen != null) {
      error_type = "notfound"
      error = "Image row not found"
    }

    precondition ($chosen.car_listing_id == $input.listing_id) {
      error_type = "accessdenied"
      error = "Image belongs to another listing"
    }

    precondition ($chosen.is_deleted != true) {
      error_type = "invalid"
      error = "Cannot use a deleted image as main image"
    }

    db.query car_listing_images {
      where = (($db.car_listing_images.car_listing_id == $input.listing_id) && ($db.car_listing_images.is_deleted != true))
      return = {type: "list"}
    } as $images

    foreach ($images) {
      each as $image {
        db.edit car_listing_images {
          field_name = "id"
          field_value = $image.id
          data = {
            updated_at: "now"
            is_main   : false
          }
        } as $image_unset
      }
    }

    db.edit car_listing_images {
      field_name = "id"
      field_value = $input.image_id
      data = {
        updated_at: "now"
        sort_order: 0
        is_main   : true
      }
    } as $image_main

    db.edit car_listings {
      field_name = "id"
      field_value = $input.listing_id
      data = {
        updated_at     : "now"
        main_image_url : $chosen.image_url
      }
    } as $listing
  }

  response = {
    updated: ($image_main != null)
    listing: $listing
    image  : $image_main
  }

  tags = ["sitecraft-auto-market", "cars", "images", "main"]
  guid = "automarket-tool-set-listing-main-image"
}
