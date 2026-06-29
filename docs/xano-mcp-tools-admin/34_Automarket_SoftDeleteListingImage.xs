tool Automarket_SoftDeleteListingImage {
  instructions = "Soft-delete one image row from a listing gallery. It sets is_deleted=true instead of removing the database row."

  input {
    int image_id filters=min:1
  }

  stack {
    db.get car_listing_images {
      field_name = "id"
      field_value = $input.image_id
    } as $before

    precondition ($before != null) {
      error_type = "notfound"
      error = "Image row not found"
    }

    db.edit car_listing_images {
      field_name = "id"
      field_value = $input.image_id
      data = {
        updated_at : "now"
        is_deleted: true
        deleted_at: "now"
        is_main   : false
      }
    } as $after
  }

  response = {
    updated: ($after != null)
    before : $before
    after  : $after
  }

  tags = ["sitecraft-auto-market", "cars", "images", "delete"]
  guid = "automarket-tool-soft-delete-listing-image"
}
