# Public response patches

These response patches are ready for Xano review and were not published to production.

## `GET /cars`

Keep the endpoint public. When an optional authenticated identity is available, query `car_listing_favorites` once for the current page IDs, build an in-memory ID set, and add `is_saved`/`saved_at` to each projected listing. Do not query favorites inside the listing loop. For anonymous requests return `is_saved: false`.

## `GET /cars/{slug}`

Use one owner-scoped favorite lookup for the selected listing. Return only the public seller DTO:

```json
{
  "seller": {
    "name": "Public display name",
    "type": "private",
    "city": "Berlin",
    "active_listings_count": 3,
    "contact": {
      "phone": "+491234567890",
      "phone_href": "tel:+491234567890",
      "email": null,
      "email_href": null,
      "preferred_method": "phone"
    }
  }
}
```

Only include phone when `show_phone == true` and email when `show_email == true`. Never fall back to login email, Google identity fields, password data, tokens, or hidden contact values. Apply the same public projection to `GET /cars/{slug}/seller-listings`.

## `GET /dashboard/listings`

Keep ownership filtering unchanged and add `is_saved` using one owner-scoped favorites lookup for the returned page. This field describes ordinary Auto Market favorites only; it must not read or mutate the Deal Finder shortlist.

## Optional-auth constraint

The local frontend uses one authenticated `POST /favorites/status` request accepting at most 100 listing IDs. Keep `/cars` anonymous and merge this owner-scoped response in the browser; never use local storage as the primary favorites database.
