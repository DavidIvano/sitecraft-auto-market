query "seo/internal/generation/activate" verb=POST {
  api_group = "sitecraft-auto-market"
  input {
    text worker_id filters=trim|min:8|max:120
    text generation filters=trim|min:8|max:80
    int[] job_ids
    object expected {
      schema {
        int listing_index filters=min:1
        int facets filters=min:1
        int edges filters=min:1
        int stats filters=min:1
        int related filters=min:0
        int manifests filters=min:1
        int locales filters=min:1|max:28
      }
    }
  }
  stack {
    var $provided_secret { value = $env.$http_headers."X-Seo-Materializer-Secret"|first_notnull:""|to_text }
    precondition (($provided_secret != "") && ($provided_secret == "__SEO_MATERIALIZER_SECRET__")) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }
    db.query seo_listing_locale_index {
      where = ($db.seo_listing_locale_index.generation == $input.generation)
      return = {type: "count"}
    } as $listing_count
    db.query seo_taxonomy_facets {
      where = ($db.seo_taxonomy_facets.generation == $input.generation)
      return = {type: "count"}
    } as $facet_count
    db.query seo_taxonomy_listing_edges {
      where = ($db.seo_taxonomy_listing_edges.generation == $input.generation)
      return = {type: "count"}
    } as $edge_count
    db.query seo_taxonomy_locale_stats {
      where = ($db.seo_taxonomy_locale_stats.generation == $input.generation)
      return = {type: "count"}
    } as $stat_count
    db.query seo_taxonomy_related {
      where = ($db.seo_taxonomy_related.generation == $input.generation)
      return = {type: "count"}
    } as $related_count
    db.query seo_sitemap_locale_generations {
      where = ($db.seo_sitemap_locale_generations.generation == $input.generation)
      return = {type: "count"}
    } as $manifest_count
    precondition (($listing_count == $input.expected.listing_index) && ($facet_count == $input.expected.facets) && ($edge_count == $input.expected.edges) && ($stat_count == $input.expected.stats) && ($related_count == $input.expected.related) && ($manifest_count == $input.expected.manifests) && ($manifest_count == $input.expected.locales)) {
      error_type = "inputerror"
      error = "Generation count invariant failed"
    }
    db.query seo_sitemap_locale_generations {
      where = ($db.seo_sitemap_locale_generations.is_active == true)
      return = {type: "list"}
    } as $old_manifests
    db.query seo_sitemap_locale_generations {
      where = ($db.seo_sitemap_locale_generations.generation == $input.generation)
      return = {type: "list"}
    } as $new_manifests
    db.query seo_refresh_queue {
      where = (($db.seo_refresh_queue.status == "processing") && ($db.seo_refresh_queue.locked_by == $input.worker_id))
      return = {type: "list", paging: {page: 1, per_page: 100, totals: false}}
    } as $worker_jobs
    db.transaction {
      stack {
        foreach ($old_manifests) {
          each as $manifest {
            db.edit seo_sitemap_locale_generations {
              field_name = "id"
              field_value = $manifest.id
              data = {is_active: false, updated_at: now}
            } as $deactivated_manifest
          }
        }
        foreach ($new_manifests) {
          each as $manifest {
            db.edit seo_sitemap_locale_generations {
              field_name = "id"
              field_value = $manifest.id
              data = {is_active: true, updated_at: now}
            } as $activated_manifest
          }
        }
        foreach ($worker_jobs.items) {
          each as $job {
            db.edit seo_refresh_queue {
              field_name = "id"
              field_value = $job.id
              data = {
                status: "completed", completed_generation: $input.generation, completed_at: now,
                locked_at: null, locked_by: null, last_error_code: null, updated_at: now
              }
            } as $completed_job
          }
        }
      }
    }
  }
  response = {ok: true, generation: $input.generation, activated_at: now, jobs_completed: ($worker_jobs.items|count)}
  tags = ["sitecraft-auto-market", "seo", "internal", "materializer", "atomic"]
}
