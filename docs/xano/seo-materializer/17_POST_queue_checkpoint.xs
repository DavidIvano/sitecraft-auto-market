query "seo/internal/queue/checkpoint" verb=POST {
  api_group = "sitecraft-auto-market"
  input {
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
                status: "pending", attempts: 0, available_at: now,
                locked_at: null, locked_by: null, last_error_code: "MATERIALIZATION_CHECKPOINT",
                materialization_generation: $input.generation,
                materialization_cursor: $input.next_cursor,
                updated_at: now
              }
            } as $checkpointed_job
          }
        }
      }
    }
  }
  response = {ok: true, checkpointed: ($input.job_ids|count), generation: $input.generation, next_cursor: $input.next_cursor}
  tags = ["sitecraft-auto-market", "seo", "internal", "queue"]
}
