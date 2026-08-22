query "seo/internal/queue/fail" verb=POST {
  api_group = "sitecraft-auto-market"
  input {
    int[] job_ids
    text error_code filters=trim|max:120
  }
  stack {
    var $provided_secret { value = $env.$http_headers."X-Seo-Materializer-Secret"|first_notnull:""|to_text }
    precondition (($provided_secret != "") && ($provided_secret == "__SEO_MATERIALIZER_SECRET__")) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }
    foreach ($input.job_ids) {
      each as $job_id {
        db.get seo_refresh_queue {
          field_name = "id"
          field_value = $job_id
        } as $job
        conditional {
          if ($job != null) {
            db.edit seo_refresh_queue {
              field_name = "id"
              field_value = $job_id
              data = {
              status: (($input.error_code == "DRY_RUN_RELEASED") || (($job.attempts|first_notnull:0) < 5)) ? "pending" : "failed",
              available_at: now, locked_at: null, locked_by: null,
              last_error_code: $input.error_code, updated_at: now
              }
            } as $released_job
          }
        }
      }
    }
  }
  response = {ok: true, released: ($input.job_ids|count)}
  tags = ["sitecraft-auto-market", "seo", "internal", "queue"]
}
