query "public/locale/taxonomy/{type}/{slug}/related" verb=GET {
  api_group = "sitecraft-auto-market"

  input {
    text type filters=trim|lower|max:20
    text slug filters=trim|lower|max:100
    text? parent_slug?="" filters=trim|lower|max:100
    text lang?=de filters=trim|lower|max:35
    int? limit_per_group?=8 filters=min:1|max:8
  }

  stack {
    precondition (($input.type == "brand") || ($input.type == "model") || ($input.type == "city") || ($input.type == "region") || ($input.type == "fuel") || ($input.type == "body") || ($input.type == "price")) {
      error_type = "notfound"
      error = "Taxonomy not found"
    }
    db.get locales {
      field_name = "code"
      field_value = $input.lang
    } as $requested_locale
    precondition (($requested_locale != null) && ($requested_locale.is_active == true) && ($requested_locale.is_public == true)) {
      error_type = "notfound"
      error = "Locale not available"
    }
    db.query seo_taxonomy_facets {
      where = (($db.seo_taxonomy_facets.is_active == true) && ($db.seo_taxonomy_facets.taxonomy_type == $input.type) && ($db.seo_taxonomy_facets.slug == $input.slug) && (($input.type != "model") || ($db.seo_taxonomy_facets.parent_slug == $input.parent_slug)))
      return = {type: "single"}
    } as $source_facet
    precondition ($source_facet != null) {
      error_type = "notfound"
      error = "Taxonomy not found"
    }
    db.query seo_taxonomy_locale_stats {
      where = (($db.seo_taxonomy_locale_stats.is_active == true) && ($db.seo_taxonomy_locale_stats.generation == $source_facet.generation) && ($db.seo_taxonomy_locale_stats.facet_id == $source_facet.id) && ($db.seo_taxonomy_locale_stats.locale_code == $input.lang) && ($db.seo_taxonomy_locale_stats.ready_listing_count > 0))
      return = {type: "single"}
    } as $source_stat
    precondition ($source_stat != null) {
      error_type = "notfound"
      error = "Taxonomy has no localized listings"
    }
    function.run "seo_taxonomy/related_groups" {
      input = {source_facet_id: $source_facet.id, generation: $source_facet.generation, locale_code: $input.lang, limit_per_group: $input.limit_per_group}
    } as $groups
  }

  response = {
    locale: $input.lang,
    source: {type: $source_facet.taxonomy_type, slug: $source_facet.slug, parent_slug: $source_facet.parent_slug},
    related_groups: $groups
  }
  tags = ["sitecraft-auto-market", "public", "locale-aware", "seo-taxonomy", "related", "bounded", "no-ai"]
  guid = "HzelM68JKFjnLzWrSHAoFDBDGyI"
}
