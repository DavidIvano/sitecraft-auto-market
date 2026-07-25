query "auth/register" verb=POST {
  api_group = "sitecraft-auto-market"

  input {
    text name filters=trim|max:120
    email email filters=trim|lower
    password password {
      sensitive = true
    }
  }

  stack {
    var $clean_email {
      value = $input.email|trim|to_lower
    }

    precondition (($input.name|strlen) > 0) {
      error_type = "inputerror"
      error = "Name is required."
    }

    precondition (($input.password|strlen) >= 8) {
      error_type = "inputerror"
      error = "Password must be at least 8 characters."
    }

    db.get automarket_users {
      field_name = "email"
      field_value = $clean_email
    } as $existing_user

    conditional {
      if ($existing_user != null) {
        conditional {
          if ($existing_user.password == null) {
            util.set_header {
              value = "HTTP/1.1 409 Conflict"
              duplicates = "replace"
            }

            return {
              value = {
                code   : "ACCOUNT_LINK_REQUIRED"
                message: "This email is already connected to Google. Sign in with Google to link another login method."
              }
            }
          }

          else {
            util.set_header {
              value = "HTTP/1.1 409 Conflict"
              duplicates = "replace"
            }

            return {
              value = {
                code   : "EMAIL_ALREADY_REGISTERED"
                message: "Account with this email already exists."
              }
            }
          }
        }
      }
    }

    db.add automarket_users {
      enforce_hidden_fields = false
      data = {
        created_at   : "now"
        name         : $input.name
        email        : $clean_email
        google_id    : "email:"|concat:$clean_email
        password     : $input.password
        role         : "user"
        last_login_at: "now"
      }
    } as $user

    db.get user_credits {
      field_name = "user_id"
      field_value = $user.id
    } as $credits

    conditional {
      if ($credits == null) {
        db.add user_credits {
          data = {
            user_id               : $user.id
            ai_credits            : 10
            ai_daily_generations  : 0
            ai_monthly_generations: 0
            ai_daily_reset_date   : now
            ai_monthly_reset_date : now
          }
        } as $credits

        db.add credit_transactions {
          data = {
            user_id      : $user.id
            type         : "free_grant"
            amount       : 10
            balance_after: 10
            notes        : "Welcome demo AI credits"
          }
        } as $credit_transaction
      }
    }

    security.create_auth_token {
      table = "automarket_users"
      extras = {}
      expiration = 5184000
      id = $user.id
    } as $authToken
  }

  response = {
    authToken: $authToken
    user     : ```
      {
        id     : $user.id
        email  : $user.email
        name   : $user.name
        picture: $user.picture
        role   : $user.role
      }
      ```
  }

  tags = ["sitecraft-auto-market", "auth", "password", "security-stop-risk"]
}
