# Public endpoint contract

## `GET /public/locale/cars?lang={locale}`

One bounded listing query plus joined/batched translation and image data. The
response contains only public listing fields and the locale resolution object.
It must not expose seller contacts, user IDs, provider prompts, tokens, credits,
raw job payloads, or moderation internals.

## `GET /public/locale/cars/{slug}?lang={locale}`

The primary detail response must be sufficient to render HTML, metadata,
schema, gallery, and language availability with one frontend request. It
returns:

- localized public fields;
- canonical taxonomy codes;
- safe image URLs;
- `available_locales` for ready reciprocal detail pages;
- `translation.requested_locale`, `resolved_locale`, `source_locale`, status,
  version, source hash and update timestamp;
- public seller summary only when explicitly allowed by the existing privacy
  contract.

Related listings are optional enhancement data and must not block primary HTML.

## Status behavior

- invalid locale or slug: `404`;
- missing/stale/fallback translation on a localized SEO route: `404`;
- backend unavailable: `503`, `Retry-After`, `no-store`;
- ready localized content: `200`.

Every locale changes the cache key. The edge cache key is the locale-prefixed
browser URL; Xano and any internal cache include locale, listing identity,
translation version and source hash.
