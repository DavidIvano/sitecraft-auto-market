query "seo/internal/queue/recover-exhausted" verb=POST {
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
      where = (($db.seo_refresh_queue.status == "pending") && ($db.seo_refresh_queue.attempts >= 5))
      sort = {seo_refresh_queue.id: "asc"}
      return = {type: "list", paging: {page: 1, per_page: 100, totals: false}}
    } as $exhausted
    db.transaction {
      stack {
        foreach ($exhausted.items) {
          each as $job {
            db.edit seo_refresh_queue {
              field_name = "id"
              field_value = $job.id
              data = {
                status: "pending"
                attempts: 0
                available_at: now
                locked_at: null
                locked_by: null
                last_error_code: "EXHAUSTED_RETRY_RECOVERED"
                materialization_generation: null
                materialization_cursor: 0
                updated_at: now
              }
            } as $recovered
          }
        }
      }
    }
  }
  response = {ok: true, recovered: ($exhausted.items|count), available_at: now}
  tags = ["sitecraft-auto-market", "seo", "internal", "queue", "recovery", "idempotent"]
}
