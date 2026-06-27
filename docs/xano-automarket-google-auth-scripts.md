# Xano Automarket Google Auth Scripts

Use these scripts in the Automarket API group:

```txt
/api:jAAj839u
```

This is the API group currently used by SiteCraft Auto Market:

```txt
GET    /api:jAAj839u/cars
GET    /api:jAAj839u/cars/{slug}
POST   /api:jAAj839u/cars
PATCH  /api:jAAj839u/cars/{id}/submit
GET    /api:jAAj839u/admin/moderation
PATCH  /api:jAAj839u/admin/cars/{id}/approve
PATCH  /api:jAAj839u/admin/cars/{id}/reject
```

## Required Xano Environment Variables

Use the uppercase variables:

```txt
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

Do not use old lowercase variables for this project.

## Required Google Redirect URIs

Add these in Google Cloud Console for the same OAuth client used in `GOOGLE_CLIENT_ID`:

```txt
https://sitecraft-auto-market.pages.dev/auth/google/callback
http://localhost:4321/auth/google/callback
```

## Table: users

Create or update the `users` table:

```xanoscript
table users {
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    text email filters=trim|lower
    text name? filters=trim
    text picture?
    text google_id?
    text role?=user
    timestamp last_login_at?
  }

  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree|unique", field: [{name: "email", op: "asc"}]}
    {type: "btree|unique", field: [{name: "google_id", op: "asc"}]}
  ]

  tags = ["sitecraft-auto-market", "auth"]
}
```

## Endpoint: GET /oauth/google/init

Create this endpoint in `/api:jAAj839u`.

```xanoscript
query oauth/google/init verb=GET {
  input {
    text redirect_uri filters=trim
  }

  stack {
    var $scope {
      value = "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile"
    }

    var $auth_url {
      value = "https://accounts.google.com/o/oauth2/auth"
        |concat:"?response_type=code":""
        |concat:"&access_type=online":""
        |concat:"&client_id=":""
        |concat:($env.GOOGLE_CLIENT_ID):""
        |concat:"&redirect_uri=":""
        |concat:($input.redirect_uri|url_encode):""
        |concat:"&scope=":""
        |concat:($scope|url_encode):""
        |concat:"&approval_prompt=auto":""
    }
  }

  response = {
    authUrl: $auth_url
  }

  tags = ["sitecraft-auto-market", "auth"]
}
```

## Endpoint: GET /oauth/google/continue

Create this endpoint in `/api:jAAj839u`.

```xanoscript
query oauth/google/continue verb=GET {
  input {
    text code filters=trim
    text redirect_uri filters=trim
  }

  stack {
    api.request {
      url = "https://oauth2.googleapis.com/token"
      method = "POST"
      headers = {
        "Content-Type": "application/x-www-form-urlencoded"
      }
      params = {}
      body = "code="|concat:($input.code|url_encode):""
        |concat:"&client_id=":""
        |concat:($env.GOOGLE_CLIENT_ID|url_encode):""
        |concat:"&client_secret=":""
        |concat:($env.GOOGLE_CLIENT_SECRET|url_encode):""
        |concat:"&redirect_uri=":""
        |concat:($input.redirect_uri|url_encode):""
        |concat:"&grant_type=authorization_code":""
    } as $token_response

    var $access_token {
      value = $token_response.result.access_token
    }

    api.request {
      url = "https://www.googleapis.com/oauth2/v3/userinfo"
      method = "GET"
      headers = {
        "Authorization": "Bearer "|concat:$access_token:""
      }
    } as $google_user_response

    var $google_user {
      value = $google_user_response.result
    }

    db.query users {
      where = $db.users.google_id == $google_user.sub || $db.users.email == $google_user.email
      return = {type: "single"}
    } as $user

    conditional {
      if ($user == null) {
        db.add users {
          data = {
            created_at    : "now"
            updated_at    : "now"
            email         : $google_user.email
            name          : $google_user.name
            picture       : $google_user.picture
            google_id     : $google_user.sub
            role          : "user"
            last_login_at : "now"
          }
        } as $user
      }
      else {
        db.edit users {
          field_name = "id"
          field_value = $user.id
          data = {
            updated_at    : "now"
            name          : $google_user.name
            picture       : $google_user.picture
            google_id     : $google_user.sub
            last_login_at : "now"
          }
        } as $user
      }
    }

    security.create_auth_token {
      table = "users"
      id = $user.id
    } as $auth_token
  }

  response = {
    authToken: $auth_token,
    token: $auth_token,
    user: {
      id: $user.id,
      email: $user.email,
      name: $user.name,
      picture: $user.picture,
      role: $user.role
    }
  }

  tags = ["sitecraft-auto-market", "auth"]
}
```

## Endpoint: GET /auth/me

Create this endpoint in `/api:jAAj839u`.

```xanoscript
query auth/me verb=GET {
  auth = "users"

  input {
  }

  stack {
  }

  response = {
    user: {
      id: $auth.id,
      email: $auth.email,
      name: $auth.name,
      picture: $auth.picture,
      role: $auth.role
    }
  }

  tags = ["sitecraft-auto-market", "auth"]
}
```

## Update: car_listings table

Add this field to `car_listings`:

```txt
user_id -> users table reference or integer
```

## Update: POST /cars

Make `POST /cars` authenticated and store the user id:

```txt
Auth: required, users
user_id = authenticated user id
status = draft
```

The frontend sends:

```txt
Authorization: Bearer XANO_AUTH_TOKEN
```

## Update Frontend Variables

After these endpoints exist in `/api:jAAj839u`, set:

```txt
PUBLIC_XANO_API_URL=https://x8ki-letl-twmt.n7.xano.io/api:jAAj839u
PUBLIC_XANO_AUTH_API_URL=https://x8ki-letl-twmt.n7.xano.io/api:jAAj839u
```

