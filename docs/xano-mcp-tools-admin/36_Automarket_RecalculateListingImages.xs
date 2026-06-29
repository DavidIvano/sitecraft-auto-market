tool Automarket_RecalculateListingImages {
  instructions = "Normalize active image order, make the first active image main, and sync car_listings.main_image_url."

  input {
    int listing_id filters=min:1
  }

  stack {
    db.query car_listing_images {
      where = (($db.car_listing_images.car_listing_id == $input.listing_id) && ($db.car_listing_images.is_deleted != true))
      sort = {car_listing_images.sort_order: "asc"}
      return = {type: "list"}
    } as $images

    var $order {
      value = 0
    }

    var $main_url {
      value = ""
    }

    foreach ($images) {
      each as $image {
        conditional {
          if ($order == 0) {
            var.update $main_url {
              value = $image.image_url
            }
          }
        }

        db.edit car_listing_images {
          field_name = "id"
          field_value = $image.id
          data = {
            updated_at: "now"
            sort_order: $order
            is_main   : $order == 0
          }
        } as $image_updated

        var.update $order {
          value = $order + 1
        }
      }
    }

    db.edit car_listings {
      field_name = "id"
      field_value = $input.listing_id
      data = {
        updated_at     : "now"
        main_image_url : $main_url
      }
    } as $listing
  }

  response = {
    listing: $listing
    images : $images
    count  : ($images|count)
  }

  tags = ["sitecraft-auto-market", "cars", "images", "repair"]
  guid = "automarket-tool-recalculate-listing-images"
}
