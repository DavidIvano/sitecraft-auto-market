query "seo/internal/health" verb=GET {
  api_group = "sitecraft-auto-market"
  input {
  }
  stack {
    var $provided_secret { value = $env.$http_headers."X-Seo-Materializer-Secret"|first_notnull:""|to_text }
    precondition (($provided_secret != "") && ($provided_secret == "__SEO_MATERIALIZER_SECRET__")) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }

    db.query seo_refresh_queue {
      where = ($db.seo_refresh_queue.status == "pending")
      return = {type: "count"}
    } as $pending_count
    db.query seo_refresh_queue {
      where = (($db.seo_refresh_queue.status == "pending") && ($db.seo_refresh_queue.attempts < 5))
      return = {type: "count"}
    } as $actionable_pending_count
    db.query seo_refresh_queue {
      where = (($db.seo_refresh_queue.status == "pending") && ($db.seo_refresh_queue.attempts >= 5))
      return = {type: "count"}
    } as $exhausted_pending_count
    db.query seo_refresh_queue {
      where = ($db.seo_refresh_queue.status == "processing")
      return = {type: "count"}
    } as $processing_count
    db.query seo_refresh_queue {
      where = ($db.seo_refresh_queue.status == "completed")
      return = {type: "count"}
    } as $completed_count
    db.query seo_refresh_queue {
      where = ($db.seo_refresh_queue.status == "failed")
      return = {type: "count"}
    } as $failed_count

    db.query seo_refresh_queue {
      where = ($db.seo_refresh_queue.status == "pending")
      sort = {seo_refresh_queue.created_at: "asc"}
      return = {type: "single"}
    } as $oldest_pending
    db.query seo_refresh_queue {
      where = (($db.seo_refresh_queue.status == "pending") && ($db.seo_refresh_queue.attempts < 5))
      sort = {seo_refresh_queue.created_at: "asc"}
      return = {type: "single"}
    } as $oldest_actionable_pending
    db.query seo_refresh_queue {
      where = ($db.seo_refresh_queue.status == "completed")
      sort = {seo_refresh_queue.completed_at: "desc"}
      return = {type: "single"}
    } as $last_completed
    db.query seo_refresh_queue {
      where = ($db.seo_refresh_queue.status == "failed")
      sort = {seo_refresh_queue.updated_at: "desc"}
      return = {type: "single"}
    } as $last_failed

    db.query seo_sitemap_locale_generations {
      where = ($db.seo_sitemap_locale_generations.is_active == true)
      sort = {seo_sitemap_locale_generations.locale_code: "asc"}
      return = {type: "list"}
    } as $active_manifests
    db.query seo_sitemap_locale_generations {
      where = ($db.seo_sitemap_locale_generations.is_active == true)
      return = {type: "single"}
    } as $active_manifest

    var $generation { value = $active_manifest.generation|first_notnull:"" }
    db.query seo_refresh_queue {
      where = (($db.seo_refresh_queue.status == "pending") && ($db.seo_refresh_queue.attempts >= 5) && ($db.seo_refresh_queue.materialization_generation == $generation))
      return = {type: "count"}
    } as $exhausted_active_generation_count
    db.query seo_refresh_queue {
      where = (($db.seo_refresh_queue.status == "pending") && ($db.seo_refresh_queue.attempts >= 5) && (($db.seo_refresh_queue.materialization_generation == null) || ($db.seo_refresh_queue.materialization_generation != $generation)))
      return = {type: "count"}
    } as $exhausted_stale_generation_count
    db.query seo_listing_locale_index {
      where = ($db.seo_listing_locale_index.generation == $generation)
      return = {type: "count"}
    } as $listing_index_count
    db.query seo_taxonomy_facets {
      where = ($db.seo_taxonomy_facets.generation == $generation)
      return = {type: "count"}
    } as $facet_count
    db.query seo_taxonomy_listing_edges {
      where = ($db.seo_taxonomy_listing_edges.generation == $generation)
      return = {type: "count"}
    } as $edge_count
    db.query seo_taxonomy_locale_stats {
      where = ($db.seo_taxonomy_locale_stats.generation == $generation)
      return = {type: "count"}
    } as $stat_count
    db.query seo_taxonomy_related {
      where = ($db.seo_taxonomy_related.generation == $generation)
      return = {type: "count"}
    } as $related_count
    db.query locales {
      where = (($db.locales.is_active) && ($db.locales.is_public))
      return = {type: "count"}
    } as $public_locale_count

    var $manifest_items { value = [] }
    foreach ($active_manifests) {
      each as $manifest {
        array.push $manifest_items {
          value = {
            locale: $manifest.locale_code
            generation: $manifest.generation
            listing_total: $manifest.listing_total|first_notnull:0
            shard_count: $manifest.shard_count|first_notnull:0
            lastmod: $manifest.last_listing_updated_at
            updated_at: $manifest.updated_at
          }
        }
      }
    }
  }
  response = {
    checked_at: now
    queue: {
      pending: $pending_count
      actionable_pending: $actionable_pending_count
      exhausted_pending: $exhausted_pending_count
      exhausted_active_generation: $exhausted_active_generation_count
      exhausted_stale_generation: $exhausted_stale_generation_count
      processing: $processing_count
      completed: $completed_count
      failed: $failed_count
      oldest_pending_at: $oldest_pending.created_at
      oldest_actionable_pending_at: $oldest_actionable_pending.created_at
      last_completed_at: $last_completed.completed_at
      last_completed_generation: $last_completed.completed_generation
      last_failed_at: $last_failed.updated_at
      last_error_code: $last_failed.last_error_code
    }
    generation: {
      active: $generation
      public_locales: $public_locale_count
      manifests: $manifest_items
      listing_index: $listing_index_count
      facets: $facet_count
      edges: $edge_count
      stats: $stat_count
      related: $related_count
    }
  }
  tags = ["sitecraft-auto-market", "seo", "internal", "health", "no-ai"]
}
