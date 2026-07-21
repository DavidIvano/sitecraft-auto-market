// SiteCraft Auto Market monetization MVP.
// Если твоя auth-таблица называется не automarket_users, замени auth = "automarket_users".
// Если таблица объявлений называется cars, замени car_listings на cars.

table paid_products {
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    text slug filters=trim|lower
    text name filters=trim
    text description?
    int price_cents
    text currency?="EUR" filters=trim
    text type?="one_time" filters=trim
    int duration_days?
    int credits_amount?
    int active_listing_limit?
    int monthly_ai_credits?
    int dealer_priority?=0
    bool is_active?=true
    int sort_order?=0
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree|unique", field: [{name: "slug", op: "asc"}]}
    {type: "btree", field: [{name: "sort_order", op: "asc"}]}
  ]
}

table user_purchases {
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    int user_id
    int product_id
    int car_id?
    text status?="pending" filters=trim
    int amount_cents
    text currency?="EUR" filters=trim
    text payment_provider? filters=trim
    text payment_session_id?
    text payment_order_id?
    text payment_capture_id?
    timestamp starts_at?
    timestamp expires_at?
    json raw_payment_response?
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "user_id", op: "asc"}]}
    {type: "btree", field: [{name: "status", op: "asc"}]}
  ]
}

table user_credits {
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    int user_id
    int ai_credits?=0
    int ai_daily_generations?=0
    int ai_monthly_generations?=0
    date ai_daily_reset_date?
    date ai_monthly_reset_date?
    timestamp last_monthly_reset_at?
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree|unique", field: [{name: "user_id", op: "asc"}]}
  ]
}

table ai_generation_logs {
  schema {
    int id
    timestamp created_at?=now
    int user_id
    int draft_id?
    text status?="started" filters=trim
    int photo_count?=0
    int total_photo_bytes?=0
    int credits_before?=0
    int credits_after?=0
    text error_code?
    json raw_response?
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "user_id", op: "asc"}]}
    {type: "btree", field: [{name: "created_at", op: "desc"}]}
    {type: "btree", field: [{name: "status", op: "asc"}]}
  ]
}

table credit_transactions {
  schema {
    int id
    timestamp created_at?=now
    int user_id
    text type filters=trim
    int amount
    int balance_after
    int related_purchase_id?
    int related_car_id?
    text notes?
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "user_id", op: "asc"}]}
  ]
}

table dealer_profiles {
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    int user_id
    text company_name? filters=trim
    text logo_url?
    text website_url?
    text phone?
    text whatsapp?
    text city?
    text address?
    text description?
    text dealer_plan?="none" filters=trim
    timestamp plan_expires_at?
    bool is_verified?=false
    text status?="draft" filters=trim
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree|unique", field: [{name: "user_id", op: "asc"}]}
    {type: "btree", field: [{name: "status", op: "asc"}]}
  ]
}

// Добавь эти поля в таблицу car_listings:
// timestamp boosted_until?
// timestamp featured_until?
// timestamp homepage_until?
// text seller_type?="private"
// int dealer_profile_id?
// text moderation_status?="pending_review"
// bool is_ai_generated?=false
// text dealer_plan?="none"
// bool dealer_verified?=false

// Глобальные лимиты MVP:
// AI_MAX_PHOTOS = 4
// AI_MAX_PHOTO_BYTES = 8388608
// AI_DAILY_LIMIT_PRIVATE = 5
// AI_MONTHLY_LIMIT_PRIVATE = 10
// PRIVATE_ACTIVE_LISTING_LIMIT = 3
// Dealer Basic: 10 active listings, 5 monthly AI credits, priority 10
// Dealer Pro: 50 active listings, 25 monthly AI credits, priority 20
// Dealer Business: 200 active listings, 100 monthly AI credits, priority 30
//
// Важно: платные AI-кредиты в user_credits.ai_credits — главный баланс.
// ai_daily_generations и ai_monthly_generations — защитные лимиты от злоупотреблений.
// При оплате dealer-пакета добавляй monthly_ai_credits в user_credits.ai_credits
// и создавай credit_transactions type="monthly_subscription_grant".

query "paid-products" verb=GET {
  api_group = "sitecraft-auto-market"

  stack {
    db.query paid_products {
      where = ($db.paid_products.is_active == true)
      sort = [{paid_products.sort_order: "asc"}]
      return = {type: "list"}
    } as $products
  }

  response = $products
}

