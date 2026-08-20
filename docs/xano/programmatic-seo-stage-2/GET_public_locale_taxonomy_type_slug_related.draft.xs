// Related facets are precomputed by overlap. No per-card or arbitrary filter query.
query "public/locale/taxonomy/{type}/{slug}/related" verb=GET {
  api_group = "sitecraft-auto-market"
  input {
    text type filters=trim|lower|max:20
    text slug filters=trim|lower|max:100
    text? parent_slug filters=trim|lower|max:100
    text lang?=de filters=trim|lower|max:35
    int? limit_per_group?=8 filters=min:1|max:8
  }
  stack {
    db.query seo_taxonomy_facets {
      where = (($db.seo_taxonomy_facets.is_active == true) && ($db.seo_taxonomy_facets.taxonomy_type == $input.type) && ($db.seo_taxonomy_facets.slug == $input.slug) && (($input.type != "model") || ($db.seo_taxonomy_facets.parent_slug == $input.parent_slug)))
      return = {type: "single"}
    } as $source_facet
    precondition ($source_facet != null) {
      error_type = "notfound"
      error = "Taxonomy not found"
    }
    db.query seo_taxonomy_related {
      where = (($db.seo_taxonomy_related.is_active == true) && ($db.seo_taxonomy_related.generation == $source_facet.generation) && ($db.seo_taxonomy_related.source_facet_id == $source_facet.id) && ($db.seo_taxonomy_related.locale_code == $input.lang) && ($db.seo_taxonomy_related.overlap_count > 0))
      sort = {seo_taxonomy_related.rank: "asc"}
      return = {type: "list", paging: {page: 1, per_page: 48}}
    } as $relations
    var $related_ids { value = [] }
    foreach ($relations.items) {
      each as $relation
      array.push $related_ids { value = $relation.related_facet_id }
    }
    db.query seo_taxonomy_facets {
      where = (($db.seo_taxonomy_facets.is_active == true) && ($db.seo_taxonomy_facets.generation == $source_facet.generation) && ($db.seo_taxonomy_facets.id in $related_ids))
      return = {type: "list"}
    } as $related_facets
    db.query seo_taxonomy_locale_stats {
      where = (($db.seo_taxonomy_locale_stats.is_active == true) && ($db.seo_taxonomy_locale_stats.generation == $source_facet.generation) && ($db.seo_taxonomy_locale_stats.locale_code == $input.lang) && ($db.seo_taxonomy_locale_stats.facet_id in $related_ids) && ($db.seo_taxonomy_locale_stats.is_indexable == true))
      return = {type: "list"}
    } as $related_stats
    // Release implementation groups the joined rows into fixed taxonomy types,
    // preserves rank, and enforces limit_per_group. Do not query per row.
    var $groups { value = [] }
  }
  response = {locale: $input.lang, source: {type: $source_facet.taxonomy_type, slug: $source_facet.slug, parent_slug: $source_facet.parent_slug}, related_groups: $groups}
  tags = ["sitecraft-auto-market", "public", "locale-aware", "seo-taxonomy", "related", "bounded", "no-ai"]
}
