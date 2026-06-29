tool Automarket_ListListingImagesDebug {
  instructions = "List active and deleted image rows for one listing, so Codex can debug why photos do or do not appear."

  input {
    int listing_id filters=min:1
  }

  stack {
    db.get car_listings {
      field_name = "id"
      field_value = $input.listing_id
    } as $listing

    db.query car_listing_images {
      where = ($db.car_listing_images.car_listing_id == $input.listing_id)
      sort = {car_listing_images.sort_order: "asc"}
      return = {type: "list"}
    } as $images
  }

  response = {
    listing: $listing
    images : $images
    count  : ($images|count)
  }

  tags = ["sitecraft-auto-market", "cars", "images", "debug"]
  guid = "automarket-tool-list-listing-images-debug"
}
