tool Automarket_AddListingImageUrl {
  instructions = "Attach an already hosted public image URL to a listing image gallery. This does not upload a file; it links an existing URL."

  input {
    int listing_id filters=min:1
    text image_url filters=trim
    int? sort_order
    bool? is_main
  }

  stack {
    db.get car_listings {
      field_name = "id"
      field_value = $input.listing_id
    } as $listing

    precondition ($listing != null) {
      error_type = "notfound"
      error = "Listing not found"
    }

    db.query car_listing_images {
      where = (($db.car_listing_images.car_listing_id == $input.listing_id) && ($db.car_listing_images.is_deleted != true))
      return = {type: "list"}
    } as $active_images

    precondition (($active_images|count) < 5) {
      error_type = "overflow"
      error = "Maximum 5 active images per listing"
    }

    var $next_order {
      value = $active_images|count
    }

    conditional {
      if ($input.sort_order != null) {
        var.update $next_order {
          value = $input.sort_order
        }
      }
    }

    db.add car_listing_images {
      data = {
        created_at     : "now"
        updated_at     : "now"
        car_listing_id : $input.listing_id
        image          : {url: $input.image_url}
        image_url      : $input.image_url
        sort_order     : $next_order
        is_main        : $input.is_main == true
        is_deleted     : false
      }
    } as $image

    conditional {
      if ($input.is_main == true) {
        db.edit car_listings {
          field_name = "id"
          field_value = $input.listing_id
          data = {
            updated_at     : "now"
            main_image_url : $input.image_url
          }
        } as $listing_updated
      }
    }
  }

  response = {
    created: ($image != null)
    image  : $image
  }

  tags = ["sitecraft-auto-market", "cars", "images", "create"]
  guid = "automarket-tool-add-listing-image-url"
}
