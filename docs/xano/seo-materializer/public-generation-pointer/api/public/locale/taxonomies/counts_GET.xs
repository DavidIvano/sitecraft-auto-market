query "public/locale/taxonomies/counts" verb=GET {
  api_group = "sitecraft-auto-market"

  input {
    text lang?=de filters=trim|lower|max:35
    int? page?=1 filters=min:1|max:100000
    int? limit?=500 filters=min:1|max:500
  }

  stack {
    db.get locales {
      field_name = "code"
      field_value = $input.lang
    } as $requested_locale

    precondition (($requested_locale != null) && ($requested_locale.is_active) && ($requested_locale.is_public)) {
      error_type = "notfound"
      error = "Locale not available"
    }
    db.query seo_sitemap_locale_generations {
      where = (($db.seo_sitemap_locale_generations.is_active) && ($db.seo_sitemap_locale_generations.locale_code == $input.lang))
      return = {type: "single"}
    } as $active_manifest
    precondition ($active_manifest != null) {
      error_type = "notfound"
      error = "SEO generation unavailable"
    }

    db.query seo_taxonomy_locale_stats {
      where = (($db.seo_taxonomy_locale_stats.generation == $active_manifest.generation) && ($db.seo_taxonomy_locale_stats.locale_code == $input.lang) && ($db.seo_taxonomy_locale_stats.ready_listing_count > 0))
      sort = {seo_taxonomy_locale_stats.facet_id: "asc"}
      return = {
        type  : "list"
        paging: {page: $input.page, per_page: $input.limit, totals: true}
      }
    } as $stats_page

    var $facet_ids {
      value = []
    }

    foreach ($stats_page.items) {
      each as $stat {
        array.push $facet_ids {
          value = $stat.facet_id
        }
      }
    }

    db.query seo_taxonomy_facets {
      where = (($db.seo_taxonomy_facets.generation == $active_manifest.generation) && ($db.seo_taxonomy_facets.id in $facet_ids))
      return = {type: "list"}
    } as $facets

    var $items {
      value = []
    }

    foreach ($stats_page.items) {
      each as $stat {
        array.filter ($facets) if (($this.id == $stat.facet_id) && ($this.generation == $stat.generation)) as $matching_facets
        foreach ($matching_facets) {
          each as $facet {
            array.push $items {
              value = {
                type       : $facet.taxonomy_type
                slug       : $facet.slug
                parent_slug: $facet.parent_slug
                label      : $facet.label
                region_slug: $facet.region_slug
                code       : $facet.code
                count      : $stat.ready_listing_count
                indexable  : $stat.is_indexable
                lastmod    : $stat.last_listing_updated_at
              }
            }
          }
        }
      }
    }
  }

  response = {
    locale    : $input.lang
    items     : $items
    pagination: {page: $stats_page.curPage, limit: $stats_page.perPage, total: $stats_page.itemsTotal, total_pages: $stats_page.pageTotal}
  }

  tags = [
    "sitecraft-auto-market"
    "public"
    "locale-aware"
    "seo-taxonomy"
    "counts"
    "bounded"
    "no-ai"
  ]

  guid = "9HvZPhIMSj46q_qRwHmm2HnO5YU"
}