query "purchases/create" verb=POST {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    text product_slug
    int? car_id
  }

  stack {
    db.get paid_products {
      field_name = "slug"
      field_value = $input.product_slug
    } as $product

    precondition ($product != null && $product.is_active == true) {
      error_type = "notfound"
      error = "Тариф не найден"
    }

    conditional {
      if ($input.car_id != null) {
        db.get car_listings {
          field_name = "id"
          field_value = $input.car_id
        } as $car

        precondition ($car != null && $car.user_id == $auth.id) {
          error_type = "accessdenied"
          error = "Это объявление принадлежит другому пользователю"
        }
      }
    }

    db.add user_purchases {
      data = {
        user_id: $auth.id
        product_id: $product.id
        car_id: $input.car_id
        status: "pending"
        amount_cents: $product.price_cents
        currency: $product.currency
        payment_provider: "test"
      }
    } as $purchase
  }

  response = {
    purchase_id: $purchase.id
    status: $purchase.status
    checkout_url: null
    payment_success_path: "/payment/success"
  }
}

query "purchases/apply" verb=POST {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    int purchase_id
    int car_id
  }

  stack {
    db.get user_purchases {
      field_name = "id"
      field_value = $input.purchase_id
    } as $purchase

    precondition ($purchase != null && $purchase.user_id == $auth.id) {
      error_type = "accessdenied"
      error = "Покупка не найдена"
    }

    db.get paid_products {
      field_name = "id"
      field_value = $purchase.product_id
    } as $product

    db.get car_listings {
      field_name = "id"
      field_value = $input.car_id
    } as $car

    precondition ($car != null && $car.user_id == $auth.id) {
      error_type = "accessdenied"
      error = "Это объявление принадлежит другому пользователю"
    }

    var $expires_at {
      value = now|add_days:($product.duration_days|default:0)
    }

    conditional {
      if ($product.slug == "boost_7_days") {
        db.edit car_listings {
          field_name = "id"
          field_value = $car.id
          data = {boosted_until: $expires_at}
        } as $updated_car
      }
      else_if ($product.slug == "featured_14_days") {
        db.edit car_listings {
          field_name = "id"
          field_value = $car.id
          data = {featured_until: $expires_at}
        } as $updated_car
      }
      else_if ($product.slug == "homepage_premium_7_days") {
        db.edit car_listings {
          field_name = "id"
          field_value = $car.id
          data = {homepage_until: $expires_at}
        } as $updated_car
      }
    }

    db.edit user_purchases {
      field_name = "id"
      field_value = $purchase.id
      data = {
        status: "active"
        starts_at: now
        expires_at: $expires_at
      }
    } as $purchase_updated
  }

  response = {
    success: true
    purchase: $purchase_updated
    car: $updated_car
  }
}

query "me/credits" verb=GET {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  stack {
    db.get user_credits {
      field_name = "user_id"
      field_value = $auth.id
    } as $credits

    conditional {
      if ($credits == null) {
        db.add user_credits {
          data = {user_id: $auth.id ai_credits: 0}
        } as $credits
      }
    }

    db.query credit_transactions {
      where = ($db.credit_transactions.user_id == $auth.id)
      sort = [{credit_transactions.created_at: "desc"}]
      limit = 20
      return = {type: "list"}
    } as $transactions
  }

  response = {
    ai_credits: $credits.ai_credits
    transactions: $transactions
  }
}

query "me/purchases" verb=GET {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  stack {
    db.query user_purchases {
      where = ($db.user_purchases.user_id == $auth.id)
      sort = [{user_purchases.created_at: "desc"}]
      return = {type: "list"}
    } as $purchases
  }

  response = $purchases
}

query "dealer-profile" verb=GET {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  stack {
    db.get dealer_profiles {
      field_name = "user_id"
      field_value = $auth.id
    } as $profile
  }

  response = $profile
}

