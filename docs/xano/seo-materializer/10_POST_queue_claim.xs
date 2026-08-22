query "seo/internal/queue/claim" verb=POST {
  api_group = "sitecraft-auto-market"
  input {
    text worker_id filters=trim|min:8|max:120
    int? limit?=100 filters=min:1|max:100
  }
  stack {
    var $provided_secret { value = $env.$http_headers."X-Seo-Materializer-Secret"|first_notnull:""|to_text }
    precondition (($provided_secret != "") && ($provided_secret == "__SEO_MATERIALIZER_SECRET__")) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }

    db.query seo_refresh_queue {
      where = (($db.seo_refresh_queue.status == "processing") && ($db.seo_refresh_queue.locked_at < (now|timestamp_subtract_minutes:30)))
      return = {type: "list", paging: {page: 1, per_page: 100, totals: false}}
    } as $stale_processing
    foreach ($stale_processing.items) {
      each as $stale_job {
        db.edit seo_refresh_queue {
          field_name = "id"
          field_value = $stale_job.id
          data = {status: "pending", available_at: now, locked_at: null, locked_by: null, last_error_code: "STALE_LOCK_RECOVERED", updated_at: now}
        } as $recovered_job
      }
    }

    db.query seo_refresh_queue {
      where = (($db.seo_refresh_queue.status == "pending") && ($db.seo_refresh_queue.available_at <= now) && ($db.seo_refresh_queue.attempts < 5))
      sort = {seo_refresh_queue.id: "asc"}
      return = {type: "list", paging: {page: 1, per_page: $input.limit, totals: false}}
    } as $pending
    var $jobs { value = [] }
    db.transaction {
      stack {
        foreach ($pending.items) {
          each as $job {
            db.edit seo_refresh_queue {
              field_name = "id"
              field_value = $job.id
              data = {status: "processing", locked_at: now, locked_by: $input.worker_id, attempts: ($job.attempts|first_notnull:0) + 1, updated_at: now}
            } as $claimed
            array.push $jobs { value = {id: $claimed.id, event_type: $claimed.event_type, car_listing_id: $claimed.car_listing_id, locale_code: $claimed.locale_code, materialization_generation: $claimed.materialization_generation, materialization_cursor: $claimed.materialization_cursor|first_notnull:0} }
          }
        }
      }
    }
  }
  response = {jobs: $jobs}
  tags = ["sitecraft-auto-market", "seo", "internal", "queue"]
}
