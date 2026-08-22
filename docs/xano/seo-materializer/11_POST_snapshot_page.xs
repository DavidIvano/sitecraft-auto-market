query "seo/internal/snapshot/page" verb=POST {
  api_group = "sitecraft-auto-market"
  input {
    int? page?=1 filters=min:1|max:100000
    int? limit?=100 filters=min:1|max:100
  }
  stack {
    var $provided_secret { value = $env.$http_headers."X-Seo-Materializer-Secret"|first_notnull:""|to_text }
    precondition (($provided_secret != "") && ($provided_secret == "__SEO_MATERIALIZER_SECRET__")) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }
    db.query locales {
      where = (($db.locales.is_active == true) && ($db.locales.is_public == true))
      sort = {locales.code: "asc"}
      return = {type: "list"}
    } as $public_locales
    var $locales { value = [] }
    foreach ($public_locales) { each as $locale { array.push $locales { value = $locale.code } } }
    db.query car_listings {
      where = (((($db.car_listings.status == "approved") || ($db.car_listings.status == "sold") || ($db.car_listings.moderation_status == "approved") || ($db.car_listings.moderation_status == "sold"))) && ($db.car_listings.status != "blocked") && ($db.car_listings.status != "deleted") && ($db.car_listings.status != "archived"))
      sort = {car_listings.id: "asc"}
      return = {type: "list", paging: {page: $input.page, per_page: $input.limit, totals: true}}
    } as $listing_page
    var $listings { value = [] }
    var $listing_ids { value = [] }
    foreach ($listing_page.items) {
      each as $car {
        array.push $listing_ids { value = $car.id }
        array.push $listings {
          value = {
            id: $car.id, slug: $car.slug, title: $car.title, description: $car.description,
            brand: $car.brand, model: $car.model, year: $car.year, mileage: $car.mileage,
            fuel_type: $car.fuel_type, transmission: $car.transmission, body_type: $car.body_type,
            color: $car.color, price: $car.price, currency: $car.currency, city: $car.city,
            country: $car.country, status: $car.status, moderation_status: $car.moderation_status,
            main_image_url: $car.main_image_url, created_at: $car.created_at, updated_at: $car.updated_at,
            source_locale: $car.source_locale, translation_source_hash: $car.translation_source_hash,
            translation_version: $car.translation_version, translation_updated_at: $car.translation_updated_at,
            boosted_at: $car.boosted_at, boosted_until: $car.boosted_until,
            featured_at: $car.featured_at, featured_until: $car.featured_until,
            homepage_at: $car.homepage_at, homepage_until: $car.homepage_until,
            last_promoted_at: $car.last_promoted_at
          }
        }
      }
    }
    var $translations { value = [] }
    conditional {
      if (($listing_ids|count) > 0) {
        db.query car_listing_translations {
          where = ($db.car_listing_translations.car_listing_id in $listing_ids)
          sort = {car_listing_translations.id: "asc"}
          return = {type: "list"}
        } as $translation_rows
        foreach ($translation_rows) {
          each as $translation {
            array.push $translations { value = {
              car_listing_id: $translation.car_listing_id, locale_code: $translation.locale_code,
              title: $translation.title, description: $translation.description,
              seo_title: $translation.seo_title, seo_description: $translation.seo_description,
              image_alt_texts: $translation.image_alt_texts,
              translation_status: $translation.translation_status, source_locale: $translation.source_locale,
              source_hash: $translation.source_hash, updated_at: $translation.updated_at
            } }
          }
        }
      }
    }
  }
  response = {
    listings: $listings,
    translations: $translations,
    locales: $locales,
    pagination: {page: $listing_page.curPage, limit: $listing_page.perPage, total: $listing_page.itemsTotal, total_pages: $listing_page.pageTotal}
  }
  tags = ["sitecraft-auto-market", "seo", "internal", "snapshot", "privacy-minimized"]
}
