function "seo_taxonomy/related_groups" {
  input {
    int source_facet_id
    text generation filters=trim
    text locale_code filters=trim|lower|max:35
    int? limit_per_group?=8 filters=min:1|max:8
  }

  stack {
    db.query seo_taxonomy_related {
      where = (($db.seo_taxonomy_related.is_active == true) && ($db.seo_taxonomy_related.generation == $input.generation) && ($db.seo_taxonomy_related.source_facet_id == $input.source_facet_id) && ($db.seo_taxonomy_related.locale_code == $input.locale_code) && ($db.seo_taxonomy_related.overlap_count > 0) && ($db.seo_taxonomy_related.rank <= $input.limit_per_group))
      sort = {seo_taxonomy_related.rank: "asc", seo_taxonomy_related.overlap_count: "desc", seo_taxonomy_related.related_facet_id: "asc"}
      return = {type: "list", paging: {page: 1, per_page: 48}}
    } as $relations

    var $related_ids { value = [] }
    foreach ($relations.items) {
      each as $relation {
        array.push $related_ids { value = $relation.related_facet_id }
      }
    }

    db.query seo_taxonomy_facets {
      where = (($db.seo_taxonomy_facets.is_active == true) && ($db.seo_taxonomy_facets.generation == $input.generation) && ($db.seo_taxonomy_facets.id in $related_ids))
      return = {type: "list"}
    } as $related_facets

    db.query seo_taxonomy_locale_stats {
      where = (($db.seo_taxonomy_locale_stats.is_active == true) && ($db.seo_taxonomy_locale_stats.generation == $input.generation) && ($db.seo_taxonomy_locale_stats.locale_code == $input.locale_code) && ($db.seo_taxonomy_locale_stats.facet_id in $related_ids) && ($db.seo_taxonomy_locale_stats.is_indexable == true))
      return = {type: "list"}
    } as $related_stats

    var $brand_items { value = [] }
    var $model_items { value = [] }
    var $city_items { value = [] }
    var $region_items { value = [] }
    var $fuel_items { value = [] }
    var $body_items { value = [] }
    var $price_items { value = [] }

    foreach ($relations.items) {
      each as $relation {
        array.filter ($related_facets) if ($this.id == $relation.related_facet_id) as $matching_facets
        foreach ($matching_facets) {
          each as $related_facet {
            array.filter ($related_stats) if ($this.facet_id == $related_facet.id) as $matching_stats
            foreach ($matching_stats) {
              each as $related_stat {
                var $item {
                  value = {
                    type: $related_facet.taxonomy_type, slug: $related_facet.slug,
                    parent_slug: $related_facet.parent_slug, label: $related_facet.label,
                    region_slug: $related_facet.region_slug, code: $related_facet.code,
                    count: $related_stat.ready_listing_count, indexable: true,
                    lastmod: $related_stat.last_listing_updated_at
                  }
                }
                conditional {
                  if ($related_facet.taxonomy_type == "brand") {
                    array.push $brand_items { value = $item }
                  }
                  elseif ($related_facet.taxonomy_type == "model") {
                    array.push $model_items { value = $item }
                  }
                  elseif ($related_facet.taxonomy_type == "city") {
                    array.push $city_items { value = $item }
                  }
                  elseif ($related_facet.taxonomy_type == "region") {
                    array.push $region_items { value = $item }
                  }
                  elseif ($related_facet.taxonomy_type == "fuel") {
                    array.push $fuel_items { value = $item }
                  }
                  elseif ($related_facet.taxonomy_type == "body") {
                    array.push $body_items { value = $item }
                  }
                  elseif ($related_facet.taxonomy_type == "price") {
                    array.push $price_items { value = $item }
                  }
                }
              }
            }
          }
        }
      }
    }

    var $groups { value = [] }
    conditional {
      if (($brand_items|count) > 0) {
        array.push $groups { value = {type: "brand", items: $brand_items} }
      }
    }
    conditional {
      if (($model_items|count) > 0) {
        array.push $groups { value = {type: "model", items: $model_items} }
      }
    }
    conditional {
      if (($city_items|count) > 0) {
        array.push $groups { value = {type: "city", items: $city_items} }
      }
    }
    conditional {
      if (($region_items|count) > 0) {
        array.push $groups { value = {type: "region", items: $region_items} }
      }
    }
    conditional {
      if (($fuel_items|count) > 0) {
        array.push $groups { value = {type: "fuel", items: $fuel_items} }
      }
    }
    conditional {
      if (($body_items|count) > 0) {
        array.push $groups { value = {type: "body", items: $body_items} }
      }
    }
    conditional {
      if (($price_items|count) > 0) {
        array.push $groups { value = {type: "price", items: $price_items} }
      }
    }
  }

  response = $groups
  tags = ["sitecraft-auto-market", "seo", "taxonomy", "related", "bounded", "no-ai"]
  guid = "FpdyGqCodqwBHkvlGVEaOa1l0VQ"
}
