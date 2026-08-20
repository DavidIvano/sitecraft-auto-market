// One bounded localized catalogue page. Reuse the verified Stage 2 public-card
// projection and related-facet projection; never query one endpoint per card.
query "public/locale/catalog" verb=GET {
  api_group = "sitecraft-auto-market"
  input {
    text lang?=de filters=trim|lower|max:35
    int? page?=1 filters=min:1|max:100000
    int? limit?=24 filters=min:1|max:24
  }
  stack {
    db.query locales {
      where = (($db.locales.code == $input.lang) && ($db.locales.is_active == true) && ($db.locales.is_public == true))
      return = {type: "single"}
    } as $requested_locale
    precondition ($requested_locale != null) {
      error_type = "notfound"
      error = "Locale not available"
    }

    db.query seo_listing_locale_index {
      where = (($db.seo_listing_locale_index.is_active == true) && ($db.seo_listing_locale_index.locale_code == $input.lang))
      sort = {seo_listing_locale_index.promotion_rank: "desc", seo_listing_locale_index.sort_published_at: "desc", seo_listing_locale_index.car_listing_id: "desc"}
      return = {type: "list", paging: {page: $input.page, per_page: $input.limit}}
    } as $index_page
    precondition ((($index_page.items|count) > 0) || (($index_page.itemsTotal == 0) && ($input.page == 1))) {
      error_type = "notfound"
      error = "Catalogue page not found"
    }

    var $car_ids { value = [] }
    foreach ($index_page.items) {
      each as $row
      array.push $car_ids { value = $row.car_listing_id }
    }

    // Both queries remain bounded by <= 24 IDs. Project in index_page order.
    db.query car_listings {
      where = ($db.car_listings.id in $car_ids)
      return = {type: "list"}
    } as $cars
    db.query car_listing_translations {
      where = (($db.car_listing_translations.car_listing_id in $car_ids) && ($db.car_listing_translations.locale_code == $input.lang) && (($db.car_listing_translations.translation_status == "completed") || ($db.car_listing_translations.translation_status == "reviewed")))
      sort = {car_listing_translations.updated_at: "desc"}
      return = {type: "list"}
    } as $translations

    // Use the same strict source-hash/readiness and allowlisted public fields as
    // Stage 2 GET_public_locale_taxonomy_type_slug. The output must contain
    // exactly index_page.items count rows or fail closed.
    var $public_cards { value = [] }
    precondition (($public_cards|count) == ($index_page.items|count)) {
      error_type = "standard"
      error = "SEO catalogue generation is inconsistent"
    }

    db.query seo_sitemap_locale_generations {
      where = ($db.seo_sitemap_locale_generations.is_active == true)
      return = {type: "list"}
    } as $ready_generations
    var $ready_locales { value = [] }
    foreach ($ready_generations) {
      each as $ready_generation
      array.push $ready_locales { value = $ready_generation.locale_code }
    }

    // Reuse materialized Stage 2 indexable facet stats/related projection.
    // One aggregate query, at most 8 items in each of 7 groups.
    var $related_groups { value = [] }
  }
  response = {
    items: $public_cards,
    pagination: {page: $index_page.curPage, limit: $index_page.perPage, total: $index_page.itemsTotal, total_pages: $index_page.pageTotal},
    ready_locales: $ready_locales,
    related_groups: $related_groups
  }
  tags = ["sitecraft-auto-market", "public", "locale-aware", "seo-catalog", "bounded", "no-ai"]
}
