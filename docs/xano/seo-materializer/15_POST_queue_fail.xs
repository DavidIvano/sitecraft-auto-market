query "seo/internal/queue/fail" verb=POST {
  api_group = "sitecraft-auto-market"
  input {
    text worker_id filters=trim|min:8|max:120
    int[] job_ids
    text error_code filters=trim|max:120
  }
  stack {
    var $provided_secret { value = $env.$http_headers."X-Seo-Materializer-Secret"|first_notnull:""|to_text }
    precondition (($provided_secret != "") && ($provided_secret == "__SEO_MATERIALIZER_SECRET__")) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }
    db.query seo_refresh_queue {
      where = (($db.seo_refresh_queue.status == "processing") && ($db.seo_refresh_queue.locked_by == $input.worker_id))
      return = {type: "list", paging: {page: 1, per_page: 100, totals: false}}
    } as $worker_jobs
    foreach ($worker_jobs.items) {
      each as $job {
        db.edit seo_refresh_queue {
          field_name = "id"
          field_value = $job.id
          data = {
          status: (($input.error_code == "DRY_RUN_RELEASED") || (($job.attempts|first_notnull:0) < 5)) ? "pending" : "failed",
          attempts: ($input.error_code == "DRY_RUN_RELEASED") ? 0 : ($job.attempts|first_notnull:0),
          available_at: now, locked_at: null, locked_by: null,
          last_error_code: $input.error_code, updated_at: now
          }
        }
      }
    }
  }
  response = {ok: true, released: ($worker_jobs.items|count)}
  tags = ["sitecraft-auto-market", "seo", "internal", "queue"]
}
