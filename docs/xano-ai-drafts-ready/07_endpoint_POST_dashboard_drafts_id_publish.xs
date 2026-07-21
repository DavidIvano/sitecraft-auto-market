// Endpoint: POST /dashboard/drafts/{id}/publish
// Создаёт объявление из AI-черновика и отправляет на модерацию.

query "dashboard/drafts/{id}/publish" verb=POST {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    int id
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "Войдите в кабинет, чтобы отправить объявление на модерацию."
    }

    db.get car_drafts {
      field_name = "id"
      field_value = $input.id
    } as $draft

    precondition ($draft != null) {
      error_type = "notfound"
      error = "AI-черновик не найден."
    }

    precondition ($draft.user_id == $auth.id) {
      error_type = "accessdenied"
      error = "У вас нет доступа к этому AI-черновику."
    }

    precondition ($draft.status == "draft") {
      error_type = "inputerror"
      error = "Этот черновик уже был отправлен."
    }

    precondition ($draft.title != null) {
      error_type = "inputerror"
      error = "Добавьте название объявления."
    }

    precondition ($draft.brand != null) {
      error_type = "inputerror"
      error = "Добавьте марку автомобиля."
    }

    precondition ($draft.model != null) {
      error_type = "inputerror"
      error = "Добавьте модель автомобиля."
    }

    var $slug {
      value = $draft.brand
        |concat:" "
        |concat:$draft.model
        |concat:" "
        |concat:$draft.year
        |to_lower
        |replace:" ":"-"
        |concat:"-"
        |concat:$draft.id
    }

    db.add car_listings {
      data = {
        user_id: $auth.id
        draft_id: $draft.id
        title: $draft.title
        brand: $draft.brand
        model: $draft.model
        year: $draft.year
        mileage: $draft.mileage
        fuel_type: $draft.fuel_type
        transmission: $draft.transmission
        body_type: $draft.body_type
        vehicle_type: $draft.vehicle_type
        engine_volume: $draft.engine_volume
        first_registration: $draft.first_registration
        owners_count: $draft.owners_count
        color: $draft.color
        price: $draft.price
        city: $draft.city
        description: $draft.description
        slug: $slug
        status: "pending_review"
        moderation_status: "pending_review"
        is_ai_generated: true
      }
    } as $car

    db.query car_draft_images {
      where = ($db.car_draft_images.draft_id == $draft.id)
      sort = {sort_order: "asc"}
    } as $draft_images

    foreach ($draft_images) {
      each as $draft_image {
        db.add car_listing_images {
          data = {
            car_id: $car.id
            sort_order: $draft_image.sort_order
            is_primary: $draft_image.is_primary
            image: $draft_image.image
            image_url: $draft_image.image_url
            mime_type: $draft_image.mime_type
            original_filename: $draft_image.original_filename
            size_bytes: $draft_image.size_bytes
            image_metadata: $draft_image.image_metadata
          }
        } as $car_image
      }
    }

    db.edit car_drafts {
      field_name = "id"
      field_value = $draft.id
      data = {
        status: "pending_review"
        car_id: $car.id
        updated_at: now
      }
    } as $draft
  }

  response = {
    car: $car
    slug: $car.slug
    status: $car.status
  }

  tags = ["sitecraft-auto-market", "ai", "drafts", "moderation"]
}
