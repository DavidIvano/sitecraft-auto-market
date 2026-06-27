# Google Auth Setup

The frontend is ready for Google login through Xano.

## Frontend Routes

```txt
/login
/auth/google/callback
/dashboard
/dashboard/new
```

`/dashboard`, `/dashboard/listings`, and `/dashboard/new` require a local Xano auth token. If no token exists, the user is redirected to `/login`.

## Environment Variables

Required:

```txt
PUBLIC_XANO_API_URL=https://x8ki-letl-twmt.n7.xano.io/api:jAAj839u
PUBLIC_XANO_AUTH_API_URL=https://x8ki-letl-twmt.n7.xano.io/api:12n3UIc0
```

Optional, only if your Xano Google OAuth endpoints use different paths:

```txt
PUBLIC_XANO_GOOGLE_AUTH_START_PATH=/oauth/google/init
PUBLIC_XANO_GOOGLE_AUTH_CONTINUE_PATH=/oauth/google/continue
```

## Reusing the SiteCraft Agency Google OAuth Client

You can reuse the same Google OAuth Client that you created for SiteCraft Agency.

In Google Cloud Console, open the existing OAuth 2.0 Client and add these Authorized redirect URIs:

```txt
https://sitecraft-auto-market.pages.dev/auth/google/callback
http://localhost:4321/auth/google/callback
```

If you later add a custom domain, add it too:

```txt
https://YOUR_CUSTOM_DOMAIN/auth/google/callback
```

Do not put the Google Client Secret in Astro, GitHub public variables, or Cloudflare public variables. The secret belongs only in Xano.

## Xano Setup

Install or reuse the Xano Google OAuth extension / OAuth flow.

Expected frontend flow:

1. The site calls:

```txt
GET {PUBLIC_XANO_API_URL}/oauth/google/init?redirect_uri=https://sitecraft-auto-market.pages.dev/auth/google/callback
```

2. Xano returns one of these JSON shapes:

```json
{ "authUrl": "https://accounts.google.com/..." }
```

or:

```json
{ "auth_url": "https://accounts.google.com/..." }
```

or:

```json
{ "url": "https://accounts.google.com/..." }
```

3. Google redirects back to:

```txt
https://sitecraft-auto-market.pages.dev/auth/google/callback?code=...
```

4. The site calls:

```txt
GET {PUBLIC_XANO_AUTH_API_URL}/oauth/google/continue?code=...&redirect_uri=...
```

5. Xano should return an auth token:

```json
{
  "token": "XANO_AUTH_TOKEN",
  "email": "user@example.com",
  "name": "User Name"
}
```

The frontend accepts `authToken`, `auth_token`, `token`, or `jwt`.

## Protecting Xano Endpoints

Make these endpoints require authentication in Xano:

```txt
POST /cars
PATCH /cars/{id}/submit
GET /dashboard/listings
```

The frontend sends:

```txt
Authorization: Bearer XANO_AUTH_TOKEN
```

For user-owned listings, add a `user_id` field to `car_listings` and set it from the authenticated user in `POST /cars`.
