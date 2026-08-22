query "seo/internal/queue/reconcile-active" verb=POST {
  api_group = "sitecraft-auto-market"
  input {
  }
  stack {
    var $provided_secret { value = $env.$http_headers."X-Seo-Materializer-Secret"|first_notnull:""|to_text }
    precondition (($provided_secret != "") && ($provided_secret == "__SEO_MATERIALIZER_SECRET__")) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }
    db.query seo_sitemap_locale_generations {
      where = ($db.seo_sitemap_locale_generations.is_active == true)
      return = {type: "single"}
    } as $active_manifest
    precondition ($active_manifest != null) {
      error_type = "inputerror"
      error = "Active generation is missing"
    }
    db.query seo_refresh_queue {
      where = (($db.seo_refresh_queue.status == "processing") && ($db.seo_refresh_queue.locked_at < $active_manifest.updated_at))
      sort = {seo_refresh_queue.id: "asc"}
      return = {type: "list", paging: {page: 1, per_page: 100, totals: false}}
    } as $orphaned
    db.transaction {
      stack {
        foreach ($orphaned.items) {
          each as $job {
            db.edit seo_refresh_queue {
              field_name = "id"
              field_value = $job.id
              data = {
                status: "completed"
                completed_generation: $active_manifest.generation
                completed_at: $active_manifest.updated_at
                locked_at: null
                locked_by: null
                last_error_code: "ACTIVE_GENERATION_RECONCILED"
                updated_at: now
              }
            } as $reconciled
          }
        }
      }
    }
  }
  response = {ok: true, generation: $active_manifest.generation, reconciled: ($orphaned.items|count)}
  tags = ["sitecraft-auto-market", "seo", "internal", "queue", "recovery", "idempotent"]
}
