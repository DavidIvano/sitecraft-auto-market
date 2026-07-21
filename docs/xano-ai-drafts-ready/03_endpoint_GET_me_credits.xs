// Endpoint: GET /me/credits
// Нужен для отображения баланса AI-кредитов на /dashboard/new и /dashboard/billing.

query "me/credits" verb=GET {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "Войдите в кабинет, чтобы посмотреть AI-кредиты."
    }

    db.get user_credits {
      field_name = "user_id"
      field_value = $auth.id
    } as $credits

    conditional {
      if ($credits == null) {
        db.add user_credits {
          data = {
            user_id: $auth.id
            ai_credits: 0
            ai_daily_generations: 0
            ai_monthly_generations: 0
            ai_daily_reset_date: now
            ai_monthly_reset_date: now
          }
        } as $credits
      }
    }
  }

  response = {
    ai_credits: $credits.ai_credits
    credits: $credits.ai_credits
    ai_daily_generations: $credits.ai_daily_generations
    ai_monthly_generations: $credits.ai_monthly_generations
  }

  tags = ["sitecraft-auto-market", "ai", "credits"]
}

