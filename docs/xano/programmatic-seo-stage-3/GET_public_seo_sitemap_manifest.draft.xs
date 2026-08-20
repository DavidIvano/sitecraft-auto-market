// Global read-only manifest. Exactly one active row per public SEO-ready locale.
query "public/seo/sitemap/manifest" verb=GET {
  api_group = "sitecraft-auto-market"
  input {}
  stack {
    db.query locales {
      where = (($db.locales.is_active == true) && ($db.locales.is_public == true))
      sort = {locales.code: "asc"}
      return = {type: "list"}
    } as $public_locales
    db.query seo_sitemap_locale_generations {
      where = ($db.seo_sitemap_locale_generations.is_active == true)
      sort = {seo_sitemap_locale_generations.locale_code: "asc"}
      return = {type: "list"}
    } as $active_generations
    precondition (($active_generations|count) == ($public_locales|count)) {
      error_type = "standard"
      error = "SEO sitemap locale generation is incomplete"
    }
    var $items { value = [] }
    foreach ($active_generations) {
      each as $generation
      array.push $items {
        value = {
          locale: $generation.locale_code,
          generation: $generation.generation,
          listing_total: $generation.listing_total,
          shard_size: 10000,
          shard_count: $generation.listing_total|divide:10000|ceil,
          lastmod: $generation.last_listing_updated_at
        }
      }
    }
  }
  response = {generated_at: "now", locales: $items}
  tags = ["sitecraft-auto-market", "public", "seo-sitemap", "manifest", "bounded", "no-ai"]
}
