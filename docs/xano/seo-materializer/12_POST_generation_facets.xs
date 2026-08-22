query "seo/internal/generation/facets" verb=POST {
  api_group = "sitecraft-auto-market"
  input {
    text generation filters=trim|min:8|max:80
    json[] rows
  }
  stack {
    var $provided_secret { value = $env.$http_headers."X-Seo-Materializer-Secret"|first_notnull:""|to_text }
    precondition (($provided_secret != "") && ($provided_secret == "__SEO_MATERIALIZER_SECRET__")) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }
    precondition (($input.rows|count) <= 100) {
      error_type = "inputerror"
      error = "Batch too large"
    }
    var $facet_rows { value = [] }
    foreach ($input.rows) {
      each as $row {
        precondition ((($row.key|first_notnull:""|trim) != "") && (($row.slug|first_notnull:""|trim) != "")) {
          error_type = "inputerror"
          error = "Invalid facet row"
        }
        array.push $facet_rows {
          value = {
            generation: $input.generation, taxonomy_type: $row.taxonomy_type, slug: $row.slug,
            parent_slug: $row.parent_slug, label: $row.label, region_slug: $row.region_slug,
            code: $row.code, price_min: $row.price_min, price_max: $row.price_max,
            price_max_exclusive: $row.price_max_exclusive|first_notnull:true, is_active: false,
            created_at: now, updated_at: now
          }
        }
      }
    }
    var $items { value = [] }
    db.transaction {
      stack {
        foreach ($facet_rows) {
          each as $row {
            db.query seo_taxonomy_facets {
              where = (($db.seo_taxonomy_facets.generation == $row.generation) && ($db.seo_taxonomy_facets.taxonomy_type == $row.taxonomy_type) && ($db.seo_taxonomy_facets.slug == $row.slug) && (($row.parent_slug == null) || ($db.seo_taxonomy_facets.parent_slug == $row.parent_slug)))
              return = {type: "single"}
            } as $existing_facet
            var $facet { value = $existing_facet }
            conditional {
              if ($existing_facet == null) {
                db.add seo_taxonomy_facets {
                  data = {
                    generation: $row.generation, taxonomy_type: $row.taxonomy_type, slug: $row.slug,
                    parent_slug: $row.parent_slug, label: $row.label, region_slug: $row.region_slug,
                    code: $row.code, price_min: $row.price_min, price_max: $row.price_max,
                    price_max_exclusive: $row.price_max_exclusive, is_active: false,
                    created_at: $row.created_at, updated_at: $row.updated_at
                  }
                } as $created_facet
                var.update $facet { value = $created_facet }
              }
            }
            var $key { value = $facet.taxonomy_type ~ "::" ~ $facet.slug }
            conditional {
              if ($facet.taxonomy_type == "model") {
                var.update $key { value = "model:" ~ $facet.parent_slug ~ ":" ~ $facet.slug }
              }
            }
            array.push $items { value = {key: $key, id: $facet.id} }
          }
        }
      }
    }
  }
  response = {items: $items}
  tags = ["sitecraft-auto-market", "seo", "internal", "materializer", "bulk"]
}
