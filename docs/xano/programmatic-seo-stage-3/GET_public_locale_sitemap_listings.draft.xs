// Immutable slug-only listing sitemap shard. No card or seller projection.
query "public/locale/sitemap/listings" verb=GET {
  api_group = "sitecraft-auto-market"
  input {
    text lang filters=trim|lower|max:35
    text generation filters=trim|max:80
    int page filters=min:1|max:10000
    int? limit?=10000 filters=min:10000|max:10000
  }
  stack {
    db.query seo_sitemap_locale_generations {
      where = (($db.seo_sitemap_locale_generations.locale_code == $input.lang) && ($db.seo_sitemap_locale_generations.generation == $input.generation))
      return = {type: "single"}
    } as $manifest
    precondition ($manifest != null) {
      error_type = "notfound"
      error = "Sitemap generation not found"
    }
    db.query seo_listing_locale_index {
      where = (($db.seo_listing_locale_index.generation == $input.generation) && ($db.seo_listing_locale_index.locale_code == $input.lang))
      sort = {seo_listing_locale_index.car_listing_id: "asc"}
      return = {type: "list", paging: {page: $input.page, per_page: $input.limit}}
    } as $listing_page
    precondition ((($listing_page.items|count) > 0) || (($manifest.listing_total == 0) && ($input.page == 1))) {
      error_type = "notfound"
      error = "Sitemap shard not found"
    }
    var $items { value = [] }
    foreach ($listing_page.items) {
      each as $row
      array.push $items { value = {slug: $row.slug, lastmod: $row.listing_updated_at} }
    }
  }
  response = {
    locale: $input.lang,
    generation: $input.generation,
    items: $items,
    pagination: {page: $listing_page.curPage, limit: $listing_page.perPage, total: $listing_page.itemsTotal, total_pages: $listing_page.pageTotal}
  }
  tags = ["sitecraft-auto-market", "public", "locale-aware", "seo-sitemap", "slug-only", "bounded", "no-ai"]
}
