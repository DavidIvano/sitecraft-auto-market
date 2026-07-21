// Endpoint: PATCH /dashboard/drafts/{id}
// Сохраняет исправления пользователя в AI-черновике.

query "dashboard/drafts/{id}" verb=PATCH {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    int id
    text? title
    text? brand
    text? model
    int? year
    int? mileage
    text? fuel_type
    text? transmission
    text? body_type
    text? vehicle_type
    text? engine_volume
    text? first_registration
    int? owners_count
    text? color
    int? price
    text? city
    text? description
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "Войдите в кабинет, чтобы сохранить AI-черновик."
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
      error = "Этот черновик уже отправлен на модерацию."
    }

    db.edit car_drafts {
      field_name = "id"
      field_value = $draft.id
      data = {
        title: $input.title
        brand: $input.brand
        model: $input.model
        year: $input.year
        mileage: $input.mileage
        fuel_type: $input.fuel_type
        transmission: $input.transmission
        body_type: $input.body_type
        vehicle_type: $input.vehicle_type
        engine_volume: $input.engine_volume
        first_registration: $input.first_registration
        owners_count: $input.owners_count
        color: $input.color
        price: $input.price
        city: $input.city
        description: $input.description
        updated_at: now
      }
    } as $draft

    db.query car_draft_images {
      where = ($db.car_draft_images.draft_id == $draft.id)
      sort = {sort_order: "asc"}
    } as $images
  }

  response = {
    draft: $draft
    images: $images
  }

  tags = ["sitecraft-auto-market", "ai", "drafts"]
}

