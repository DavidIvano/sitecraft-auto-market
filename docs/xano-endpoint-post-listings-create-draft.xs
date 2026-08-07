// Endpoint: POST /listings/create-draft
// Saves or updates an owned editable draft. It never creates a car_listing.
query "listings/create-draft" verb=POST {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    int draft_id?
    int listing_id?
    text title? filters=trim
    text brand? filters=trim
    text make? filters=trim
    text model? filters=trim
    text year? filters=trim
    text mileage? filters=trim
    text fuel_type? filters=trim
    text transmission? filters=trim
    text drivetrain? filters=trim
    text price? filters=trim
    text currency? filters=trim|upper
    text city? filters=trim
    text country? filters=trim
    text description? filters=trim
    text vehicle_type? filters=trim
    text body_type? filters=trim
    text engine_volume? filters=trim
    text color? filters=trim
    text vin? filters=trim|upper
    text doors? filters=trim
    text seats? filters=trim
    text owners_count? filters=trim
    text owner_count? filters=trim
    text first_registration? filters=trim
    text first_registration_date? filters=trim
    text vehicle_condition? filters=trim
    text condition? filters=trim
    text seller_type? filters=trim
    bool has_valid_tuv?
    text tuv_valid_until? filters=trim
    text seller_name? filters=trim
    text seller_phone? filters=trim
    text seller_email? filters=trim|lower
    text main_image_url? filters=trim
    text cover_image_url? filters=trim
    text r2_images? filters=trim
    text image_urls? filters=trim
    text image_keys? filters=trim
    text ai_analysis? filters=trim
    text accepted_ai_suggestions? filters=trim
    text listing_quality_score? filters=trim
    text ai_listing_score? filters=trim
    text photo_quality_score? filters=trim
    text trust_score? filters=trim
    bool is_ai_generated?
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "unauthorized"
      error = "Unauthorized"
    }
  
    db.get automarket_users {
      field_name = "id"
      field_value = $auth.id
    } as $auth_user
  
    precondition ($auth_user != null) {
      error_type = "unauthorized"
      error = "Unauthorized"
    }
  
    var $current_year {
      value = now|format_timestamp:"Y"|to_int
    }
  
    var $brand {
      value = $input.brand
        |first_notnull:""
        |to_text
        |trim
    }
  
    conditional {
      if (($brand == "") && (($input.make|first_notnull:"") != "")) {
        var.update $brand {
          value = $input.make|to_text|trim
        }
      }
    }
  
    var $year {
      value = $input.year
        |first_notnull:""
        |to_text
        |trim
    }
  
    var $mileage {
      value = $input.mileage
        |first_notnull:""
        |to_text
        |trim
    }
  
    var $price {
      value = $input.price
        |first_notnull:""
        |to_text
        |trim
    }
  
    var $vin {
      value = $input.vin
        |first_notnull:""
        |to_text
        |trim
        |to_upper
    }
  
    var $city {
      value = $input.city
        |first_notnull:""
        |to_text
        |trim
    }
  
    precondition (($year == "") || (($year|to_int) >= 1950 && ($year|to_int) <= $current_year)) {
      error_type = "inputerror"
      error = "Year must be between 1950 and the current year"
    }
  
    precondition (($mileage == "") || (($mileage|to_int) >= 0)) {
      error_type = "inputerror"
      error = "Mileage must be zero or greater"
    }
  
    precondition (($price == "") || (($price|to_decimal) >= 0)) {
      error_type = "inputerror"
      error = "Price must be zero or greater"
    }
  
    precondition (($vin == "") || ("/^[A-HJ-NPR-Z0-9]{17}$/"|regex_matches:$vin)) {
      error_type = "inputerror"
      error = "VIN must contain 17 valid characters"
    }
  
    precondition (($city == "") || (("/^\\d+$/"|regex_matches:$city) != true)) {
      error_type = "inputerror"
      error = "City cannot contain digits only"
    }
  
    var $r2_images {
      value = []
    }
  
    var $image_urls {
      value = []
    }
  
    var $image_keys {
      value = []
    }
  
    var $ai_analysis {
      value = {}
    }
  
    var $accepted_suggestions {
      value = []
    }
  
    var $r2_json_valid {
      value = true
    }
  
    var $image_urls_json_valid {
      value = true
    }
  
    var $image_keys_json_valid {
      value = true
    }
  
    var $analysis_json_valid {
      value = true
    }
  
    var $suggestions_json_valid {
      value = true
    }
  
    conditional {
      if (($input.r2_images != null) && ($input.r2_images != "")) {
        try_catch {
          try {
            var.update $r2_images {
              value = $input.r2_images|json_decode
            }
          }
        
          catch {
            var.update $r2_json_valid {
              value = false
            }
          }
        }
      }
    }
  
    conditional {
      if (($input.image_urls != null) && ($input.image_urls != "")) {
        try_catch {
          try {
            var.update $image_urls {
              value = $input.image_urls|json_decode
            }
          }
        
          catch {
            var.update $image_urls_json_valid {
              value = false
            }
          }
        }
      }
    }
  
    conditional {
      if (($input.image_keys != null) && ($input.image_keys != "")) {
        try_catch {
          try {
            var.update $image_keys {
              value = $input.image_keys|json_decode
            }
          }
        
          catch {
            var.update $image_keys_json_valid {
              value = false
            }
          }
        }
      }
    }
  
    conditional {
      if (($input.ai_analysis != null) && ($input.ai_analysis != "")) {
        try_catch {
          try {
            var.update $ai_analysis {
              value = $input.ai_analysis|json_decode
            }
          }
        
          catch {
            var.update $analysis_json_valid {
              value = false
            }
          }
        }
      }
    }
  
    conditional {
      if (($input.accepted_ai_suggestions != null) && ($input.accepted_ai_suggestions != "")) {
        try_catch {
          try {
            var.update $accepted_suggestions {
              value = $input.accepted_ai_suggestions|json_decode
            }
          }
        
          catch {
            var.update $suggestions_json_valid {
              value = false
            }
          }
        }
      }
    }
  
    precondition ($r2_json_valid) {
      error_type = "inputerror"
      error = "Invalid r2_images JSON"
    }
  
    precondition ($image_urls_json_valid) {
      error_type = "inputerror"
      error = "Invalid image_urls JSON"
    }
  
    precondition ($image_keys_json_valid) {
      error_type = "inputerror"
      error = "Invalid image_keys JSON"
    }
  
    precondition ($analysis_json_valid) {
      error_type = "inputerror"
      error = "Invalid ai_analysis JSON"
    }
  
    precondition ($suggestions_json_valid) {
      error_type = "inputerror"
      error = "Invalid accepted_ai_suggestions JSON"
    }
  
    precondition ($r2_images|is_array) {
      error_type = "inputerror"
      error = "r2_images must be a JSON array"
    }
  
    precondition ($image_urls|is_array) {
      error_type = "inputerror"
      error = "image_urls must be a JSON array"
    }
  
    precondition ($image_keys|is_array) {
      error_type = "inputerror"
      error = "image_keys must be a JSON array"
    }
  
    precondition ($ai_analysis|is_object) {
      error_type = "inputerror"
      error = "ai_analysis must be a JSON object"
    }
  
    precondition ($accepted_suggestions|is_array) {
      error_type = "inputerror"
      error = "accepted_ai_suggestions must be a JSON array"
    }
  
    precondition (($r2_images|count) <= 8) {
      error_type = "inputerror"
      error = "A maximum of 8 images is allowed"
    }
  
    precondition (($image_urls|count) <= 8) {
      error_type = "inputerror"
      error = "A maximum of 8 images is allowed"
    }
  
    var $invalid_image_count {
      value = 0
    }
  
    var $explicit_primary_count {
      value = 0
    }
  
    foreach ($r2_images) {
      each as $r2_image {
        var $image_url {
          value = $r2_image
            |get:"url":""
            |first_notnull:""
            |to_text
            |trim
        }
      
        conditional {
          if ((($image_url|starts_with:"https://") != true) || ($image_url|contains:"localhost") || ($image_url|starts_with:"blob:") || ($image_url|starts_with:"data:") || ($image_url|starts_with:"file:")) {
            var.update $invalid_image_count {
              value = $invalid_image_count + 1
            }
          }
        }
      
        conditional {
          if (($r2_image|get:"is_primary":false) || ($r2_image|get:"is_main":false)) {
            var.update $explicit_primary_count {
              value = $explicit_primary_count + 1
            }
          }
        }
      }
    }
  
    foreach ($image_urls) {
      each as $fallback_url {
        var $fallback_url_text {
          value = $fallback_url
            |first_notnull:""
            |to_text
            |trim
        }
      
        conditional {
          if ((($fallback_url_text|starts_with:"https://") != true) || ($fallback_url_text|contains:"localhost") || ($fallback_url_text|starts_with:"blob:") || ($fallback_url_text|starts_with:"data:") || ($fallback_url_text|starts_with:"file:")) {
            var.update $invalid_image_count {
              value = $invalid_image_count + 1
            }
          }
        }
      }
    }
  
    precondition ($invalid_image_count == 0) {
      error_type = "inputerror"
      error = "Images must use public HTTPS URLs"
    }
  
    var $owned_listing {
      value = null
    }
  
    conditional {
      if ($input.listing_id != null) {
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
      
        var.update $owned_listing {
          value = $listing_record
        }
      }
    }
  
    var $existing_draft {
      value = null
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
      
        precondition (($draft_record.status == "draft") || ($draft_record.status == "ai_draft")) {
          error_type = "inputerror"
          error = "This draft is no longer editable"
        }
      
        precondition (($input.listing_id == null) || ($draft_record.car_id == null) || ($draft_record.car_id == 0) || ($draft_record.car_id == $input.listing_id)) {
          error_type = "accessdenied"
          error = "You do not have access to this draft"
        }
      
        var.update $existing_draft {
          value = $draft_record
        }
      }
    }
  
    // A missing score stays null. Do not coerce null or an empty legacy alias to 0.
    var $listing_score_raw {
      value = $input.listing_quality_score
        |first_notnull:$input.ai_listing_score
        |first_notnull:($ai_analysis|get:"listing_quality_score":null)
        |first_notnull:($ai_analysis|get:"listing_score":null)
        |first_notnull:""
        |to_text
        |trim
    }
  
    var $photo_score_raw {
      value = $input.photo_quality_score
        |first_notnull:($ai_analysis|get:"photo_quality_score":null)
        |first_notnull:($ai_analysis|get:"photo_score":null)
        |first_notnull:""
        |to_text
        |trim
    }
  
    var $trust_score_raw {
      value = $input.trust_score
        |first_notnull:($ai_analysis|get:"trust_score":null)
        |first_notnull:""
        |to_text
        |trim
    }
  
    var $listing_score { value = null }
    var $photo_score { value = null }
    var $trust_score_value { value = null }

    conditional { if ("/^([0-9]|[1-9][0-9]|100)$/"|regex_matches:$listing_score_raw) { var.update $listing_score { value = $listing_score_raw|to_int } } }
    conditional { if ("/^([0-9]|[1-9][0-9]|100)$/"|regex_matches:$photo_score_raw) { var.update $photo_score { value = $photo_score_raw|to_int } } }
    conditional { if ("/^([0-9]|[1-9][0-9]|100)$/"|regex_matches:$trust_score_raw) { var.update $trust_score_value { value = $trust_score_raw|to_int } } }
  
    var $tuv_valid_until {
      value = null
    }
  
    conditional {
      if ($input.has_valid_tuv) {
        precondition ("/^\\d{4}-(0[1-9]|1[0-2])$/"|regex_matches:($input.tuv_valid_until|first_notnull:"")) {
          error_type = "inputerror"
          error = "TÜV/HU date must use YYYY-MM"
        }
      
        var.update $tuv_valid_until {
          value = $input.tuv_valid_until
            |first_notnull:""
            |to_text
            |trim
        }
      }
    }
  
    var $ai_payload {
      value = ```
        {
          version: "seller-draft-v1"
          fields: {
            country: $input.country|first_notnull:"Германия"
            currency: $input.currency|first_notnull:"EUR"
            vin: $vin
            doors: $input.doors|first_notnull:""
            seats: $input.seats|first_notnull:""
            drivetrain: $input.drivetrain|first_notnull:""
            owners_count: $input.owners_count|first_notnull:$input.owner_count|first_notnull:""
            first_registration: $input.first_registration|first_notnull:$input.first_registration_date|first_notnull:""
            vehicle_condition: $input.vehicle_condition|first_notnull:$input.condition|first_notnull:""
            seller_type: $input.seller_type|first_notnull:""
            has_valid_tuv: $input.has_valid_tuv
            tuv_valid_until: $tuv_valid_until
          }
          seller: {
            name: $input.seller_name|first_notnull:""
            phone: $input.seller_phone|first_notnull:""
            email: $input.seller_email|first_notnull:""
          }
          images: {
            main_image_url: $input.main_image_url|first_notnull:""
            cover_image_url: $input.cover_image_url|first_notnull:""
            urls: $image_urls
            keys: $image_keys
          }
          ai_analysis: $ai_analysis
          accepted_ai_suggestions: $accepted_suggestions
          scores: {
            listing_quality_score: $listing_score
            photo_quality_score: $photo_score
            trust_score: $trust_score_value
          }
        }
        ```
    }
  
    var $draft {
      value = null
    }
  
    var $created {
      value = false
    }
  
    var $updated {
      value = false
    }
  
    conditional {
      if ($existing_draft == null) {
        db.add car_drafts {
          data = {
            created_at        : "now"
            updated_at        : "now"
            user_id           : $auth.id
            car_id            : $input.listing_id|first_notnull:0
            status            : "draft"
            is_ai_generated   : $input.is_ai_generated|first_notnull:true
            source            : "seller_ai_confirmed"
            title             : $input.title|first_notnull:""
            brand             : $brand
            model             : $input.model|first_notnull:""
            year              : $year|first_notnull:"0"|to_int
            mileage           : $mileage|first_notnull:"0"|to_int
            fuel_type         : $input.fuel_type|first_notnull:""
            transmission      : $input.transmission|first_notnull:""
            drivetrain        : $input.drivetrain|first_notnull:""
            body_type         : $input.body_type|first_notnull:""
            vehicle_type      : $input.vehicle_type|first_notnull:""
            color             : $input.color|first_notnull:""
            engine_volume     : $input.engine_volume|first_notnull:""
            doors             : $input.doors|first_notnull:""
            seats             : $input.seats|first_notnull:""
            owners_count      : $input.owners_count|first_notnull:$input.owner_count|first_notnull:""
            first_registration: $input.first_registration|first_notnull:$input.first_registration_date|first_notnull:""
            vehicle_condition : $input.vehicle_condition|first_notnull:$input.condition|first_notnull:""
            currency          : $input.currency|first_notnull:"EUR"
            country           : $input.country|first_notnull:"Германия"
            seller_type       : $input.seller_type|first_notnull:""
            seller_name       : $input.seller_name|first_notnull:""
            seller_phone      : $input.seller_phone|first_notnull:""
            seller_email      : $input.seller_email|first_notnull:""
            vin               : $vin
            has_valid_tuv     : $input.has_valid_tuv
            tuv_valid_until   : $tuv_valid_until
            price             : $price|first_notnull:"0"|to_int
            city              : $city
            description       : $input.description|first_notnull:""
            listing_quality_score: $listing_score
            photo_quality_score  : $photo_score
            trust_score          : $trust_score_value
            ai_payload        : $ai_payload
          }
        } as $new_draft
      
        var.update $draft {
          value = $new_draft
        }
      
        var.update $created {
          value = true
        }
      }
    
      else {
        db.edit car_drafts {
          field_name = "id"
          field_value = $existing_draft.id
          data = {
            updated_at        : "now"
            car_id            : $input.listing_id|first_notnull:$existing_draft.car_id
            status            : "draft"
            is_ai_generated   : $input.is_ai_generated|first_notnull:$existing_draft.is_ai_generated
            source            : "seller_ai_confirmed"
            title             : $input.title|first_notnull:""
            brand             : $brand
            model             : $input.model|first_notnull:""
            year              : $year|first_notnull:"0"|to_int
            mileage           : $mileage|first_notnull:"0"|to_int
            fuel_type         : $input.fuel_type|first_notnull:""
            transmission      : $input.transmission|first_notnull:""
            drivetrain        : $input.drivetrain|first_notnull:""
            body_type         : $input.body_type|first_notnull:""
            vehicle_type      : $input.vehicle_type|first_notnull:""
            color             : $input.color|first_notnull:""
            engine_volume     : $input.engine_volume|first_notnull:""
            doors             : $input.doors|first_notnull:""
            seats             : $input.seats|first_notnull:""
            owners_count      : $input.owners_count|first_notnull:$input.owner_count|first_notnull:""
            first_registration: $input.first_registration|first_notnull:$input.first_registration_date|first_notnull:""
            vehicle_condition : $input.vehicle_condition|first_notnull:$input.condition|first_notnull:""
            currency          : $input.currency|first_notnull:"EUR"
            country           : $input.country|first_notnull:"Германия"
            seller_type       : $input.seller_type|first_notnull:""
            seller_name       : $input.seller_name|first_notnull:""
            seller_phone      : $input.seller_phone|first_notnull:""
            seller_email      : $input.seller_email|first_notnull:""
            vin               : $vin
            has_valid_tuv     : $input.has_valid_tuv
            tuv_valid_until   : $tuv_valid_until
            price             : $price|first_notnull:"0"|to_int
            city              : $city
            description       : $input.description|first_notnull:""
            listing_quality_score: $listing_score
            photo_quality_score  : $photo_score
            trust_score          : $trust_score_value
            ai_payload        : $ai_payload
          }
        } as $saved_draft
      
        var.update $draft {
          value = $saved_draft
        }
      
        var.update $updated {
          value = true
        }
      }
    }
  
    var $sort_order {
      value = 0
    }
  
    foreach ($r2_images) {
      each as $r2_image {
        var $url {
          value = $r2_image
            |get:"url":""
            |to_text
            |trim
        }
      
        db.query car_draft_images {
          where = (($db.car_draft_images.draft_id == $draft.id) && ($db.car_draft_images.image_url == $url))
          return = {type: "single"}
        } as $existing_image
      
        var $is_primary {
          value = (($r2_image|get:"is_primary":false) == true) || (($r2_image|get:"is_main":false) == true) || (($explicit_primary_count == 0) && ($sort_order == 0))
        }
      
        conditional {
          if ($existing_image == null) {
            db.add car_draft_images {
              data = {
                created_at       : "now"
                user_id          : $auth.id
                draft_id         : $draft.id
                sort_order       : $sort_order
                is_primary       : $is_primary
                image_url        : $url
                mime_type        : $r2_image|get:"contentType":"image/webp"
                original_filename: $r2_image|get:"key":""
                size_bytes       : $r2_image|get:"size":0|to_int
                image_metadata   : $r2_image
              }
            } as $new_image
          }
        
          else {
            db.edit car_draft_images {
              field_name = "id"
              field_value = $existing_image.id
              data = {
                user_id          : $auth.id
                sort_order       : $sort_order
                is_primary       : $is_primary
                mime_type        : $r2_image|get:"contentType":$existing_image.mime_type
                original_filename: $r2_image|get:"key":$existing_image.original_filename
                size_bytes       : $r2_image|get:"size":$existing_image.size_bytes|to_int
                image_metadata   : $r2_image
              }
            } as $updated_image
          }
        }
      
        var.update $sort_order {
          value = $sort_order + 1
        }
      }
    }
  
    conditional {
      if (($r2_images|count) == 0) {
        foreach ($image_urls) {
          each as $fallback_url {
            var $fallback_url_text {
              value = $fallback_url|to_text|trim
            }
          
            db.query car_draft_images {
              where = (($db.car_draft_images.draft_id == $draft.id) && ($db.car_draft_images.image_url == $fallback_url_text))
              return = {type: "single"}
            } as $existing_fallback_image
          
            conditional {
              if ($existing_fallback_image == null) {
                db.add car_draft_images {
                  data = {
                    created_at       : "now"
                    user_id          : $auth.id
                    draft_id         : $draft.id
                    sort_order       : $sort_order
                    is_primary       : $sort_order == 0
                    image_url        : $fallback_url_text
                    mime_type        : "image/webp"
                    original_filename: ""
                    size_bytes       : 0
                    image_metadata   : {url: $fallback_url_text, provider: "cloudflare_r2"}
                  }
                } as $fallback_image
              }
            }
          
            var.update $sort_order {
              value = $sort_order + 1
            }
          }
        }
      }
    }
  
    db.query car_draft_images {
      where = (($db.car_draft_images.draft_id == $draft.id) && ($db.car_draft_images.user_id == $auth.id))
      sort = {car_draft_images.sort_order: "asc"}
      return = {type: "list"}
    } as $images
  
    var $response_listing_id {
      value = null
    }
  
    conditional {
      if (($draft.car_id != null) && ($draft.car_id > 0)) {
        var.update $response_listing_id {
          value = $draft.car_id
        }
      }
    }
  }

  response = {
    success   : true
    created   : $created
    updated   : $updated
    draft_id  : $draft.id
    listing_id: $response_listing_id
    status    : $draft.status
    draft     : {id: $draft.id, status: $draft.status}
    images    : $images
  }

  tags = ["sitecraft-auto-market", "seller", "ai", "drafts", "protected"]
}
