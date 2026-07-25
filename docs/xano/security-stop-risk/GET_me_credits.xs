query "me/credits" verb=GET {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "unauthorized"
      error = "Unauthorized"
    }

    db.get automarket_users {
      field_name = "id"
      field_value = $auth.id
      output = ["id"]
    } as $current_user

    precondition ($current_user != null) {
      error_type = "unauthorized"
      error = "Unauthorized"
    }

    db.get user_credits {
      field_name = "user_id"
      field_value = $current_user.id
    } as $credits

    var $balance {
      value = 0
    }

    var $daily_generations {
      value = 0
    }

    var $monthly_generations {
      value = 0
    }

    var $updated_at {
      value = null
    }

    conditional {
      if ($credits != null) {
        var.update $balance {
          value = $credits.ai_credits|first_notnull:0|to_int
        }

        var.update $daily_generations {
          value = $credits.ai_daily_generations|first_notnull:0|to_int
        }

        var.update $monthly_generations {
          value = $credits.ai_monthly_generations|first_notnull:0|to_int
        }

        var.update $updated_at {
          value = $credits.updated_at
        }
      }
    }
  }

  response = {
    balance               : $balance
    wallet_type           : "legacy_ai_credits"
    updated_at            : $updated_at
    ai_credits            : $balance
    credits               : $balance
    ai_daily_generations  : $daily_generations
    ai_monthly_generations: $monthly_generations
  }

  tags = ["sitecraft-auto-market", "ai", "credits", "read-only", "security-stop-risk"]
}
