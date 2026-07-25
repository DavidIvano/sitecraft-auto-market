// Xano endpoint: POST /ai/moderation/check-listing
// Read-only moderation assistant. Deterministic rules own score/risk/recommendation;
// OpenAI may only improve the human-readable explanation.
query "ai/moderation/check-listing" verb=POST {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    int listing_id filters=min:1
    json listing?
    json images?
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "unauthorized"
      error = "Unauthorized"
    }

    db.get automarket_users {
      field_name = "id"
      field_value = $auth.id
    } as $admin_user

    precondition ($admin_user != null) {
      error_type = "unauthorized"
      error = "Unauthorized"
    }

    // Never trust role, user_id, or an admin flag supplied by the frontend.
    precondition ($admin_user.role == "admin") {
      error_type = "accessdenied"
      error = "Admin access required"
    }

    db.get car_listings {
      field_name = "id"
      field_value = $input.listing_id
    } as $car

    precondition ($car != null) {
      error_type = "notfound"
      error = "Listing not found"
    }

    db.query car_listing_images {
      where = (($db.car_listing_images.car_listing_id == $input.listing_id) && ($db.car_listing_images.is_deleted != true))
      sort = {car_listing_images.sort_order: "asc"}
      return = {type: "list"}
    } as $backend_images

    // The frontend listing/images inputs are accepted for contract compatibility only.
    // All moderation decisions below use $car and $backend_images from the database.
    var $rate_limit_after {
      value = now|add_secs_to_timestamp:-3600
    }

    db.query ai_listing_checks {
      where = (($db.ai_listing_checks.user_id == $auth.id) && ($db.ai_listing_checks.type == "moderation_check") && ($db.ai_listing_checks.created_at >= $rate_limit_after))
      return = {type: "list"}
    } as $recent_checks

    precondition (($recent_checks|count) < 100) {
      error_type = "toomanyrequests"
      error = "Moderation AI rate limit reached. Try again later."
    }

    var $current_year {
      value = now|format_timestamp:"Y"|to_int
    }

    var $title {
      value = $car.title
        |first_notnull:""
        |to_text
        |trim
    }

    var $brand {
      value = $car.brand
        |first_notnull:""
        |to_text
        |trim
    }

    var $model_name {
      value = $car.model
        |first_notnull:""
        |to_text
        |trim
    }

    var $year {
      value = $car.year|first_notnull:0|to_int
    }

    var $mileage {
      value = $car.mileage|first_notnull:0|to_int
    }

    var $price {
      value = $car.price|first_notnull:0|to_decimal
    }

    var $city {
      value = $car.city
        |first_notnull:""
        |to_text
        |trim
    }

    var $country {
      value = $car.country
        |first_notnull:""
        |to_text
        |trim
    }

    var $vehicle_type {
      value = $car.vehicle_type
        |first_notnull:""
        |to_text
        |trim
    }

    var $body_type {
      value = $car.body_type
        |first_notnull:""
        |to_text
        |trim
    }

    var $color {
      value = $car.color
        |first_notnull:""
        |to_text
        |trim
    }

    var $fuel_type {
      value = $car.fuel_type
        |first_notnull:""
        |to_text
        |trim
    }

    var $transmission {
      value = $car.transmission
        |first_notnull:""
        |to_text
        |trim
    }

    var $doors {
      value = $car.doors
        |first_notnull:""
        |to_text
        |trim
    }

    var $seats {
      value = $car.seats
        |first_notnull:""
        |to_text
        |trim
    }

    var $engine_volume {
      value = $car.engine_volume
        |first_notnull:""
        |to_text
        |trim
    }

    var $vin {
      value = $car.vin
        |first_notnull:""
        |to_text
        |trim
        |to_upper
    }

    var $description {
      value = $car.description
        |first_notnull:""
        |to_text
        |trim
    }

    var $seller_name {
      value = $car.seller_name
        |first_notnull:""
        |to_text
        |trim
    }

    var $seller_phone {
      value = $car.seller_phone
        |first_notnull:""
        |to_text
        |trim
    }

    var $seller_email {
      value = $car.seller_email
        |first_notnull:""
        |to_text
        |trim
    }

    var $listing_status {
      value = $car.status
        |first_notnull:""
        |to_text
        |trim
        |to_lower
    }

    var $moderation_status {
      value = $car.moderation_status
        |first_notnull:""
        |to_text
        |trim
        |to_lower
    }

    var $main_image_url {
      value = $car.main_image_url
        |first_notnull:""
        |to_text
        |trim
    }

    var $image_count {
      value = $backend_images|count
    }

    var $description_length {
      value = $description|strlen
    }

    var $title_length {
      value = $title|strlen
    }

    var $fuel_lower {
      value = $fuel_type|to_lower
    }

    var $title_lower {
      value = $title|to_lower
    }

    var $description_upper {
      value = $description|to_upper
    }

    var $title_upper {
      value = $title|to_upper
    }

    var $city_is_numeric {
      value = "/^\\d+$/"|regex_matches:$city
    }

    var $vin_is_valid {
      value = "/^[A-HJ-NPR-Z0-9]{17}$/"|regex_matches:$vin
    }

    var $description_has_email {
      value = "/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/i"|regex_matches:$description
    }

    var $description_has_phone {
      value = "/(?:\\+?\\d[\\d ()-]{7,}\\d)/"|regex_matches:$description
    }

    var $description_has_link {
      value = "/https?:\\/\\//i"|regex_matches:$description
    }

    var $has_required_core {
      value = (($brand != "") && ($model_name != "") && ($year > 0) && ($price > 0) && ($mileage >= 0) && ($city != ""))
    }

    var $has_seller_contact {
      value = (($seller_phone != "") || ($seller_email != ""))
    }

    var $is_pending {
      value = (($listing_status == "pending_review") || ($moderation_status == "pending_review"))
    }

    var $is_administrative_status {
      value = (($listing_status == "deleted") || ($listing_status == "blocked") || ($listing_status == "archived") || ($moderation_status == "deleted") || ($moderation_status == "blocked") || ($moderation_status == "archived"))
    }

    var $is_final_status {
      value = (($listing_status == "approved") || ($listing_status == "sold") || ($moderation_status == "approved") || ($moderation_status == "published") || ($moderation_status == "sold"))
    }

    var $status_conflict {
      value = (($moderation_status != "") && ($listing_status != $moderation_status) && ($is_pending != true) && ($is_final_status != true) && ($is_administrative_status != true))
    }

    var $critical_issues {
      value = []
    }

    var $warning_issues {
      value = []
    }

    var $info_issues {
      value = []
    }

    var $warnings {
      value = []
    }

    var $issues {
      value = []
    }

    conditional {
      if ($title == "") {
        array.push $critical_issues {
          value = {
            field   : "title"
            severity: "critical"
            message : "Не указано название объявления."
          }
        }
      }
    }

    conditional {
      if ($brand == "") {
        array.push $critical_issues {
          value = {
            field   : "brand"
            severity: "critical"
            message : "Не указана марка автомобиля."
          }
        }
      }
    }

    conditional {
      if ($model_name == "") {
        array.push $critical_issues {
          value = {
            field   : "model"
            severity: "critical"
            message : "Не указана модель автомобиля."
          }
        }
      }
    }

    conditional {
      if (($year == 0) || ($year < 1950) || ($year > $current_year)) {
        array.push $critical_issues {
          value = {
            field   : "year"
            severity: "critical"
            message : "Указан некорректный год выпуска."
          }
        }
      }
    }

    conditional {
      if (($price <= 0) || ($price < 100) || ($price > 500000)) {
        array.push $critical_issues {
          value = {
            field   : "price"
            severity: "critical"
            message : "Укажите корректную цену от 100 до 500 000 EUR."
          }
        }
      }
    }

    conditional {
      if ($mileage < 0) {
        array.push $critical_issues {
          value = {
            field   : "mileage"
            severity: "critical"
            message : "Пробег не может быть отрицательным."
          }
        }
      }
    }

    conditional {
      if (($city == "") || $city_is_numeric) {
        array.push $critical_issues {
          value = {
            field   : "city"
            severity: "critical"
            message : "Город не указан или заполнен некорректно."
          }
        }
      }
    }

    conditional {
      if ($image_count == 0) {
        array.push $critical_issues {
          value = {
            field   : "photos"
            severity: "critical"
            message : "Добавьте минимум одну фотографию автомобиля."
          }
        }
      }
    }

    conditional {
      if (($vin != "") && ($vin_is_valid != true)) {
        array.push $critical_issues {
          value = {
            field   : "vin"
            severity: "critical"
            message : "VIN должен содержать 17 допустимых символов без I, O и Q."
          }
        }
      }
    }

    conditional {
      if (($fuel_lower|contains:"электро") && (($fuel_lower|contains:"дизель") || ($fuel_lower|contains:"бензин") || ($fuel_lower|contains:"газ") || ($fuel_lower|contains:"lpg"))) {
        array.push $critical_issues {
          value = {
            field   : "fuel_type"
            severity: "critical"
            message : "Тип топлива содержит несовместимые значения."
          }
        }
      }
    }

    conditional {
      if ($has_seller_contact != true) {
        array.push $critical_issues {
          value = {
            field   : "seller_contact"
            severity: "critical"
            message : "Не указан телефон или email продавца."
          }
        }
      }
    }

    conditional {
      if (($seller_name == "") || ("/^\\d+$/"|regex_matches:$seller_name)) {
        array.push $critical_issues {
          value = {
            field   : "seller_name"
            severity: "critical"
            message : "Имя продавца отсутствует или заполнено некорректно."
          }
        }
      }
    }

    conditional {
      if (($car.user_id|first_notnull:0|to_int) <= 0) {
        array.push $critical_issues {
          value = {
            field   : "user_id"
            severity: "critical"
            message : "У объявления не подтверждён владелец."
          }
        }
      }
    }

    conditional {
      if ($status_conflict) {
        array.push $critical_issues {
          value = {
            field   : "status"
            severity: "critical"
            message : "Статусы объявления противоречат процессу модерации."
          }
        }
      }
    }

    conditional {
      if ($description_length == 0) {
        array.push $warning_issues {
          value = {
            field   : "description"
            severity: "warning"
            message : "Добавьте описание автомобиля."
          }
        }
      }
    }

    conditional {
      if (($description_length > 0) && ($description_length < 80)) {
        array.push $warning_issues {
          value = {
            field   : "description"
            severity: "warning"
            message : "Описание слишком короткое: добавьте состояние, обслуживание и комплектацию."
          }
        }
      }
    }

    conditional {
      if (($description_length >= 80) && ($description_length < 250)) {
        array.push $warning_issues {
          value = {
            field   : "description"
            severity: "warning"
            message : "Описание можно дополнить сведениями о состоянии и обслуживании."
          }
        }
      }
    }

    conditional {
      if (($image_count > 0) && ($image_count < 3)) {
        array.push $warning_issues {
          value = {
            field   : "photos"
            severity: "warning"
            message : "Добавьте не менее трёх фотографий с разных ракурсов."
          }
        }
      }
    }

    conditional {
      if (($mileage == 0) && ($year > 0) && ($year < ($current_year - 1))) {
        array.push $warning_issues {
          value = {
            field   : "mileage"
            severity: "warning"
            message : "Для ненового автомобиля указан нулевой пробег."
          }
        }
      }
    }

    conditional {
      if (($price > 0) && ($price < 1000) && ($year >= ($current_year - 5))) {
        array.push $warning_issues {
          value = {
            field   : "price"
            severity: "warning"
            message : "Цена выглядит необычно низкой для автомобиля этого года."
          }
        }
      }
    }

    conditional {
      if ($body_type == "") {
        array.push $warning_issues {
          value = {
            field   : "body_type"
            severity: "warning"
            message : "Не указан тип кузова."
          }
        }
      }
    }

    conditional {
      if ($fuel_type == "") {
        array.push $warning_issues {
          value = {
            field   : "fuel_type"
            severity: "warning"
            message : "Не указан тип топлива."
          }
        }
      }
    }

    conditional {
      if ($transmission == "") {
        array.push $warning_issues {
          value = {
            field   : "transmission"
            severity: "warning"
            message : "Не указана коробка передач."
          }
        }
      }
    }

    conditional {
      if ($color == "") {
        array.push $warning_issues {
          value = {
            field   : "color"
            severity: "warning"
            message : "Не указан цвет автомобиля."
          }
        }
      }
    }

    conditional {
      if ($doors == "") {
        array.push $warning_issues {
          value = {
            field   : "doors"
            severity: "warning"
            message : "Не указано количество дверей."
          }
        }
      }
    }

    conditional {
      if ($seats == "") {
        array.push $warning_issues {
          value = {
            field   : "seats"
            severity: "warning"
            message : "Не указано количество мест."
          }
        }
      }
    }

    conditional {
      if ((($fuel_lower|contains:"бензин") || ($fuel_lower|contains:"дизель")) && ($engine_volume == "")) {
        array.push $warning_issues {
          value = {
            field   : "engine_volume"
            severity: "warning"
            message : "Не указан объём двигателя."
          }
        }
      }
    }

    conditional {
      if ($country == "") {
        array.push $warning_issues {
          value = {
            field   : "country"
            severity: "warning"
            message : "Не указана страна продажи."
          }
        }
      }
    }

    conditional {
      if (($title_length >= 10) && ($title == $title_upper) && ("/[A-ZА-ЯЁ]/u"|regex_matches:$title)) {
        array.push $warning_issues {
          value = {
            field   : "title"
            severity: "warning"
            message : "Название содержит слишком много заглавных букв."
          }
        }
      }
    }

    conditional {
      if (($description_length >= 40) && ($description == $description_upper) && ("/[A-ZА-ЯЁ]/u"|regex_matches:$description)) {
        array.push $warning_issues {
          value = {
            field   : "description"
            severity: "warning"
            message : "Описание содержит слишком много заглавных букв."
          }
        }
      }
    }

    conditional {
      if ($description_has_email || $description_has_phone) {
        array.push $warning_issues {
          value = {
            field   : "description"
            severity: "warning"
            message : "В описании найдены контактные данные; проверьте соответствие правилам площадки."
          }
        }
      }
    }

    conditional {
      if ($description_has_link) {
        array.push $warning_issues {
          value = {
            field   : "description"
            severity: "warning"
            message : "В описании найдена внешняя ссылка; проверьте её вручную."
          }
        }
      }
    }

    conditional {
      if (($title_length > 0) && ($title_length < 8)) {
        array.push $warning_issues {
          value = {
            field   : "title"
            severity: "warning"
            message : "Название объявления подозрительно короткое."
          }
        }
      }
    }

    conditional {
      if (($brand != "") && (($title_lower|contains:($brand|to_lower)) != true)) {
        array.push $warning_issues {
          value = {
            field   : "title"
            severity: "warning"
            message : "Название не содержит марку автомобиля."
          }
        }
      }
    }

    conditional {
      if (($model_name != "") && (($title_lower|contains:($model_name|to_lower)) != true)) {
        array.push $warning_issues {
          value = {
            field   : "title"
            severity: "warning"
            message : "Название не содержит модель автомобиля."
          }
        }
      }
    }

    conditional {
      if (($image_count > 0) && ($main_image_url == "")) {
        array.push $warning_issues {
          value = {
            field   : "main_image_url"
            severity: "warning"
            message : "При наличии фотографий не выбрано главное изображение."
          }
        }
      }
    }

    conditional {
      if ($is_administrative_status) {
        array.push $warning_issues {
          value = {
            field   : "status"
            severity: "warning"
            message : "Объявление уже имеет административный статус и требует ручной проверки."
          }
        }
      }
    }

    var $has_interior_photo {
      value = false
    }

    var $has_dashboard_photo {
      value = false
    }

    foreach ($backend_images) {
      each as $backend_image {
        var $image_url {
          value = $backend_image.image_url
            |first_notnull:""
            |to_text
            |trim
            |to_lower
        }

        var $image_metadata {
          value = $backend_image.image_metadata|first_notnull:{}
        }

        var $image_label {
          value = $image_metadata
            |get:"view_type":""
            |first_notnull:""
            |to_text
            |to_lower
        }

        conditional {
          if (($image_url|starts_with:"https://") != true) {
            array.push $warning_issues {
              value = {
                field   : "photos"
                severity: "warning"
                message : "Одно из изображений не использует публичный HTTPS URL."
              }
            }
          }
        }

        conditional {
          if (($image_url|starts_with:"blob:") || ($image_url|starts_with:"data:") || ($image_url|contains:"localhost")) {
            array.push $warning_issues {
              value = {
                field   : "photos"
                severity: "warning"
                message : "Одно из изображений доступно только локально и не подходит для публикации."
              }
            }
          }
        }

        conditional {
          if (($image_label|contains:"interior") || ($image_label|contains:"салон")) {
            var.update $has_interior_photo {
              value = true
            }
          }
        }

        conditional {
          if (($image_label|contains:"dashboard") || ($image_label|contains:"прибор")) {
            var.update $has_dashboard_photo {
              value = true
            }
          }
        }
      }
    }

    conditional {
      if ($vin == "") {
        array.push $info_issues {
          value = {
            field   : "vin"
            severity: "info"
            message : "VIN не указан; это необязательное поле."
          }
        }
      }
    }

    conditional {
      if (($car|get:"tuv_hu":""|first_notnull:"") == "") {
        array.push $info_issues {
          value = {
            field   : "tuv_hu"
            severity: "info"
            message : "Срок TÜV/HU не указан."
          }
        }
      }
    }

    conditional {
      if ((($car.owners_count|first_notnull:0|to_int) <= 0) && (($car.owner_count|first_notnull:0|to_int) <= 0)) {
        array.push $info_issues {
          value = {
            field   : "owners_count"
            severity: "info"
            message : "Количество владельцев не указано."
          }
        }
      }
    }

    conditional {
      if (($car|get:"service_history":""|first_notnull:"") == "") {
        array.push $info_issues {
          value = {
            field   : "service_history"
            severity: "info"
            message : "Сервисная история не указана."
          }
        }
      }
    }

    conditional {
      if (($car|get:"reason_for_sale":""|first_notnull:"") == "") {
        array.push $info_issues {
          value = {
            field   : "reason_for_sale"
            severity: "info"
            message : "Причина продажи не указана."
          }
        }
      }
    }

    conditional {
      if (($description_length > 0) && ("/[А-Яа-яЁё]/u"|regex_matches:$description) && (("/[A-Za-z]/"|regex_matches:$description) != true)) {
        array.push $info_issues {
          value = {
            field   : "description"
            severity: "info"
            message : "Нет немецкой версии описания."
          }
        }
      }
    }

    conditional {
      if ($has_interior_photo != true) {
        array.push $info_issues {
          value = {
            field   : "photos"
            severity: "info"
            message : "По metadata не удалось подтвердить наличие фотографии салона."
          }
        }
      }
    }

    conditional {
      if ($has_dashboard_photo != true) {
        array.push $info_issues {
          value = {
            field   : "photos"
            severity: "info"
            message : "По metadata не удалось подтвердить наличие фотографии приборной панели."
          }
        }
      }
    }

    foreach ($critical_issues) {
      each as $critical_issue {
        array.push $issues {
          value = $critical_issue
        }
      }
    }

    foreach ($warning_issues) {
      each as $warning_issue {
        array.push $issues {
          value = $warning_issue
        }

        array.push $warnings {
          value = $warning_issue.message
        }
      }
    }

    foreach ($info_issues) {
      each as $info_issue {
        array.push $issues {
          value = $info_issue
        }
      }
    }

    var.update $warnings {
      value = $warnings|unique
    }

    var $critical_count {
      value = $critical_issues|count
    }

    var $warning_count {
      value = $warning_issues|count
    }

    var $info_count {
      value = $info_issues|count
    }

    var $trust_score {
      value = 100 - ($critical_count * 15) - ($warning_count * 5) - ($info_count * 1)
    }

    conditional {
      if ($image_count == 0) {
        var.update $trust_score {
          value = $trust_score - 15
        }
      }
    }

    conditional {
      if ($image_count == 1) {
        var.update $trust_score {
          value = $trust_score - 6
        }
      }
    }

    conditional {
      if ($description_length == 0) {
        var.update $trust_score {
          value = $trust_score - 8
        }
      }
    }

    conditional {
      if ($has_seller_contact != true) {
        var.update $trust_score {
          value = $trust_score - 15
        }
      }
    }

    conditional {
      if ($status_conflict) {
        var.update $trust_score {
          value = $trust_score - 10
        }
      }
    }

    conditional {
      if ($image_count >= 3) {
        var.update $trust_score {
          value = $trust_score + 3
        }
      }
    }

    conditional {
      if ($description_length >= 250) {
        var.update $trust_score {
          value = $trust_score + 3
        }
      }
    }

    conditional {
      if ($vin_is_valid) {
        var.update $trust_score {
          value = $trust_score + 2
        }
      }
    }

    conditional {
      if ($has_required_core) {
        var.update $trust_score {
          value = $trust_score + 5
        }
      }
    }

    conditional {
      if ($moderation_status == "pending_review") {
        var.update $trust_score {
          value = $trust_score + 1
        }
      }
    }

    conditional {
      if ($trust_score < 0) {
        var.update $trust_score {
          value = 0
        }
      }
    }

    conditional {
      if ($trust_score > 100) {
        var.update $trust_score {
          value = 100
        }
      }
    }

    var.update $trust_score {
      value = $trust_score|round|to_int
    }

    var $risk_level {
      value = "low"
    }

    conditional {
      if (($critical_count >= 2) || ($trust_score < 40) || (($car.user_id|first_notnull:0|to_int) <= 0) || $status_conflict) {
        var.update $risk_level {
          value = "high"
        }
      }
    }

    conditional {
      if (($risk_level != "high") && (($critical_count == 1) || ($warning_count >= 3) || (($trust_score >= 40) && ($trust_score <= 69)))) {
        var.update $risk_level {
          value = "medium"
        }
      }
    }

    var $recommendation {
      value = "manual_review"
    }

    conditional {
      if (($is_administrative_status != true) && ($is_final_status != true)) {
        conditional {
          if (($risk_level == "low") && ($critical_count == 0) && ($trust_score >= 80) && $is_pending && $has_required_core) {
            var.update $recommendation {
              value = "approve"
            }
          }
        }

        conditional {
          if (($risk_level == "medium") && ($trust_score >= 40) && ($trust_score <= 79)) {
            var.update $recommendation {
              value = "needs_fix"
            }
          }
        }

        conditional {
          if (($risk_level == "high") && ($critical_count >= 2)) {
            var.update $recommendation {
              value = "reject"
            }
          }
        }
      }
    }

    var $suggested_action {
      value = "manual_review"
    }

    conditional {
      if ($recommendation == "approve") {
        var.update $suggested_action {
          value = "approve"
        }
      }
    }

    conditional {
      if ($recommendation == "needs_fix") {
        var.update $suggested_action {
          value = "send_to_fix"
        }
      }
    }

    conditional {
      if ($recommendation == "reject") {
        var.update $suggested_action {
          value = "reject"
        }
      }
    }

    conditional {
      if ($recommendation == "block") {
        var.update $suggested_action {
          value = "manual_block_review"
        }
      }
    }

    var $summary {
      value = "Выполнена локальная проверка полноты и согласованности данных объявления."
    }

    var $suggested_rejection_reason {
      value = "Объявление выглядит заполненным. Финальное решение остаётся за модератором."
    }

    conditional {
      if ($recommendation == "approve") {
        var.update $summary {
          value = "Основные данные заполнены и явных критических несоответствий не найдено. Требуется финальная проверка модератором."
        }
      }
    }

    conditional {
      if ($recommendation == "needs_fix") {
        var.update $summary {
          value = "Объявление содержит основные данные, но перед публикацией требует исправлений."
        }

        var.update $suggested_rejection_reason {
          value = "Объявление пока не прошло модерацию. Пожалуйста, исправьте указанные пункты и после этого отправьте объявление на модерацию повторно."
        }
      }
    }

    conditional {
      if ($recommendation == "reject") {
        var.update $summary {
          value = "В объявлении обнаружено несколько критических несоответствий."
        }

        var.update $suggested_rejection_reason {
          value = "Объявление отклонено из-за критических несоответствий в данных. Проверьте обязательные поля, контактные данные продавца и фотографии."
        }
      }
    }

    conditional {
      if ($recommendation == "manual_review") {
        var.update $summary {
          value = "Автоматической рекомендации недостаточно: объявление требует ручной проверки модератором."
        }

        var.update $suggested_rejection_reason {
          value = "Требуется ручная проверка объявления и его текущего статуса. Автоматические действия не выполнялись."
        }
      }
    }

    var $moderator_notes {
      value = []
    }

    var $user_facing_issues {
      value = $warnings
    }

    var $fallback {
      value = true
    }

    var $log_status {
      value = "fallback"
    }

    var $error_message {
      value = null
    }

    var $model {
      value = $env.OPENAI_CAR_AI_MODEL
    }

    conditional {
      if (($model == null) || ($model == "")) {
        var.update $model {
          value = "gpt-5.4-mini"
        }
      }
    }

    var $openai_context {
      value = {
        listing_id        : $input.listing_id
        risk_level        : $risk_level
        trust_score       : $trust_score
        issues            : $issues
        recommendation    : $recommendation
        suggested_action  : $suggested_action
        local_summary     : $summary
        local_reason      : $suggested_rejection_reason
        safe_listing_facts: {title: $title, brand: $brand, model: $model_name, year: $year, mileage: $mileage, price: $price, city: $city, country: $country, body_type: $body_type, fuel_type: $fuel_type, transmission: $transmission, image_count: $image_count}
      }
    }

    var $openai_auth_header {
      value = "Authorization: Bearer "|concat:$env.OPENAI_API_KEY
    }

    api.request {
      url = "https://api.openai.com/v1/responses"
      method = "POST"
      params = {
        model: $model
        input: [
            {role: "developer", content: [{type: "input_text", text: "Ты помощник модератора автомобильного маркетплейса. Тебе передают уже рассчитанные правилами risk level, trust score, issues и recommendation. Не изменяй числовые оценки и решение. Не утверждай, что автомобиль технически проверен, исправен, без ДТП или юридически чист. Сформулируй понятное краткое объяснение и корректную причину исправления или отказа. Не раскрывай внутренние security details и персональные данные. Верни только JSON по схеме."}]}
            {role: "user", content: [{type: "input_text", text: $openai_context|json_encode}]}
          ]
        text : {
          format: {
            type: "json_schema"
            name: "moderation_explanation"
            strict: true
            schema: {
              type: "object"
              additionalProperties: false
              properties: {
                summary: {type: "string"}
                moderator_notes: {type: "array", items: {type: "string"}}
                suggested_rejection_reason: {type: "string"}
                user_facing_issues: {type: "array", items: {type: "string"}}
              }
              required: ["summary", "moderator_notes", "suggested_rejection_reason", "user_facing_issues"]
            }
          }
        }
      }

      headers = []
        |push:$openai_auth_header
        |push:"Content-Type: application/json"
    } as $openai_response

    conditional {
      if ($openai_response.response.status == 200) {
        var $output_text {
          value = $openai_response.response.result.output[0].content[0].text
        }

        conditional {
          if (($output_text == null) || ($output_text == "")) {
            var.update $output_text {
              value = $openai_response.response.result.output_text
            }
          }
        }

        conditional {
          if (($output_text != null) && ($output_text != "")) {
            try_catch {
              try {
                var $ai_text {
                  value = $output_text|json_decode
                }

                // Intentionally copy only explanatory fields. Score/risk/recommendation/action stay deterministic.
                var.update $summary {
                  value = $ai_text.summary
                }

                var.update $moderator_notes {
                  value = $ai_text.moderator_notes
                }

                var.update $suggested_rejection_reason {
                  value = $ai_text.suggested_rejection_reason
                }

                var.update $user_facing_issues {
                  value = $ai_text.user_facing_issues
                }

                var.update $fallback {
                  value = false
                }

                var.update $log_status {
                  value = "success"
                }
              }

              catch {
                var.update $error_message {
                  value = "OpenAI output was not valid JSON"
                }
              }
            }
          }

          else {
            var.update $error_message {
              value = "OpenAI returned empty output_text"
            }
          }
        }
      }

      else {
        var.update $error_message {
          value = "OpenAI Responses API request failed"
        }
      }
    }

    var $response_model {
      value = $model
    }

    conditional {
      if ($fallback) {
        var.update $response_model {
          value = "local-rules"
        }
      }
    }

    var $photo_quality_score {
      value = 0
    }

    conditional {
      if ($image_count == 1) {
        var.update $photo_quality_score {
          value = 45
        }
      }
    }

    conditional {
      if ($image_count == 2) {
        var.update $photo_quality_score {
          value = 65
        }
      }
    }

    conditional {
      if ($image_count >= 3) {
        var.update $photo_quality_score {
          value = 85
        }
      }
    }

    conditional {
      if ($image_count >= 5) {
        var.update $photo_quality_score {
          value = 95
        }
      }
    }

    db.add ai_listing_checks {
      data = {
        created_at           : now
        updated_at           : now
        user_id              : $auth.id
        draft_id             : $car.draft_id|first_notnull:0
        car_id               : $input.listing_id
        type                 : "moderation_check"
        score                : $trust_score
        listing_quality_score: $trust_score
        photo_quality_score  : $photo_quality_score
        trust_score          : $trust_score
        risk_level           : $risk_level
        warnings             : $warnings
        recommendations      : $user_facing_issues
        issues               : $issues
        next_best_actions    : [{recommendation: $recommendation, action: $suggested_action}]
        summary              : $summary
        model                : $response_model
        status               : $log_status
        error_message        : $error_message
        raw_ai_payload       : null
        metadata             : {
        listing_status   : $listing_status
        moderation_status: $moderation_status
        image_count      : $image_count
        recommendation   : $recommendation
        suggested_action : $suggested_action
        rules_version    : "moderation-v1"
        fallback         : $fallback
      }
      }
    } as $moderation_check_log
  }

  response = {
    success                   : true
    fallback                  : $fallback
    listing_id                : $input.listing_id
    score                     : $trust_score
    risk_level                : $risk_level
    trust_score               : $trust_score
    issues                    : $issues
    warnings                  : $warnings
    recommendation            : $recommendation
    suggested_action          : $suggested_action
    summary                   : $summary
    suggested_rejection_reason: $suggested_rejection_reason
    moderator_notes           : $moderator_notes
    model                     : $response_model
  }

  tags = ["sitecraft-auto-market", "ai", "moderation", "admin"]
}
