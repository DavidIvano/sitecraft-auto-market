query "cars/{slug}" verb=GET {
  api_group = "sitecraft-auto-market"

  input {
    text slug filters=trim|lower
  }

  stack {
    db.get car_listings {
      field_name = "slug"
      field_value = $input.slug
    } as $car

    precondition ($car != null) {
      error_type = "notfound"
      error = "Listing not found"
    }

    var $is_public {
      value = ((($car.status == "approved") || ($car.status == "published") || ($car.status == "sold") || ($car.moderation_status == "approved") || ($car.moderation_status == "published") || ($car.moderation_status == "sold")) && (($car.status == null) || (($car.status != "draft") && ($car.status != "ai_draft") && ($car.status != "pending_review") && ($car.status != "needs_fix") && ($car.status != "rejected") && ($car.status != "blocked") && ($car.status != "deleted") && ($car.status != "archived"))) && (($car.moderation_status == null) || (($car.moderation_status != "draft") && ($car.moderation_status != "ai_draft") && ($car.moderation_status != "pending_review") && ($car.moderation_status != "needs_fix") && ($car.moderation_status != "rejected") && ($car.moderation_status != "blocked") && ($car.moderation_status != "deleted") && ($car.moderation_status != "archived"))))
    }

    precondition ($is_public) {
      error_type = "notfound"
      error = "Listing not found"
    }

    db.query car_listing_images {
      where = (($db.car_listing_images.car_listing_id == $car.id) && ($db.car_listing_images.is_deleted != true))
      sort = {car_listing_images.sort_order: "asc"}
      return = {type: "list"}
    } as $images

    var $model {
      value = $car|set:"images":$images
    }
  }

  response = $model
  tags = ["sitecraft-auto-market", "cars", "images", "public-only"]
}
