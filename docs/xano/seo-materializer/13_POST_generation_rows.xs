query "seo/internal/generation/rows" verb=POST {
  api_group = "sitecraft-auto-market"
  input {
    text generation filters=trim|min:8|max:80
    enum kind { values = ["listing_index", "edges", "stats", "related", "manifests"] }
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
    conditional {
      if ($input.kind == "listing_index") {
        var $listing_rows { value = [] }
        foreach ($input.rows) {
          each as $row {
            array.push $listing_rows { value = {
              generation: $input.generation, locale_code: $row.locale_code, car_listing_id: $row.car_listing_id,
              slug: $row.slug, listing_updated_at: $row.listing_updated_at, promotion_rank: $row.promotion_rank,
              sort_published_at: $row.sort_published_at, is_active: false, created_at: now, updated_at: now
            } }
          }
        }
        db.transaction {
          stack {
            foreach ($listing_rows) {
              each as $row {
                db.query seo_listing_locale_index {
                  where = (($db.seo_listing_locale_index.generation == $row.generation) && ($db.seo_listing_locale_index.locale_code == $row.locale_code) && ($db.seo_listing_locale_index.car_listing_id == $row.car_listing_id))
                  return = {type: "single"}
                } as $existing_listing
                conditional {
                  if ($existing_listing == null) {
                    db.add seo_listing_locale_index {
                      data = {
                        generation: $row.generation, locale_code: $row.locale_code,
                        car_listing_id: $row.car_listing_id, slug: $row.slug,
                        listing_updated_at: $row.listing_updated_at, promotion_rank: $row.promotion_rank,
                        sort_published_at: $row.sort_published_at, is_active: false,
                        created_at: $row.created_at, updated_at: $row.updated_at
                      }
                    } as $inserted_listing
                  }
                }
              }
            }
          }
        }
      }
      elseif ($input.kind == "edges") {
        var $edge_rows { value = [] }
        foreach ($input.rows) {
          each as $row {
            precondition (($row.facet_id|to_int) > 0) {
              error_type = "inputerror"
              error = "Missing facet"
            }
            array.push $edge_rows { value = {
              generation: $input.generation, facet_id: $row.facet_id, car_listing_id: $row.car_listing_id,
              locale_code: $row.locale_code, listing_updated_at: $row.listing_updated_at,
              is_active: false, created_at: now
            } }
          }
        }
        db.transaction {
          stack {
            foreach ($edge_rows) {
              each as $row {
                db.query seo_taxonomy_listing_edges {
                  where = (($db.seo_taxonomy_listing_edges.generation == $row.generation) && ($db.seo_taxonomy_listing_edges.facet_id == $row.facet_id) && ($db.seo_taxonomy_listing_edges.locale_code == $row.locale_code) && ($db.seo_taxonomy_listing_edges.car_listing_id == $row.car_listing_id))
                  return = {type: "single"}
                } as $existing_edge
                conditional {
                  if ($existing_edge == null) {
                    db.add seo_taxonomy_listing_edges {
                      data = {
                        generation: $row.generation, facet_id: $row.facet_id,
                        car_listing_id: $row.car_listing_id, locale_code: $row.locale_code,
                        listing_updated_at: $row.listing_updated_at, is_active: false,
                        created_at: $row.created_at
                      }
                    } as $inserted_edge
                  }
                }
              }
            }
          }
        }
      }
      elseif ($input.kind == "stats") {
        var $stat_rows { value = [] }
        foreach ($input.rows) {
          each as $row {
            precondition (($row.facet_id|to_int) > 0) {
              error_type = "inputerror"
              error = "Missing facet"
            }
            array.push $stat_rows { value = {
              generation: $input.generation, facet_id: $row.facet_id, locale_code: $row.locale_code,
              ready_listing_count: $row.ready_listing_count, last_listing_updated_at: $row.last_listing_updated_at,
              is_indexable: $row.is_indexable, is_active: false, created_at: now, updated_at: now
            } }
          }
        }
        db.transaction {
          stack {
            foreach ($stat_rows) {
              each as $row {
                db.query seo_taxonomy_locale_stats {
                  where = (($db.seo_taxonomy_locale_stats.generation == $row.generation) && ($db.seo_taxonomy_locale_stats.facet_id == $row.facet_id) && ($db.seo_taxonomy_locale_stats.locale_code == $row.locale_code))
                  return = {type: "single"}
                } as $existing_stat
                conditional {
                  if ($existing_stat == null) {
                    db.add seo_taxonomy_locale_stats {
                      data = {
                        generation: $row.generation, facet_id: $row.facet_id,
                        locale_code: $row.locale_code, ready_listing_count: $row.ready_listing_count,
                        last_listing_updated_at: $row.last_listing_updated_at,
                        is_indexable: $row.is_indexable, is_active: false,
                        created_at: $row.created_at, updated_at: $row.updated_at
                      }
                    } as $inserted_stat
                  }
                }
              }
            }
          }
        }
      }
      elseif ($input.kind == "related") {
        var $related_rows { value = [] }
        foreach ($input.rows) {
          each as $row {
            precondition ((($row.source_facet_id|to_int) > 0) && (($row.related_facet_id|to_int) > 0)) {
              error_type = "inputerror"
              error = "Missing facet"
            }
            array.push $related_rows { value = {
              generation: $input.generation, source_facet_id: $row.source_facet_id,
              related_facet_id: $row.related_facet_id, locale_code: $row.locale_code,
              overlap_count: $row.overlap_count, rank: $row.rank, is_active: false,
              created_at: now, updated_at: now
            } }
          }
        }
        db.transaction {
          stack {
            foreach ($related_rows) {
              each as $row {
                db.query seo_taxonomy_related {
                  where = (($db.seo_taxonomy_related.generation == $row.generation) && ($db.seo_taxonomy_related.source_facet_id == $row.source_facet_id) && ($db.seo_taxonomy_related.related_facet_id == $row.related_facet_id) && ($db.seo_taxonomy_related.locale_code == $row.locale_code))
                  return = {type: "single"}
                } as $existing_related
                conditional {
                  if ($existing_related == null) {
                    db.add seo_taxonomy_related {
                      data = {
                        generation: $row.generation, source_facet_id: $row.source_facet_id,
                        related_facet_id: $row.related_facet_id, locale_code: $row.locale_code,
                        overlap_count: $row.overlap_count, rank: $row.rank, is_active: false,
                        created_at: $row.created_at, updated_at: $row.updated_at
                      }
                    } as $inserted_related_row
                  }
                }
              }
            }
          }
        }
      }
      else {
        var $manifest_rows { value = [] }
        foreach ($input.rows) {
          each as $row {
            array.push $manifest_rows { value = {
              generation: $input.generation, locale_code: $row.locale_code, listing_total: $row.listing_total,
              shard_size: 10000, shard_count: $row.shard_count, last_listing_updated_at: $row.last_listing_updated_at,
              is_active: false, created_at: now, updated_at: now
            } }
          }
        }
        db.transaction {
          stack {
            foreach ($manifest_rows) {
              each as $row {
                db.query seo_sitemap_locale_generations {
                  where = (($db.seo_sitemap_locale_generations.generation == $row.generation) && ($db.seo_sitemap_locale_generations.locale_code == $row.locale_code))
                  return = {type: "single"}
                } as $existing_manifest
                conditional {
                  if ($existing_manifest == null) {
                    db.add seo_sitemap_locale_generations {
                      data = {
                        generation: $row.generation, locale_code: $row.locale_code,
                        listing_total: $row.listing_total, shard_size: $row.shard_size,
                        shard_count: $row.shard_count, last_listing_updated_at: $row.last_listing_updated_at,
                        is_active: false, created_at: $row.created_at, updated_at: $row.updated_at
                      }
                    } as $inserted_manifest
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  response = {inserted: ($input.rows|count)}
  tags = ["sitecraft-auto-market", "seo", "internal", "materializer", "bulk"]
}
