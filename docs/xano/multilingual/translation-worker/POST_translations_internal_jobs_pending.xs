query "translations/internal/jobs/pending" verb=POST {
  api_group = "sitecraft-auto-market"
  input {
    text target_locale filters=trim|lower|max:35
    int? limit?=2 filters=min:1|max:3
  }
  stack {
    var $provided_secret { value = $env.$http_headers."X-Translation-Worker-Secret"|first_notnull:""|to_text }
    precondition (($provided_secret != "") && ($provided_secret == "__TRANSLATION_WORKER_SECRET_RAW__")) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }
    precondition (($input.target_locale == "de") || ($input.target_locale == "en") || ($input.target_locale == "fr") || ($input.target_locale == "tr") || ($input.target_locale == "ar") || ($input.target_locale == "uk") || ($input.target_locale == "nl") || ($input.target_locale == "da") || ($input.target_locale == "sv") || ($input.target_locale == "fi") || ($input.target_locale == "es") || ($input.target_locale == "pt") || ($input.target_locale == "it") || ($input.target_locale == "pl") || ($input.target_locale == "cs") || ($input.target_locale == "sk") || ($input.target_locale == "sl") || ($input.target_locale == "bg") || ($input.target_locale == "hr") || ($input.target_locale == "ro") || ($input.target_locale == "hu") || ($input.target_locale == "el") || ($input.target_locale == "et") || ($input.target_locale == "lv") || ($input.target_locale == "lt") || ($input.target_locale == "mt") || ($input.target_locale == "ga")) {
      error_type = "inputerror"
      error = "Unsupported target locale"
    }
    db.query translation_jobs {
      where = (($db.translation_jobs.entity_type == "car_listing") && ($db.translation_jobs.target_locale == $input.target_locale) && (($db.translation_jobs.status == "pending") || ($db.translation_jobs.status == "queued") || ($db.translation_jobs.status == "failed")) && ($db.translation_jobs.attempt_count < $db.translation_jobs.max_attempts))
      sort = {translation_jobs.priority: "desc", translation_jobs.created_at: "asc"}
      return = {type: "list", paging: {page: 1, per_page: $input.limit}}
    } as $pending_jobs
    var $safe_jobs { value = [] }
    foreach ($pending_jobs.items) {
      each as $job {
        array.push $safe_jobs { value = {id: $job.id, entity_id: $job.entity_id, source_locale: $job.source_locale, target_locale: $job.target_locale, source_hash: $job.source_hash, status: $job.status, attempt_count: ($job.attempt_count|first_notnull:0), max_attempts: ($job.max_attempts|first_notnull:3)} }
      }
    }
  }
  response = {count: ($safe_jobs|count), jobs: $safe_jobs}
  tags = ["translations", "internal", "worker", "queue"]
}
