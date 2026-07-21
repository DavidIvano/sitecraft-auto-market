# Kleinanzeigen Agent integration

Primary source for Deal Finder is the official Kleinanzeigen Agent REST API, not Gmail.

## Confirmed public contract

- Base URL: `https://api.kleinanzeigen-agent.de/api/v2/kleinanzeigen`
- API key header: `klaz_key: <server-only key>`
- Search: `GET /search`
- Detail: `GET /ads/{ad_id}`
- Status: `GET /ads/{ad_id}/status`
- Categories: `GET /categories`
- Locations: `GET /locations?q={name-or-postcode}&limit={n}`
- Search uses `q`, `page`, `size`, `category_id`, `location_id`, `distance`, `min_price`, `max_price`, `picture_required`, and `poster_type`. The client intentionally does **not** send disabled `sort_type`.

Search, category, location, detail, and status requests each cost one API credit according to the provider documentation. Search responses use `{ success, data: { meta, ads }, request_id }`; `meta.page` is zero-based, `size` defaults to 31 and is capped at 100, while ad images are HTTPS URL strings in `images`. Errors use an HTTP status plus stable `error_code`, `message`, and optional `errors`.

The first manual run on 2026-07-16 used one category lookup, one location lookup, and one listing search: three credits total. The listing search requested `size=5`, loaded no detail/status resources, and wrote nothing to Xano. The provider rate limit for the current free tier is 30 requests per minute; the Worker remains far below it.

## Safety limits

- Timeout: 15 seconds default, 30 seconds hard maximum.
- One bounded retry after 250 ms only for transient/429 upstream failures.
- Maximum 1 profile and 5 results per first run. Dry-run fetches no detail records.
- AI analyses are hard-disabled (`0`) and scheduled sync remains disabled.
- No scraping, browser automation, proxying, CAPTCHA bypass or login to Kleinanzeigen.
- No seller messaging and no source page HTML processing.

## Confirmed first-run identifiers

The official lookup endpoints resolved category `Autos` to `216` and postcode/name `31246 Ilsede` to location `2677`. These values are stored in the disabled Xano search profile; they were not guessed.

The sanitized response fixture is stored at `workers/deal-finder-sync/test/fixtures/search-response.sanitized.json`. It contains five ads and excludes seller objects, names, contact data, exact coordinates, API keys, cookies, request IDs, and unnecessary provider metadata.

See the [official API documentation](https://kleinanzeigen-agent.de/dokumentation) before changing the client contract.
