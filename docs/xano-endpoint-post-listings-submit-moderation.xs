// Endpoint: POST /listings/submit-moderation
// Explicit seller action: validates an owned draft/listing and moves one listing to pending_review.
// Never approves, publishes, or charges AI credits.
query "listings/submit-moderation" verb=POST {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    int draft_id?
    int listing_id?
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "unauthorized"
      error = "Unauthorized"
    }
  
    precondition (($input.draft_id != null) || ($input.listing_id != null)) {
      error_type = "inputerror"
      error = "draft_id or listing_id is required"
    }
  
    db.get automarket_users {
      field_name = "id"
      field_value = $auth.id
    } as $auth_user
  
    precondition ($auth_user != null) {
      error_type = "unauthorized"
      error = "Unauthorized"
    }
  
    var $draft {
      value = null
    }
  
    var $car {
      value = null
    }
  
    var $draft_images {
      value = []
    }
  
    var $listing_images {
      value = []
    }
  
    var $using_draft {
      value = false
    }
  
    var $already_submitted {
      value = false
    }
  
    conditional {
      if ($input.draft_id != null) {
        db.get car_drafts {
          field_name = "id"
          field_value = $input.draft_id
        } as $draft_record
      
        precondition ($draft_record != null) {
          error_type = "notfound"
          error = "Draft not found"
        }
      
        precondition ($draft_record.user_id == $auth.id) {
          error_type = "accessdenied"
          error = "You do not have access to this draft"
        }
      
        precondition (($draft_record.status != "deleted") && ($draft_record.status != "blocked") && ($draft_record.status != "archived")) {
          error_type = "inputerror"
          error = "This draft cannot be submitted"
        }
      
        var.update $draft {
          value = $draft_record
        }
      
        var.update $using_draft {
          value = true
        }
      
        db.query car_draft_images {
          where = (($db.car_draft_images.draft_id == $draft_record.id) && ($db.car_draft_images.user_id == $auth.id))
          sort = {car_draft_images.sort_order: "asc"}
          return = {type: "list"}
        } as $owned_draft_images
      
        var.update $draft_images {
          value = $owned_draft_images
        }
      
        conditional {
          if (($draft_record.car_id != null) && ($draft_record.car_id > 0)) {
            db.get car_listings {
              field_name = "id"
              field_value = $draft_record.car_id
            } as $linked_car
          
            precondition ($linked_car != null) {
              error_type = "notfound"
              error = "Listing not found"
            }
          
            precondition ($linked_car.user_id == $auth.id) {
              error_type = "accessdenied"
              error = "You do not have access to this listing"
            }
          
            precondition (($input.listing_id == null) || ($input.listing_id == $linked_car.id)) {
              error_type = "accessdenied"
              error = "You do not have access to this draft"
            }
          
            var.update $car {
              value = $linked_car
            }
          }
        
          else {
            db.query car_listings {
              where = ($db.car_listings.draft_id == $draft_record.id)
              return = {type: "single"}
            } as $car_by_draft
          
            conditional {
              if ($car_by_draft != null) {
                precondition ($car_by_draft.user_id == $auth.id) {
                  error_type = "accessdenied"
                  error = "You do not have access to this listing"
                }
              
                precondition (($input.listing_id == null) || ($input.listing_id == $car_by_draft.id)) {
                  error_type = "accessdenied"
                  error = "You do not have access to this draft"
                }
              
                var.update $car {
                  value = $car_by_draft
                }
              }
            }
          }
        }
      }
    }
  
    conditional {
      if (($input.listing_id != null) && ($car == null)) {
        db.get car_listings {
          field_name = "id"
          field_value = $input.listing_id
        } as $listing_record
      
        precondition ($listing_record != null) {
          error_type = "notfound"
          error = "Listing not found"
        }
      
        precondition ($listing_record.user_id == $auth.id) {
          error_type = "accessdenied"
          error = "You do not have access to this listing"
        }
      
        var.update $car {
          value = $listing_record
        }
      }
    }
  
    conditional {
      if ($car != null) {
        precondition (($car.status != "deleted") && ($car.status != "blocked") && ($car.status != "archived") && ($car.status != "sold")) {
          error_type = "inputerror"
          error = "This listing cannot be submitted"
        }
      
        db.query car_listing_images {
          where = (($db.car_listing_images.car_listing_id == $car.id) && ($db.car_listing_images.is_deleted != true))
          sort = {car_listing_images.sort_order: "asc"}
          return = {type: "list"}
        } as $active_listing_images
      
        var.update $listing_images {
          value = $active_listing_images
        }
      
        conditional {
          if (($car.status == "pending_review") || ($car.moderation_status == "pending_review")) {
            var.update $already_submitted {
              value = true
            }
          }
        }
      }
    }
  
    var $payload {
      value = {}
    }
  
    conditional {
      if (($draft != null) && ($draft.ai_payload|is_object)) {
        var.update $payload {
          value = $draft.ai_payload
        }
      }
    }

    // Scores are persisted from the confirmed draft. Null means that quality-score
    // was not run; it must never become a fabricated public 0% badge.
    var $payload_scores {
      value = $payload|get:"scores":{}
    }
  
    // Direct submissions do not have a draft. Keep the draft scores nullable
    // until an owned draft was actually loaded instead of dereferencing null.
    var $draft_listing_quality_score {
      value = null
    }
  
    var $draft_photo_quality_score {
      value = null
    }
  
    var $draft_trust_score {
      value = null
    }
  
    conditional {
      if ($draft != null) {
        var.update $draft_listing_quality_score {
          value = $draft.listing_quality_score
        }
      
        var.update $draft_photo_quality_score {
          value = $draft.photo_quality_score
        }
      
        var.update $draft_trust_score {
          value = $draft.trust_score
        }
      }
    }
  
    var $listing_quality_score {
      value = $draft_listing_quality_score|first_notnull:($payload_scores|get:"listing_quality_score":null)
    }
  
    var $photo_quality_score {
      value = $draft_photo_quality_score|first_notnull:($payload_scores|get:"photo_quality_score":null)
    }
  
    var $trust_score {
      value = $draft_trust_score|first_notnull:($payload_scores|get:"trust_score":null)
    }
  
    var $title {
      value = ""
    }
  
    var $brand {
      value = ""
    }
  
    var $model_name {
      value = ""
    }
  
    var $year {
      value = 0
    }
  
    var $mileage {
      value = 0
    }
  
    var $price {
      value = 0
    }
  
    var $city {
      value = ""
    }
  
    var $country {
      value = ""
    }
  
    var $fuel_type {
      value = ""
    }
  
    var $transmission {
      value = ""
    }
  
    var $description {
      value = ""
    }
  
    var $vehicle_type {
      value = ""
    }
  
    var $body_type {
      value = ""
    }
  
    var $engine_volume {
      value = ""
    }
  
    var $color {
      value = ""
    }
  
    var $vin {
      value = ""
    }
  
    var $doors {
      value = ""
    }
  
    var $seats {
      value = ""
    }
  
    var $drivetrain {
      value = ""
    }
  
    var $owners_count {
      value = ""
    }
  
    var $first_registration {
      value = ""
    }
  
    var $vehicle_condition {
      value = ""
    }
  
    var $seller_type {
      value = ""
    }
  
    var $has_valid_tuv {
      value = null
    }
  
    var $tuv_valid_until {
      value = ""
    }
  
    var $currency {
      value = "EUR"
    }
  
    var $seller_name {
      value = ""
    }
  
    var $seller_phone {
      value = ""
    }
  
    var $seller_email {
      value = ""
    }
  
    var $is_ai_generated {
      value = false
    }
  
    var $images_for_validation {
      value = []
    }
  
    conditional {
      if ($using_draft) {
        var.update $title {
          value = $draft.title
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $brand {
          value = $draft.brand
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $model_name {
          value = $draft.model
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $year {
          value = $draft.year|first_notnull:0|to_int
        }
      
        var.update $mileage {
          value = $draft.mileage|first_notnull:0|to_int
        }
      
        var.update $price {
          value = $draft.price|first_notnull:0|to_decimal
        }
      
        var.update $city {
          value = $draft.city
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $country {
          value = $payload
            |get:"fields.country":""
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $fuel_type {
          value = $draft.fuel_type
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $transmission {
          value = $draft.transmission
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $description {
          value = $draft.description
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $vehicle_type {
          value = $draft.vehicle_type
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $body_type {
          value = $draft.body_type
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $engine_volume {
          value = $draft.engine_volume
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $color {
          value = $draft.color
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $vin {
          value = $payload
            |get:"fields.vin":""
            |first_notnull:""
            |to_text
            |trim
            |to_upper
        }
      
        var.update $doors {
          value = $payload
            |get:"fields.doors":""
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $seats {
          value = $draft.seats
            |first_notnull:($payload|get:"fields.seats":"")
            |to_text
            |trim
        }
      
        var.update $drivetrain {
          value = $draft.drivetrain
            |first_notnull:($payload|get:"fields.drivetrain":"")
            |to_text
            |trim
        }
      
        var.update $owners_count {
          value = $draft.owners_count
            |first_notnull:($payload|get:"fields.owners_count":"")
            |to_text
            |trim
        }
      
        var.update $first_registration {
          value = $draft.first_registration
            |first_notnull:($payload
              |get:"fields.first_registration":""
            )
            |to_text
            |trim
        }
      
        var.update $vehicle_condition {
          value = $draft.vehicle_condition
            |first_notnull:($payload
              |get:"fields.vehicle_condition":""
            )
            |to_text
            |trim
        }
      
        var.update $seller_type {
          value = $draft.seller_type
            |first_notnull:($payload|get:"fields.seller_type":"")
            |to_text
            |trim
        }
      
        var.update $has_valid_tuv {
          value = $draft.has_valid_tuv
            |first_notnull:($payload|get:"fields.has_valid_tuv":null)
        }
      
        var.update $tuv_valid_until {
          value = $draft.tuv_valid_until
            |first_notnull:($payload|get:"fields.tuv_valid_until":"")
            |to_text
            |trim
        }
      
        var.update $currency {
          value = $payload
            |get:"fields.currency":"EUR"
            |first_notnull:"EUR"
            |to_text
            |trim
            |to_upper
        }
      
        var.update $seller_name {
          value = $payload
            |get:"seller.name":""
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $seller_phone {
          value = $payload
            |get:"seller.phone":""
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $seller_email {
          value = $payload
            |get:"seller.email":""
            |first_notnull:""
            |to_text
            |trim
            |to_lower
        }
      
        var.update $is_ai_generated {
          value = $draft.is_ai_generated|first_notnull:false
        }
      
        var.update $images_for_validation {
          value = $draft_images
        }
      
        conditional {
          if ($country == "") {
            var.update $country {
              value = "Германия"
            }
          }
        }
      
        conditional {
          if ($currency == "") {
            var.update $currency {
              value = "EUR"
            }
          }
        }
      
        conditional {
          if ($seller_name == "") {
            var.update $seller_name {
              value = $auth_user.name
                |first_notnull:""
                |to_text
                |trim
            }
          }
        }
      
        conditional {
          if (($seller_phone == "") && ($seller_email == "")) {
            var.update $seller_email {
              value = $auth_user.email
                |first_notnull:""
                |to_text
                |trim
                |to_lower
            }
          }
        }
      }
    
      else {
        var.update $title {
          value = $car.title
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $brand {
          value = $car.brand
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $model_name {
          value = $car.model
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $year {
          value = $car.year|first_notnull:0|to_int
        }
      
        var.update $mileage {
          value = $car.mileage|first_notnull:0|to_int
        }
      
        var.update $price {
          value = $car.price|first_notnull:0|to_decimal
        }
      
        var.update $city {
          value = $car.city
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $country {
          value = $car.country
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $fuel_type {
          value = $car.fuel_type
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $transmission {
          value = $car.transmission
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $description {
          value = $car.description
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $vehicle_type {
          value = $car.vehicle_type
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $body_type {
          value = $car.body_type
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $engine_volume {
          value = $car.engine_volume
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $color {
          value = $car.color
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $vin {
          value = $car.vin
            |first_notnull:""
            |to_text
            |trim
            |to_upper
        }
      
        var.update $doors {
          value = $car.doors
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $seats {
          value = $car.seats
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $drivetrain {
          value = $car.drivetrain
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $owners_count {
          value = $car.owners_count
            |first_notnull:$car.owner_count
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $first_registration {
          value = $car.first_registration
            |first_notnull:$car.first_registration_date
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $vehicle_condition {
          value = $car.vehicle_condition
            |first_notnull:$car.condition
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $seller_type {
          value = $car.seller_type
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $has_valid_tuv {
          value = $car.has_valid_tuv
        }
      
        var.update $tuv_valid_until {
          value = $car.tuv_valid_until
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $currency {
          value = $car.currency
            |first_notnull:"EUR"
            |to_text
            |trim
            |to_upper
        }
      
        var.update $seller_name {
          value = $car.seller_name
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $seller_phone {
          value = $car.seller_phone
            |first_notnull:""
            |to_text
            |trim
        }
      
        var.update $seller_email {
          value = $car.seller_email
            |first_notnull:""
            |to_text
            |trim
            |to_lower
        }
      
        var.update $is_ai_generated {
          value = $car.is_ai_generated|first_notnull:false
        }
      
        var.update $images_for_validation {
          value = $listing_images
        }
      }
    }
  
    var $errors {
      value = []
    }
  
    var $current_year {
      value = now|format_timestamp:"Y"|to_int
    }
  
    conditional {
      if ($title == "") {
        array.push $errors {
          value = {
            field  : "title"
            message: "Укажите название объявления."
          }
        }
      }
    }
  
    conditional {
      if ($brand == "") {
        array.push $errors {
          value = {
            field  : "brand"
            message: "Укажите марку автомобиля."
          }
        }
      }
    }
  
    conditional {
      if ($model_name == "") {
        array.push $errors {
          value = {
            field  : "model"
            message: "Укажите модель автомобиля."
          }
        }
      }
    }
  
    conditional {
      if (($year < 1950) || ($year > $current_year)) {
        array.push $errors {
          value = {
            field  : "year"
            message: "Укажите корректный год выпуска."
          }
        }
      }
    }
  
    conditional {
      if ($mileage < 0) {
        array.push $errors {
          value = {
            field  : "mileage"
            message: "Укажите корректный пробег."
          }
        }
      }
    }
  
    conditional {
      if (($price < 100) || ($price > 500000)) {
        array.push $errors {
          value = {
            field  : "price"
            message: "Укажите корректную цену."
          }
        }
      }
    }
  
    conditional {
      if (($city == "") || ("/^\\d+$/"|regex_matches:$city)) {
        array.push $errors {
          value = {
            field  : "city"
            message: "Укажите корректный город."
          }
        }
      }
    }
  
    conditional {
      if ($country == "") {
        array.push $errors {
          value = {
            field  : "country"
            message: "Укажите страну."
          }
        }
      }
    }
  
    conditional {
      if ($fuel_type == "") {
        array.push $errors {
          value = {
            field  : "fuel_type"
            message: "Укажите тип топлива."
          }
        }
      }
    }
  
    conditional {
      if ($transmission == "") {
        array.push $errors {
          value = {
            field  : "transmission"
            message: "Укажите коробку передач."
          }
        }
      }
    }
  
    conditional {
      if ($vehicle_type == "") {
        array.push $errors {
          value = {
            field  : "vehicle_type"
            message: "Укажите тип транспорта."
          }
        }
      }
    }
  
    conditional {
      if ($body_type == "") {
        array.push $errors {
          value = {
            field  : "body_type"
            message: "Укажите тип кузова."
          }
        }
      }
    }
  
    conditional {
      if ($drivetrain == "") {
        array.push $errors {
          value = {
            field  : "drivetrain"
            message: "Укажите привод."
          }
        }
      }
    }
  
    conditional {
      if ($doors == "") {
        array.push $errors {
          value = {
            field  : "doors"
            message: "Укажите количество дверей."
          }
        }
      }
    }
  
    conditional {
      if ($seats == "") {
        array.push $errors {
          value = {
            field  : "seats"
            message: "Укажите количество мест."
          }
        }
      }
    }
  
    conditional {
      if ($color == "") {
        array.push $errors {
          value = {
            field  : "color"
            message: "Укажите цвет."
          }
        }
      }
    }
  
    conditional {
      if ($owners_count == "") {
        array.push $errors {
          value = {
            field  : "owners_count"
            message: "Укажите количество владельцев."
          }
        }
      }
    }
  
    conditional {
      if ($first_registration == "") {
        array.push $errors {
          value = {
            field  : "first_registration"
            message: "Укажите дату первой регистрации."
          }
        }
      }
    }
  
    conditional {
      if ($vehicle_condition == "") {
        array.push $errors {
          value = {
            field  : "vehicle_condition"
            message: "Укажите состояние автомобиля."
          }
        }
      }
    }
  
    conditional {
      if ($seller_type == "") {
        array.push $errors {
          value = {
            field  : "seller_type"
            message: "Укажите тип продавца."
          }
        }
      }
    }
  
    conditional {
      if ($has_valid_tuv == null) {
        array.push $errors {
          value = {
            field  : "has_valid_tuv"
            message: "Укажите, действует ли TÜV / HU."
          }
        }
      }
    }
  
    conditional {
      if (($has_valid_tuv) && (("/^\\d{4}-(0[1-9]|1[0-2])$/"|regex_matches:$tuv_valid_until) != true)) {
        array.push $errors {
          value = {
            field  : "tuv_valid_until"
            message: "Укажите срок TÜV / HU в формате YYYY-MM."
          }
        }
      }
    }
  
    conditional {
      if (($has_valid_tuv) && ($tuv_valid_until < (now|format_timestamp:"Y-m"))) {
        array.push $errors {
          value = {
            field  : "tuv_valid_until"
            message: "Срок TÜV / HU должен быть в будущем."
          }
        }
      }
    }
  
    conditional {
      if (($has_valid_tuv == false) && ($tuv_valid_until != "")) {
        array.push $errors {
          value = {
            field  : "tuv_valid_until"
            message: "Очистите срок TÜV / HU, если действующего осмотра нет."
          }
        }
      }
    }
  
    conditional {
      if ($seller_name == "") {
        array.push $errors {
          value = {
            field  : "seller_name"
            message: "Укажите имя продавца."
          }
        }
      }
    }
  
    conditional {
      if (($seller_phone == "") && ($seller_email == "")) {
        array.push $errors {
          value = {
            field  : "seller_contact"
            message: "Укажите телефон или email продавца."
          }
        }
      }
    }
  
    conditional {
      if (($vin != "") && (("/^[A-HJ-NPR-Z0-9]{17}$/"|regex_matches:$vin) != true)) {
        array.push $errors {
          value = {
            field  : "vin"
            message: "Укажите корректный VIN или оставьте поле пустым."
          }
        }
      }
    }
  
    conditional {
      if (($fuel_type|to_lower|contains:"электро") && (($fuel_type|to_lower|contains:"дизель") || ($fuel_type|to_lower|contains:"бензин") || ($fuel_type|to_lower|contains:"газ") || ($fuel_type|to_lower|contains:"lpg"))) {
        array.push $errors {
          value = {
            field  : "fuel_type"
            message: "Проверьте несовместимые значения типа топлива."
          }
        }
      }
    }
  
    conditional {
      if (($images_for_validation|count) < 1) {
        array.push $errors {
          value = {
            field  : "images"
            message: "Добавьте минимум одну фотографию."
          }
        }
      }
    }
  
    conditional {
      if (($images_for_validation|count) > 8) {
        array.push $errors {
          value = {
            field  : "images"
            message: "Можно добавить не более 8 фотографий."
          }
        }
      }
    }
  
    foreach ($images_for_validation) {
      each as $validation_image {
        var $validation_url {
          value = $validation_image.image_url
            |first_notnull:""
            |to_text
            |trim
        }
      
        conditional {
          if ((($validation_url|starts_with:"https://") != true) || ($validation_url|contains:"localhost") || ($validation_url|starts_with:"blob:") || ($validation_url|starts_with:"data:") || ($validation_url|starts_with:"file:")) {
            array.push $errors {
              value = {
                field  : "images"
                message: "Все фотографии должны иметь публичный HTTPS URL."
              }
            }
          }
        }
      }
    }
  
    precondition ($already_submitted || (($errors|count) == 0)) {
      error_type = "inputerror"
      error = "Listing is not ready for moderation"
      payload = {
        success: false
        code   : "LISTING_NOT_READY"
        message: "Listing is not ready for moderation"
        errors : $errors
      }
    }
  
    var $draft_slug {
      value = $brand
        |concat:" "
        |concat:$model_name
        |concat:" "
        |concat:$year
        |to_lower
        |replace:" ":"-"
        |concat:"-"
        |concat:($input.draft_id|first_notnull:0)
    }
  
    conditional {
      if ($using_draft && ($already_submitted != true)) {
        conditional {
          if ($car == null) {
            db.add car_listings {
              data = {
                created_at             : "now"
                updated_at             : "now"
                slug                   : $draft_slug
                title                  : $title
                brand                  : $brand
                model                  : $model_name
                year                   : $year
                mileage                : $mileage
                fuel_type              : $fuel_type
                transmission           : $transmission
                drivetrain             : $drivetrain
                price                  : $price
                currency               : $currency
                city                   : $city
                country                : $country
                description            : $description
                status                 : "pending_review"
                moderation_status      : "pending_review"
                user_id                : $auth.id
                seller_name            : $seller_name
                seller_phone           : $seller_phone
                seller_email           : $seller_email
                vehicle_type           : $vehicle_type
                body_type              : $body_type
                engine_volume          : $engine_volume
                color                  : $color
                vin                    : $vin
                doors                  : $doors
                seats                  : $seats
                owners_count           : $owners_count
                owner_count            : $owners_count
                first_registration     : $first_registration
                first_registration_date: $first_registration
                vehicle_condition      : $vehicle_condition
                condition              : $vehicle_condition
                seller_type            : $seller_type
                has_valid_tuv          : $has_valid_tuv
                tuv_valid_until        : $tuv_valid_until
                is_ai_generated        : $is_ai_generated
                listing_quality_score  : $listing_quality_score
                photo_quality_score    : $photo_quality_score
                trust_score            : $trust_score
                draft_id               : $draft.id
                main_image_url         : $draft_images[0].image_url|first_notnull:""
              }
            } as $created_car
          
            var.update $car {
              value = $created_car
            }
          }
        
          else {
            db.edit car_listings {
              field_name = "id"
              field_value = $car.id
              data = {
                updated_at             : "now"
                title                  : $title
                brand                  : $brand
                model                  : $model_name
                year                   : $year
                mileage                : $mileage
                fuel_type              : $fuel_type
                transmission           : $transmission
                drivetrain             : $drivetrain
                price                  : $price
                currency               : $currency
                city                   : $city
                country                : $country
                description            : $description
                status                 : "pending_review"
                moderation_status      : "pending_review"
                seller_name            : $seller_name
                seller_phone           : $seller_phone
                seller_email           : $seller_email
                vehicle_type           : $vehicle_type
                body_type              : $body_type
                engine_volume          : $engine_volume
                color                  : $color
                vin                    : $vin
                doors                  : $doors
                seats                  : $seats
                owners_count           : $owners_count
                owner_count            : $owners_count
                first_registration     : $first_registration
                first_registration_date: $first_registration
                vehicle_condition      : $vehicle_condition
                condition              : $vehicle_condition
                seller_type            : $seller_type
                has_valid_tuv          : $has_valid_tuv
                tuv_valid_until        : $tuv_valid_until
                is_ai_generated        : $is_ai_generated
                listing_quality_score  : $listing_quality_score
                photo_quality_score    : $photo_quality_score
                trust_score            : $trust_score
                draft_id               : $draft.id
                main_image_url         : $draft_images[0].image_url|first_notnull:$car.main_image_url
              }
            } as $updated_car
          
            var.update $car {
              value = $updated_car
            }
          }
        }
      
        foreach ($draft_images) {
          each as $draft_image {
            db.query car_listing_images {
              where = (($db.car_listing_images.car_listing_id == $car.id) && ($db.car_listing_images.image_url == $draft_image.image_url) && ($db.car_listing_images.is_deleted != true))
              return = {type: "single"}
            } as $existing_listing_image
          
            conditional {
              if ($existing_listing_image == null) {
                db.add car_listing_images {
                  data = {
                    created_at       : "now"
                    updated_at       : "now"
                    car_listing_id   : $car.id
                    image_url        : $draft_image.image_url
                    sort_order       : $draft_image.sort_order
                    is_main          : $draft_image.is_primary
                    is_primary       : $draft_image.is_primary
                    mime_type        : $draft_image.mime_type
                    original_filename: $draft_image.original_filename
                    size_bytes       : $draft_image.size_bytes
                    image_metadata   : $draft_image.image_metadata
                    is_deleted       : false
                  }
                } as $listing_image
              }
            }
          }
        }
      
        db.edit car_drafts {
          field_name = "id"
          field_value = $draft.id
          data = {
            status    : "pending_review"
            car_id    : $car.id
            updated_at: "now"
          }
        } as $submitted_draft
      
        var.update $draft {
          value = $submitted_draft
        }
      }
    }
  
    conditional {
      if (($using_draft != true) && ($already_submitted != true)) {
        db.edit car_listings {
          field_name = "id"
          field_value = $car.id
          data = {
            status           : "pending_review"
            moderation_status: "pending_review"
            updated_at       : "now"
          }
        } as $submitted_listing
      
        var.update $car {
          value = $submitted_listing
        }
      }
    }
  
    conditional {
      if ($using_draft && $already_submitted && (($draft.car_id == null) || ($draft.car_id == 0))) {
        db.edit car_drafts {
          field_name = "id"
          field_value = $draft.id
          data = {
            status    : "pending_review"
            car_id    : $car.id
            updated_at: "now"
          }
        } as $linked_draft
      
        var.update $draft {
          value = $linked_draft
        }
      }
    }
  
    db.query car_listing_images {
      where = (($db.car_listing_images.car_listing_id == $car.id) && ($db.car_listing_images.is_deleted != true))
      sort = {car_listing_images.sort_order: "asc"}
      return = {type: "list"}
    } as $final_images
  
    var $response_draft_id {
      value = $car.draft_id|first_notnull:null
    }
  
    var $response_draft_status {
      value = null
    }
  
    conditional {
      if ($draft != null) {
        var.update $response_draft_id {
          value = $draft.id
        }
      
        var.update $response_draft_status {
          value = $draft.status
        }
      }
    }
  }

  response = {
    success          : true
    already_submitted: $already_submitted
    draft_id         : $response_draft_id
    listing_id       : $car.id
    status           : $car.status
    moderation_status: $car.moderation_status
    draft            : {id: $response_draft_id, status: $response_draft_status}
    car              : $car
    images           : $final_images
  }

  tags = [
    "sitecraft-auto-market"
    "seller"
    "ai"
    "drafts"
    "moderation"
    "protected"
  ]
}