query "dealer-profile/update" verb=POST {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    text? company_name
    text? logo_url
    text? website_url
    text? phone
    text? whatsapp
    text? city
    text? address
    text? description
  }

  stack {
    db.get dealer_profiles {
      field_name = "user_id"
      field_value = $auth.id
    } as $profile

    conditional {
      if ($profile == null) {
        db.add dealer_profiles {
          data = {
            user_id: $auth.id
            company_name: $input.company_name
            logo_url: $input.logo_url
            website_url: $input.website_url
            phone: $input.phone
            whatsapp: $input.whatsapp
            city: $input.city
            address: $input.address
            description: $input.description
            dealer_plan: "none"
            status: "draft"
          }
        } as $profile
      }
      else {
        db.edit dealer_profiles {
          field_name = "id"
          field_value = $profile.id
          data = {
            company_name: $input.company_name
            logo_url: $input.logo_url
            website_url: $input.website_url
            phone: $input.phone
            whatsapp: $input.whatsapp
            city: $input.city
            address: $input.address
            description: $input.description
            updated_at: now
          }
        } as $profile
      }
    }
  }

  response = $profile
}

query "dealers" verb=GET {
  api_group = "sitecraft-auto-market"

  stack {
    db.query dealer_profiles {
      where = (($db.dealer_profiles.status == "active") && ($db.dealer_profiles.plan_expires_at > now))
      sort = [{dealer_profiles.dealer_plan: "desc"}]
      return = {type: "list"}
    } as $dealers
  }

  response = $dealers
}

// ---------------------------------------------------------------------------
// Seed paid_products
// ---------------------------------------------------------------------------
// Вставь эти продукты в paid_products один раз через Add Record или импорт:
//
// slug: boost_7_days
// name: Поднять объявление
// type: one_time
// price_cents: 499
// currency: EUR
// duration_days: 7
// credits_amount: 0
// active_listing_limit: null
// monthly_ai_credits: null
// dealer_priority: 0
// sort_order: 10
//
// slug: featured_14_days
// name: Выделенное объявление
// type: one_time
// price_cents: 999
// currency: EUR
// duration_days: 14
// credits_amount: 0
// active_listing_limit: null
// monthly_ai_credits: null
// dealer_priority: 0
// sort_order: 20
//
// slug: homepage_premium_7_days
// name: Премиум на главной
// type: one_time
// price_cents: 1499
// currency: EUR
// duration_days: 7
// credits_amount: 0
// active_listing_limit: null
// monthly_ai_credits: null
// dealer_priority: 0
// sort_order: 30
//
// slug: ai_credits_10
// name: 10 AI-генераций
// type: credits
// price_cents: 499
// currency: EUR
// credits_amount: 10
// active_listing_limit: null
// monthly_ai_credits: null
// dealer_priority: 0
// sort_order: 40
//
// slug: dealer_basic_monthly
// name: Dealer Basic
// type: subscription
// price_cents: 1900
// currency: EUR
// credits_amount: 5
// active_listing_limit: 10
// monthly_ai_credits: 5
// dealer_priority: 10
// sort_order: 50
//
// slug: dealer_pro_monthly
// name: Dealer Pro
// type: subscription
// price_cents: 4900
// currency: EUR
// credits_amount: 25
// active_listing_limit: 50
// monthly_ai_credits: 25
// dealer_priority: 20
// sort_order: 60
//
// slug: dealer_business_monthly
// name: Dealer Business
// type: subscription
// price_cents: 9900
// currency: EUR
// credits_amount: 100
// active_listing_limit: 200
// monthly_ai_credits: 100
// dealer_priority: 30
// sort_order: 70

// ---------------------------------------------------------------------------
// Required backend checks for POST /cars
// ---------------------------------------------------------------------------
// Добавь этот блок логики в существующий POST /cars перед db.add car_listings:
//
// 1. Получить dealer_profiles по user_id = $auth.id.
// 2. Посчитать активные объявления пользователя:
//    statuses: draft, pending_review, approved, published
// 3. Определить лимит:
//    default private limit = 3
//    dealer_basic_monthly = 10
//    dealer_pro_monthly = 50
//    dealer_business_monthly = 200
// 4. Если active_count >= active_limit:
//    error_type = "accessdenied"
//    error = "Достигнут лимит активных объявлений для вашего тарифа"
//    code = "LISTING_LIMIT_REACHED"
// 5. При создании объявления:
//    status = "pending_review"
//    moderation_status = "pending_review"
//    seller_type = $profile != null && $profile.status == "active" ? "dealer" : "private"
//    dealer_profile_id = $profile.id если профиль активен
//    dealer_plan = $profile.dealer_plan если профиль активен и plan_expires_at > now
//    dealer_verified = $profile.is_verified
//
// Это защищает монетизацию на backend. UI-проверки на сайте не считаются защитой.

