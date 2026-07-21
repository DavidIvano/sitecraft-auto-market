query "oauth/google/continue" verb=GET {
  api_group = "sitecraft-auto-market"

  input {
    text code filters=trim
    text redirect_uri filters=trim
  }

  stack {
    api.request {
      url = "https://oauth2.googleapis.com/token"
      method = "POST"
      params = {}
        |set:"code":$input.code
        |set:"client_id":$env.GOOGLE_CLIENT_ID
        |set:"client_secret":$env.GOOGLE_CLIENT_SECRET
        |set:"redirect_uri":$input.redirect_uri
        |set:"grant_type":"authorization_code"
      headers = []
        |push:"Content-Type: application/x-www-form-urlencoded"
    } as $token_response

    precondition ($token_response.response.status == 200) {
      error_type = "accessdenied"
      error = "Google token exchange failed"
    }

    var $google_access_token {
      value = $token_response.response.result.access_token
    }

    api.request {
      url = "https://www.googleapis.com/oauth2/v2/userinfo"
      method = "GET"
      params = {}
        |set:"access_token":$google_access_token
    } as $profile_response

    precondition ($profile_response.response.status == 200) {
      error_type = "accessdenied"
      error = "Google profile request failed"
    }

    var $profile {
      value = $profile_response.response.result
    }

    db.query automarket_users {
      where = $db.automarket_users.email == $profile.email
      return = {type: "single"}
    } as $existing_user

    conditional {
      if ($existing_user != null) {
        db.edit automarket_users {
          field_name = "id"
          field_value = $existing_user.id
          enforce_hidden_fields = false
          data = {
            name         : $profile.name
            email        : $profile.email
            picture      : $profile.picture
            google_id    : $profile.id
            google_oauth : $profile
            last_login_at: "now"
          }
        } as $user
      }

      else {
        db.add automarket_users {
          enforce_hidden_fields = false
          data = {
            created_at   : "now"
            name         : $profile.name
            email        : $profile.email
            picture      : $profile.picture
            google_id    : $profile.id
            google_oauth : $profile
            role         : "user"
            last_login_at: "now"
          }
        } as $user
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

  tags = ["sitecraft-auto-market", "auth", "google"]
}
