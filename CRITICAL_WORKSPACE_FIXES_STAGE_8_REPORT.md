# Critical Workspace Fixes Stage 8

## Executive summary

Stage 8 fixes the four reported workspace regressions without creating new Cloudflare, Xano, R2, Git, contact, uploader, or icon systems. The frontend was built and deployed directly to the existing Cloudflare Pages project `sitecraft-auto-market`. Xano endpoint `3997838` was updated in the existing live workspace after a one-file dry-run.

## Root causes

### Module MIME

Production served an HTML SPA fallback with status `200` for an absent `/_astro/*.js` URL. The response was cacheable as immutable, so a stale hashed module URL could remain poisoned with `text/html` and stop the workspace client bootstrap. The build had no HTML-to-asset integrity check and missing static assets did not fail closed.

### Contact phone

The frontend normalizer accepted international numbers with separators, but rejected German local `0...` input and `+49 (0)...`. Xano removed separators before E.164 validation but did not translate the local trunk prefix. The form also exposed only a general status instead of a field-level phone error.

### Photo picker

The dropzone was a `<label>` inside a form mode whose CSS disabled pointer events on labels. A later generic input rule could also impose control dimensions on the visually hidden file input, exposing a sliver of the native control.

### Mobile menu

The menu icon used three CSS bars transformed into a cross. Repeated legacy rules changed geometry at mobile breakpoints, and the public theme control could inherit full width.

## Changes

- `package.json`: build now verifies generated assets; added `verify:assets` and module smoke scripts.
- `scripts/prepare-cloudflare-pages.mjs`: validates `_astro`, JS, CSS and worker entry; static requests use `env.ASSETS`; HTML fallback for `/_astro/*` becomes `404`.
- `scripts/verify-built-assets.mjs`: validates every built HTML `/_astro` script, stylesheet and module reference.
- `scripts/test-module-assets.mjs`: verifies module status, MIME and non-HTML body across eight routes.
- `public/_routes.json`: routes `/_astro/*` through the Advanced Mode worker.
- `public/_headers`: workspace HTML is `private, no-store`; hashed assets are immutable.
- `src/lib/contactProfile.ts`: one normalizer now supports formatted international, `0049`, German local `0...`, and `+49 (0)...` input.
- `src/components/dashboard/ContactProfileForm.astro`: normalized payload, field-level error, `aria-invalid`, preserved values and existing auth lifecycle.
- `src/pages/dashboard/new.astro`: real photo-select buttons, bounded MIME/size/count/empty/duplicate checks, existing previews/reorder/upload retained.
- `src/components/Header.astro` and `src/lib/appIcons.ts`: Lucide `Menu`/`X`, Escape/outside/link close, and focus restoration.
- `src/styles/global.css` and `src/styles/design-system.css`: removed CSS-bar icon implementation and label click blocker; file input is fully visually hidden; mobile controls are fixed at 44 px.
- `src/layouts/BaseLayout.astro`: emitted a shell-ready event to force a fresh shared module hash after an older immutable URL had cached HTML.
- `docs/xano/seller-contact-system-stage-6/PATCH_me_contact_profile.after.xs`: synchronized local Xano contract.
- `tests/critical-workspace-stage8.test.ts` and `tests/seller-contact-stage6.test.ts`: regression coverage.

`src/pages/dashboard/listings.astro`, `astro.config.mjs`, `wrangler.toml`, upload/R2 code, contact schemas, credits and other Xano endpoints were inspected but not changed.

## Xano

- Workspace: `115940`, live branch `v1`.
- Endpoint: `3997838`, `PATCH /me/contact-profile`.
- Dry-run: exactly one API endpoint update, no records or tables.
- Live patch: successful one-document transactional push.
- Confirmed live export contains local `0...` to `+49...` and `+490...` trunk removal before `INVALID_PHONE` validation.
- No authenticated contact mutation was performed during automated QA because the managed browser session was not authenticated.

## Backups

- Frontend: `.backups/critical-workspace-fixes-stage-8/`
- Xano before: `/Users/david/.codex/audits/sitecraft-auto-market/xano-live-stage-8-before-2026-07-29`
- Xano patch: `/Users/david/.codex/audits/sitecraft-auto-market/xano-live-stage-8-after-2026-07-29`
- Xano confirmed live: `/Users/david/.codex/audits/sitecraft-auto-market/xano-live-stage-8-confirmed-2026-07-29`

## Verification

- `npm install`: success, zero vulnerabilities.
- `npm run check`: success, 0 errors; one pre-existing async conversion hint.
- `npm test`: 328 passed, 0 failed.
- `npm run build`: success.
- `npm run verify:assets`: 32 references across 33 HTML files verified.
- Local Cloudflare module smoke: 12 modules across 8 routes passed.
- Local missing `/_astro` asset: `404`, non-HTML.
- Local `/dashboard/`: `Cache-Control: private, no-store, max-age=0`.

## Browser QA

The managed browser redirected protected routes to login. The existing Chrome session did not become controllable before timeout. Therefore authenticated contact save, native file chooser, listing data, console, and screenshots at 1440/768/430/390/375/360 were not falsely reported as completed. The exact limitation is recorded in `artifacts/stage-8/README.md`.

## Deployment

- Project: `sitecraft-auto-market`.
- First Stage 8 deployment: `99c9b742-02f0-4ce5-83a0-d61298ea294d`.
- Final hash-refresh deployment: `faeb0af0-f317-45be-bb8f-36f669a1dc54`.
- Deployment URL: `https://faeb0af0.sitecraft-auto-market.pages.dev`.
- Production URL: `https://automarket.sitecraft.agency`.

The deployment URL passed the eight-route module smoke. Production custom-domain results are recorded after propagation in the final section below.

## Production smoke

- The custom domain now references the fresh shared module `/_astro/BaseLayout.astro_astro_type_script_index_0_lang.Csk6TwG0.js`.
- Module smoke passed: 12 JavaScript modules across 8 production routes returned successful JavaScript responses.
- A unique absent `/_astro/*.js` request returned `404`, `text/plain`, `Cache-Control: no-store`, body `Asset not found`.
- `/dashboard/` returned `200`, `Cache-Control: private, no-store, max-age=0`, and `CF-Cache-Status: DYNAMIC`.
- The prior poisoned `BaseLayout...C1Ej4A8_.js` URL is no longer referenced by current production HTML.
- Authenticated interactive QA remains unverified for the reason documented under Browser QA; the successful production check is HTTP/module-level and is not presented as authenticated E2E.

## Rollback

Frontend files can be restored individually from `.backups/critical-workspace-fixes-stage-8/` and redeployed to the same Pages project. Xano endpoint `3997838` can be restored from the before-export using a one-file dry-run and transactional push. No public rollback endpoint was created.