// ---------------------------------------------------------------------------
// Required backend checks for POST /ai/generate-listing
// ---------------------------------------------------------------------------
// Endpoint:
// query "ai/generate-listing" verb=POST
// api_group = "sitecraft-auto-market"
// auth = "automarket_users"
// input: multipart/form-data photos, 1-4 изображения
//
// Логика:
// 1. Проверить auth.
// 2. Проверить количество фото:
//    меньше 1 => error "Добавьте хотя бы одно фото"
//    больше 4 => error "Можно загрузить максимум 4 фото для AI-черновика"
// 3. Проверить размер каждого фото:
//    больше 8388608 bytes => error "Фото слишком большое. Максимум 8 MB"
// 4. Получить или создать user_credits.
// 5. Сбросить дневной счётчик, если ai_daily_reset_date != today.
// 6. Сбросить месячный счётчик, если ai_monthly_reset_date не текущий месяц.
// 7. Проверить:
//    user_credits.ai_credits > 0
//    ai_daily_generations < AI_DAILY_LIMIT_PRIVATE или dealer limit
//    ai_monthly_generations < AI_MONTHLY_LIMIT_PRIVATE или dealer monthly_ai_credits
// 8. Создать ai_generation_logs status="started".
// 9. Отправить фото в OpenAI Responses API.
//    OPENAI_API_KEY хранится только в Xano Environment Variables.
//    Frontend не должен получать этот ключ.
// 10. Запросить strict JSON schema car_listing_draft:
//    title, brand, model, year, mileage, fuel_type, transmission, body_type,
//    color, price, description, city, confidence, ai_notes
// 11. Сохранить car_drafts status="draft", is_ai_generated=true.
// 12. Списать 1 AI-кредит:
//    user_credits.ai_credits = user_credits.ai_credits - 1
//    ai_daily_generations = ai_daily_generations + 1
//    ai_monthly_generations = ai_monthly_generations + 1
// 13. Создать credit_transactions:
//    type="usage", amount=-1, related_car_id=null, notes="AI listing draft"
// 14. Обновить ai_generation_logs:
//    status="success", draft_id, credits_before, credits_after, raw_response
// 15. Вернуть:
//    { draft_id, draft, ai_credits }
//
// Ошибки должны возвращаться по-русски:
// NO_AI_CREDITS: "Недостаточно AI-кредитов"
// AI_DAILY_LIMIT_REACHED: "Дневной лимит AI-генераций исчерпан"
// AI_MONTHLY_LIMIT_REACHED: "Месячный лимит AI-генераций исчерпан"
// AI_PHOTO_LIMIT_REACHED: "Можно загрузить максимум 4 фото"
// AI_PHOTO_TOO_LARGE: "Фото слишком большое. Максимум 8 MB"

// Дополнительные endpoints, которые должен иметь этот MVP:
//
// POST /purchases/confirm
// - auth required
// - input: purchase_id, payment_order_id, payment_provider
// - в test mode можно перевести user_purchases.status из pending в paid
// - в real mode проверить оплату через PayPal/Stripe secret из Environment Variables
// - если product.type == "credits": увеличить user_credits.ai_credits на product.credits_amount
// - если product.type == "subscription": обновить dealer_profiles и выдать monthly_ai_credits
// - создать credit_transactions для покупки или monthly_subscription_grant
//
// POST /ai/generate-listing
// - смотри полный контракт выше
//
// GET /admin/paid-products
// PATCH /admin/paid-products/{id}
// - только admin role/email
// - смотреть, включать/выключать, менять цену, duration_days, credits_amount,
//   active_listing_limit, monthly_ai_credits, dealer_priority, sort_order
//
// GET /admin/purchases
// PATCH /admin/purchases/{id}/status
// - только admin role/email
// - фильтр status
// - ручная отметка refunded/cancelled/failed
//
// GET /admin/dealers
// PATCH /admin/dealers/{id}
// - только admin role/email
// - status active/suspended
// - is_verified true/false
// - dealer_plan, plan_expires_at
//
// GET /dashboard/listings/{id}
// - auth required
// - нужен странице /dashboard/cars/promote?id=ID
// - возвращает только объявление текущего пользователя.
