# R2 upload security

## Request flow

`POST /api/upload-listing-images` accepts a browser-compressed image batch only after two independent checks: the request origin must be explicitly allowed and `GET {XANO_API_URL}/auth/me` must return HTTP 200 with a positive integer user ID. The Xano contract currently returns `{ "user": { "id": 123 } }`; the Function also accepts the documented compatible `{ "id": 123 }` shape. The validated Xano ID, never FormData metadata, is used in object keys.

The endpoint is fail-closed. Missing Xano configuration returns `503 AUTH_CONFIGURATION_MISSING`; timeout, invalid JSON, and Xano 5xx return `503 AUTH_SERVICE_UNAVAILABLE`; missing or invalid tokens return `401 UNAUTHORIZED`. No R2 operation occurs after any of these failures. Xano validation times out after nine seconds.

## Authentication compatibility fix (2026-07-14)

Production returned `401` for valid sessions because the deployed Function read only the root `id`, while `/auth/me` returned the ID inside `user`. The browser auth client already normalized `payload.user || payload`, so `/auth/me` showed `200` while the upload Function rejected the same bearer token. The Function now normalizes only positive integer values from `response.id` or `response.user.id` and rejects every other response as `401 UNAUTHORIZED`.

All browser upload callers use the shared `getAuthToken()` source immediately before the upload request. The request sends only `Authorization: Bearer <token>` with `FormData`; it never sets multipart `Content-Type` manually, so the browser supplies the boundary. Safe server diagnostics record only header presence, token length, Xano status, response shape, detected numeric user ID, and internal error code. Tokens, profile data, image metadata, and raw Xano bodies are never logged.

## Required Cloudflare configuration

- `R2_BUCKET`: Pages runtime binding mapped to the `car-images` bucket. This is the only bucket binding consumed by application code.
- `R2_PUBLIC_BASE_URL`: stable HTTPS base, currently `https://sitecraft-auto-market.pages.dev/api/r2-images`.
- `XANO_API_URL`: server-side API group URL used for `/auth/me`. `PUBLIC_XANO_API_URL` remains a temporary compatibility fallback only.
- `ALLOWED_UPLOAD_ORIGINS`: comma-separated exact origins. No wildcard and no substring matching.
- `ENVIRONMENT`: use `production` in production. `development`, `dev`, or `local` enables the documented localhost defaults.

`R2_BUCKET_NAME` is deployment tooling metadata only. Runtime code does not read it.

## CORS policy

Allowed origins receive their exact origin, `Vary: Origin`, `POST, OPTIONS`, `Authorization, Content-Type`, and a one-day preflight cache. A forbidden origin receives `403 ORIGIN_NOT_ALLOWED` and no `Access-Control-Allow-Origin`. `OPTIONS` performs neither Xano validation nor R2 operations.

Preview deployments use explicit entries in `ALLOWED_UPLOAD_ORIGINS`. Arbitrary `*.pages.dev` origins are not allowed. Add the exact preview deployment URL before testing and remove it when the preview is retired.

## Files and object storage

- 1–8 files per request.
- JPEG, PNG, WebP, and AVIF only; SVG, GIF, and non-image MIME types are rejected.
- 1 MB maximum per file and 8 MB maximum per batch.
- Empty files are rejected; server checks do not rely on extensions.
- Object key: `listing-images/{validated_user_id}/{yyyy}/{mm}/{uuid}.{safe-extension}`.
- Original filenames are sanitized and stored only as informational metadata.
- Tokens, email, phone, profile data, VIN, IP, and raw AI payloads are never stored.

If a multi-image upload fails, only keys created by that request are deleted on a best-effort basis. Internal errors stay in server logs and are not returned to clients.

## Verified preview and production flow (2026-07-14)

The exact Pages preview origin was added to the Function allowlist and the production origin remained the only production allowlist entry. The preview Function accepted 1, 4, and 8 disposable image batches after Xano returned its nested `user.id`; every upload returned public HTTPS URLs and the AI photo-analysis endpoint created the expected draft. The production smoke test repeated the full chain with one disposable image: login, Function authentication, R2 write, public URL HEAD request, AI analysis, and draft creation all returned HTTP 200.

The browser automation session successfully logged in and opened `/dashboard/new/`; its native file-picker capability is unavailable in the current driver. The same multipart contract produced by the browser code was therefore exercised directly against the deployed Functions, while unit tests verify the client uses the shared token source and lets the browser set the multipart boundary. No real customer image was used. Test R2 objects, drafts, and the disposable account are removed after verification.

## Preview verification

1. Create a disposable Xano user and obtain its token.
2. Configure a Cloudflare preview with a separate `listing-images/test/` prefix or disposable bucket and add its exact origin.
3. Verify preflight for production, preview, localhost ports 4321/4322, and a denied origin.
4. Upload 1, 4, and 8 compressed images; inspect public URLs and metadata.
5. Verify invalid, expired, and absent tokens never create objects.
6. Delete every test object and disposable account/token.

Production R2 verification requires explicit approval and disposable test objects only. That approval was granted for the 2026-07-14 smoke test above.

## Production checklist

- Confirm all five configuration items above in the production Pages environment.
- Confirm only the production origin is present unless a temporary preview is under test.
- Confirm `/auth/me` returns a positive user ID for a real session and rejects arbitrary tokens.
- Confirm the R2 proxy serves each returned HTTPS URL.
- Run focused upload tests, `npm run check`, and `npm run build` before deployment.
