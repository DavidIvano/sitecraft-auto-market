query "deal-finder/internal/analyses/pending" verb=GET {
  api_group = "sitecraft-auto-market"
  input {
    int limit?=1 filters=min:1|max:5
  }
  stack {
    var $provided_secret { value = $env.$http_headers."X-Deal-Finder-Secret"|first_notnull:""|to_text }
    precondition (($provided_secret != "") && ($provided_secret == "__DEAL_FINDER_SECRET_RAW__")) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }
    db.query deal_finder_analyses {
      where = ($db.deal_finder_analyses.status == "pending")
      sort = {deal_finder_analyses.created_at: "asc"}
      return = {type: "list", paging: {page: 1, per_page: $input.limit}}
    } as $jobs
    var $safe_jobs { value = [] }
    foreach ($jobs.items) {
      each as $job {
        db.query deal_finder_listings {
          where = (($db.deal_finder_listings.id == $job.listing_id) && ($db.deal_finder_listings.user_id == $job.user_id))
          return = {type: "single"}
        } as $listing
        conditional {
          if ($listing != null) {
            array.push $safe_jobs { value = {id: $job.id, listing_id: $job.listing_id, status: $job.status, analysis_version: $job.analysis_version, model: $job.model, input_hash: $job.input_hash, listing_content_hash: $job.listing_content_hash, input_snapshot: $job.input_snapshot} }
          }
        }
      }
    }
  }
  response = {data: $safe_jobs}
  tags = ["deal-finder", "internal", "worker", "analysis-queue"]
}
