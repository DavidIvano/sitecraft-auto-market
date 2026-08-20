query "public/locale/taxonomy/{type}/{slug}" verb=GET {
  api_group = "sitecraft-auto-market"

  input {
    text type filters=trim|lower|max:20
    text slug filters=trim|lower|max:100
    text? parent_slug?="" filters=trim|lower|max:100
    text lang?=de filters=trim|lower|max:35
    int? page?=1 filters=min:1|max:100000
    int? limit?=24 filters=min:1|max:24
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
      return = {type: "list", paging: {page: $input.page, per_page: $input.limit, totals: true}}
    } as $edge_page
    precondition (($edge_page.items|count) > 0) {
      error_type = "notfound"
      error = "Taxonomy page not found"
    }

    var $car_ids { value = [] }
    foreach ($edge_page.items) {
      each as $edge {
        array.push $car_ids { value = $edge.car_listing_id }
      }
    }

    db.query car_listings {
      where = (($db.car_listings.id in $car_ids) && ((($db.car_listings.status == "approved") || ($db.car_listings.status == "published") || ($db.car_listings.status == "sold") || ($db.car_listings.moderation_status == "approved") || ($db.car_listings.moderation_status == "published") || ($db.car_listings.moderation_status == "sold")) && (($db.car_listings.status == null) || (($db.car_listings.status != "draft") && ($db.car_listings.status != "ai_draft") && ($db.car_listings.status != "pending_review") && ($db.car_listings.status != "needs_fix") && ($db.car_listings.status != "rejected") && ($db.car_listings.status != "blocked") && ($db.car_listings.status != "deleted") && ($db.car_listings.status != "archived"))) && (($db.car_listings.moderation_status == null) || (($db.car_listings.moderation_status != "draft") && ($db.car_listings.moderation_status != "ai_draft") && ($db.car_listings.moderation_status != "pending_review") && ($db.car_listings.moderation_status != "needs_fix") && ($db.car_listings.moderation_status != "rejected") && ($db.car_listings.moderation_status != "blocked") && ($db.car_listings.moderation_status != "deleted") && ($db.car_listings.moderation_status != "archived")))))
      return = {type: "list"}
    } as $cars

    db.query car_listing_translations {
      where = (($db.car_listing_translations.car_listing_id in $car_ids) && ($db.car_listing_translations.locale_code == $input.lang) && (($db.car_listing_translations.translation_status == "completed") || ($db.car_listing_translations.translation_status == "reviewed")))
      sort = {car_listing_translations.updated_at: "desc"}
      return = {type: "list"}
    } as $translations

    var $public_cards { value = [] }
    foreach ($edge_page.items) {
      each as $edge {
        array.filter ($cars) if ($this.id == $edge.car_listing_id) as $matching_cars
        foreach ($matching_cars) {
          each as $car {
            var $source_locale { value = $car.source_locale|first_notnull:""|trim|to_lower }
            var $source_hash { value = $car.translation_source_hash|first_notnull:"" }
            var $localized_title { value = "" }
            var $localized_description { value = "" }
            var $localized_seo_title { value = "" }
            var $localized_seo_description { value = "" }
            var $localized_image_alt_texts { value = [] }
            var $translation_meta { value = null }

        conditional {
          if (($source_locale == $input.lang) && (($car.title|first_notnull:""|trim) != "") && (($car.description|first_notnull:""|trim) != "")) {
            var.update $localized_title { value = $car.title|trim }
            var.update $localized_description { value = $car.description|trim }
            var.update $translation_meta {
              value = {
                locale: $input.lang, requested_locale: $input.lang, resolved_locale: $input.lang,
                source_locale: $source_locale, source_hash: $source_hash, resolved_source_hash: $source_hash,
                status: "completed", translation_status: "source", readiness: "ready", is_fallback: false,
                translation_version: $car.translation_version|first_notnull:0,
                updated_at: $car.translation_updated_at|first_notnull:$car.updated_at
              }
            }
          }
          elseif (($source_locale != "") && ($source_hash != "")) {
            array.filter ($translations) if (($this.car_listing_id == $car.id) && ($this.locale_code == $input.lang) && ($this.source_locale == $source_locale) && ($this.source_hash == $source_hash) && (($this.translation_status == "completed") || ($this.translation_status == "reviewed")) && (($this.title|first_notnull:""|trim) != "") && (($this.description|first_notnull:""|trim) != "")) as $matching_translations
            foreach ($matching_translations) {
              each as $translation {
                conditional {
                  if ($translation_meta == null) {
                    var.update $localized_title { value = $translation.title|trim }
                    var.update $localized_description { value = $translation.description|trim }
                    var.update $localized_seo_title { value = $translation.seo_title|first_notnull:"" }
                    var.update $localized_seo_description { value = $translation.seo_description|first_notnull:"" }
                    var.update $localized_image_alt_texts { value = $translation.image_alt_texts|first_notnull:[] }
                    var.update $translation_meta {
                      value = {
                        id: $translation.id, locale: $input.lang, requested_locale: $input.lang, resolved_locale: $input.lang,
                        source_locale: $source_locale, source_hash: $source_hash, resolved_source_hash: $translation.source_hash,
                        status: "completed", translation_status: "translated", readiness: "ready", is_fallback: false,
                        translation_version: $car.translation_version|first_notnull:0, updated_at: $translation.updated_at
                      }
                    }
                  }
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
                    seo_title: $localized_seo_title, seo_description: $localized_seo_description,
                    image_alt_texts: $localized_image_alt_texts,
                    brand: $car.brand, model: $car.model, vehicle_type: $car.vehicle_type,
                    body_type: $car.body_type, color: $car.color,
                    vehicle_condition: $car.vehicle_condition|first_notnull:$car.condition,
                    year: $car.year, mileage: $car.mileage, fuel_type: $car.fuel_type,
                    transmission: $car.transmission, price: $car.price, currency: $car.currency,
                    city: $car.city, country: $car.country, status: $car.status,
                    moderation_status: $car.moderation_status, main_image_url: $car.main_image_url,
                    thumbnail_url: $car.thumbnail_url, primary_image_url: $car.primary_image_url,
                    image_url: $car.image_url, cover_image_url: $car.cover_image_url,
                    image_urls: $car.image_urls, created_at: $car.created_at, updated_at: $car.updated_at,
                    source_locale: $source_locale, translation_version: $car.translation_version|first_notnull:0,
                    translations_ready: true, available_locales: [$input.lang], translation: $translation_meta
                  }
                }
              }
            }
          }
        }
      }
    }

    precondition (($public_cards|count) == ($edge_page.items|count)) {
      error = "SEO taxonomy generation is inconsistent"
    }

    db.query seo_taxonomy_locale_stats {
      where = (($db.seo_taxonomy_locale_stats.is_active == true) && ($db.seo_taxonomy_locale_stats.generation == $facet.generation) && ($db.seo_taxonomy_locale_stats.facet_id == $facet.id) && ($db.seo_taxonomy_locale_stats.ready_listing_count > 0))
      sort = {seo_taxonomy_locale_stats.locale_code: "asc"}
      return = {type: "list"}
    } as $ready_locale_stats
    var $ready_locales { value = [] }
    foreach ($ready_locale_stats) {
      each as $ready_locale_stat {
        array.push $ready_locales { value = $ready_locale_stat.locale_code }
      }
    }

    var $parent_label { value = null }
    conditional {
      if (($facet.taxonomy_type == "model") && (($facet.parent_slug|first_notnull:""|trim) != "")) {
        db.query seo_taxonomy_facets {
          where = (($db.seo_taxonomy_facets.is_active == true) && ($db.seo_taxonomy_facets.generation == $facet.generation) && ($db.seo_taxonomy_facets.taxonomy_type == "brand") && ($db.seo_taxonomy_facets.slug == $facet.parent_slug))
          return = {type: "single"}
        } as $parent_facet
        conditional {
          if ($parent_facet != null) {
            var.update $parent_label { value = $parent_facet.label }
          }
        }
      }
    }

    var $region_label { value = null }
    conditional {
      if (($facet.taxonomy_type == "city") && (($facet.region_slug|first_notnull:""|trim) != "")) {
        db.query seo_taxonomy_facets {
          where = (($db.seo_taxonomy_facets.is_active == true) && ($db.seo_taxonomy_facets.generation == $facet.generation) && ($db.seo_taxonomy_facets.taxonomy_type == "region") && ($db.seo_taxonomy_facets.slug == $facet.region_slug))
          return = {type: "single"}
        } as $region_facet
        conditional {
          if ($region_facet != null) {
            var.update $region_label { value = $region_facet.label }
          }
        }
      }
    }

    function.run "seo_taxonomy/related_groups" {
      input = {source_facet_id: $facet.id, generation: $facet.generation, locale_code: $input.lang, limit_per_group: 8}
    } as $related_groups
  }

  response = {
    facet: {
      type: $facet.taxonomy_type, slug: $facet.slug, label: $facet.label,
      parent_slug: $facet.parent_slug, parent_label: $parent_label,
      region_slug: $facet.region_slug, region_label: $region_label, code: $facet.code,
      total: $facet_stat.ready_listing_count, lastmod: $facet_stat.last_listing_updated_at,
      ready_locales: $ready_locales
    },
    items: $public_cards,
    pagination: {page: $edge_page.curPage, limit: $edge_page.perPage, total: $edge_page.itemsTotal, total_pages: $edge_page.pageTotal},
    related_groups: $related_groups
  }
  tags = ["sitecraft-auto-market", "public", "locale-aware", "seo-taxonomy", "bounded", "no-ai"]
  guid = "PS_0iVBYKOpFvdO3e6NtxABGTsc"
}
