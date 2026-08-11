query "translations/internal/jobs/{id}/fail" verb=POST {
  api_group = "sitecraft-auto-market"
  input {
    int id filters=min:1
    text error_code filters=trim|upper|max:64
  }
  stack {
    var $provided_secret { value = $env.$http_headers."X-Translation-Worker-Secret"|first_notnull:""|to_text }
    precondition (($provided_secret != "") && ($provided_secret == "__TRANSLATION_WORKER_SECRET_RAW__")) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }
    db.get translation_jobs {
      field_name = "id"
      field_value = $input.id
    } as $job
    precondition ($job != null) {
      error_type = "notfound"
      error = "Translation job not found"
    }
    var $result_job { value = $job }
    conditional {
      if ($job.status == "processing") {
        db.edit translation_jobs {
          field_name = "id"
          field_value = $job.id
          data = {updated_at: now, status: "failed", last_error: $input.error_code, locked_at: null, locked_by: null, completed_at: null}
        } as $result_job
      }
    }
  }
  response = {job: {id: $result_job.id, status: $result_job.status, attempt_count: ($result_job.attempt_count|first_notnull:0), max_attempts: ($result_job.max_attempts|first_notnull:3), last_error: $result_job.last_error}}
  tags = ["translations", "internal", "worker", "fail", "retry"]
}
