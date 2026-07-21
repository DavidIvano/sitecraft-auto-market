// Endpoint: GET /dashboard/drafts/{id}
// Возвращает AI-черновик только владельцу.

query "dashboard/drafts/{id}" verb=GET {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    int id
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "Войдите в кабинет, чтобы открыть AI-черновик."
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

