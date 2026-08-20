// Release blueprint: validate against the live Xano branch before publishing.
// Reads only the active materialized generation and at most 24 listing rows.
query "public/locale/taxonomy/{type}/{slug}" verb=GET {
  api_group = "sitecraft-auto-market"

  input {
    text type filters=trim|lower|max:20
    text slug filters=trim|lower|max:100
    text? parent_slug filters=trim|lower|max:100
    text lang?=de filters=trim|lower|max:35
    int? page?=1 filters=min:1|max:100000
    int? limit?=24 filters=min:1|max:24
  }

  stack {
    precondition (($input.type == "brand") || ($input.type == "model") || ($input.type == "city") || ($input.type == "region") || ($input.type == "fuel") || ($input.type == "body") || ($input.type == "price")) {
      error_type = "notfound"
      error = "Taxonomy not found"
    }

    db.query locales {
      where = (($db.locales.code == $input.lang) && ($db.locales.is_active == true) && ($db.locales.is_public == true))
      return = {type: "single"}
    } as $requested_locale
    precondition ($requested_locale != null) {
      error_type = "notfound"
      error = "Locale not available"
    }

    db.query seo_taxonomy_facets {
      where = (($db.seo_taxonomy_facets.is_active == true) && ($db.seo_taxonomy_facets.taxonomy_type == $input.type) && ($db.seo_taxonomy_facets.slug == $input.slug) && (($input.type != "model") || ($db.seo_taxonomy_facets.parent_slug == $input.parent_slug)))
      return = {type: "single"}
    } as $facet
    precondition ($facet != null) {
      error_type = "notfound"
      error = "Taxonomy not found"
    }

    db.query seo_taxonomy_locale_stats {
      where = (($db.seo_taxonomy_locale_stats.is_active == true) && ($db.seo_taxonomy_locale_stats.generation == $facet.generation) && ($db.seo_taxonomy_locale_stats.facet_id == $facet.id) && ($db.seo_taxonomy_locale_stats.locale_code == $input.lang) && ($db.seo_taxonomy_locale_stats.ready_listing_count > 0))
      return = {type: "single"}
    } as $facet_stat
    precondition ($facet_stat != null) {
      error_type = "notfound"
      error = "Taxonomy has no localized listings"
    }

    db.query seo_taxonomy_listing_edges {
      where = (($db.seo_taxonomy_listing_edges.is_active == true) && ($db.seo_taxonomy_listing_edges.generation == $facet.generation) && ($db.seo_taxonomy_listing_edges.facet_id == $facet.id) && ($db.seo_taxonomy_listing_edges.locale_code == $input.lang))
      sort = {seo_taxonomy_listing_edges.listing_updated_at: "desc", seo_taxonomy_listing_edges.car_listing_id: "desc"}
      return = {type: "list", paging: {page: $input.page, per_page: $input.limit}}
    } as $edge_page
    precondition (($edge_page.items|count) > 0) {
      error_type = "notfound"
      error = "Taxonomy page not found"
    }

    var $car_ids { value = [] }
    foreach ($edge_page.items) {
      each as $edge
      array.push $car_ids { value = $edge.car_listing_id }
    }

    // This remains bounded by input.limit (maximum 24).
    db.query car_listings {
      where = (($db.car_listings.id in $car_ids) && (($db.car_listings.status == "approved") || ($db.car_listings.status == "published") || ($db.car_listings.status == "sold") || ($db.car_listings.moderation_status == "approved") || ($db.car_listings.moderation_status == "published") || ($db.car_listings.moderation_status == "sold")))
      return = {type: "list"}
    } as $cars

    db.query car_listing_translations {
      where = (($db.car_listing_translations.car_listing_id in $car_ids) && ($db.car_listing_translations.locale_code == $input.lang) && (($db.car_listing_translations.translation_status == "completed") || ($db.car_listing_translations.translation_status == "reviewed")))
      sort = {car_listing_translations.updated_at: "desc"}
      return = {type: "list"}
    } as $translations

    var $public_cards { value = [] }
    foreach ($edge_page.items) {
      each as $edge
      array.filter ($cars) if ($this.id == $edge.car_listing_id) as $matching_cars
      foreach ($matching_cars) {
        each as $car
        var $source_locale { value = $car.source_locale|first_notnull:""|trim|to_lower }
        var $localized_title { value = "" }
        var $localized_description { value = "" }
        var $translation_meta { value = null }
        conditional {
          if (($source_locale == $input.lang) && (($car.title|first_notnull:""|trim) != "") && (($car.description|first_notnull:""|trim) != "")) {
            var.update $localized_title { value = $car.title|trim }
            var.update $localized_description { value = $car.description|trim }
            var.update $translation_meta { value = {requested_locale: $input.lang, resolved_locale: $input.lang, source_locale: $source_locale, status: "completed", translation_status: "source", readiness: "ready", is_fallback: false} }
          }
          else {
            array.filter ($translations) if (($this.car_listing_id == $car.id) && ($this.source_locale == $source_locale) && ($this.source_hash == $car.translation_source_hash) && (($this.title|first_notnull:""|trim) != "") && (($this.description|first_notnull:""|trim) != "")) as $matching_translations
            foreach ($matching_translations) {
              each as $translation
              conditional {
                if ($translation_meta == null) {
                  var.update $localized_title { value = $translation.title|trim }
                  var.update $localized_description { value = $translation.description|trim }
                  var.update $translation_meta { value = {requested_locale: $input.lang, resolved_locale: $input.lang, source_locale: $source_locale, status: "completed", translation_status: "translated", readiness: "ready", is_fallback: false, updated_at: $translation.updated_at} }
                }
              }
            }
          }
        }
        conditional {
          if (($translation_meta != null) && ($localized_title != "") && ($localized_description != "")) {
            array.push $public_cards {
              value = {
                id: $car.id, slug: $car.slug, title: $localized_title, description: $localized_description,
                brand: $car.brand, model: $car.model,
                body_type: $car.body_type, fuel_type: $car.fuel_type, transmission: $car.transmission,
                year: $car.year, mileage: $car.mileage, price: $car.price, currency: $car.currency,
                city: $car.city,
                country: $car.country, status: $car.status, moderation_status: $car.moderation_status,
                main_image_url: $car.main_image_url, thumbnail_url: $car.thumbnail_url,
                primary_image_url: $car.primary_image_url, image_url: $car.image_url, cover_image_url: $car.cover_image_url,
                created_at: $car.created_at, updated_at: $car.updated_at, source_locale: $source_locale,
                available_locales: [$input.lang], translation: $translation_meta
              }
            }
          }
        }
      }
    }

    // A locale edge is created only after readiness validation. Any mismatch is
    // a materializer defect and must fail closed, never produce a thin 200.
    precondition (($public_cards|count) == ($edge_page.items|count)) {
      error_type = "standard"
      error = "SEO taxonomy generation is inconsistent"
    }

    db.query seo_taxonomy_locale_stats {
      where = (($db.seo_taxonomy_locale_stats.is_active == true) && ($db.seo_taxonomy_locale_stats.generation == $facet.generation) && ($db.seo_taxonomy_locale_stats.facet_id == $facet.id) && ($db.seo_taxonomy_locale_stats.is_indexable == true))
      return = {type: "list"}
    } as $ready_locale_stats
    var $ready_locales { value = [] }
    foreach ($ready_locale_stats) {
      each as $ready_locale_stat
      array.push $ready_locales { value = $ready_locale_stat.locale_code }
    }

    // The production endpoint should use the same projection as the separate
    // related endpoint and embed its <= 48 rows here. Kept as one Xano request.
    db.query seo_taxonomy_related {
      where = (($db.seo_taxonomy_related.is_active == true) && ($db.seo_taxonomy_related.generation == $facet.generation) && ($db.seo_taxonomy_related.source_facet_id == $facet.id) && ($db.seo_taxonomy_related.locale_code == $input.lang))
      sort = {seo_taxonomy_related.rank: "asc"}
      return = {type: "list", paging: {page: 1, per_page: 48}}
    } as $related_rows

    // Xano release step: project related_rows through the related endpoint
    // implementation, group by taxonomy type and cap every group at 8.
    var $related_groups { value = [] }
  }

  response = {
    facet: {
      type: $facet.taxonomy_type, slug: $facet.slug, label: $facet.label,
      parent_slug: $facet.parent_slug, parent_label: null,
      region_slug: $facet.region_slug, region_label: null, code: $facet.code,
      total: $facet_stat.ready_listing_count, lastmod: $facet_stat.last_listing_updated_at,
      ready_locales: $ready_locales
    },
    items: $public_cards,
    pagination: {page: $edge_page.curPage, limit: $edge_page.perPage, total: $edge_page.itemsTotal, total_pages: $edge_page.pageTotal},
    related_groups: $related_groups
  }
  tags = ["sitecraft-auto-market", "public", "locale-aware", "seo-taxonomy", "bounded", "no-ai"]
}
