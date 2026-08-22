query "seo/internal/queue/checkpoint" verb=POST {
  api_group = "sitecraft-auto-market"
  input {
    text worker_id filters=trim|min:8|max:120
    int[] job_ids
    text generation filters=trim|min:8|max:80
    int next_cursor filters=min:1
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
            status: "pending", attempts: 0, available_at: now,
            locked_at: null, locked_by: null, last_error_code: "MATERIALIZATION_CHECKPOINT",
            materialization_generation: $input.generation,
            materialization_cursor: $input.next_cursor,
            updated_at: now
          }
        }
      }
    }
  }
  response = {ok: true, checkpointed: ($worker_jobs.items|count), generation: $input.generation, next_cursor: $input.next_cursor}
  tags = ["sitecraft-auto-market", "seo", "internal", "queue"]
}
