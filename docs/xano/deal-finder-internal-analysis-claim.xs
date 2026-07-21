query "deal-finder/internal/analyses/{id}/claim" verb=POST {
  api_group = "sitecraft-auto-market"
  input {
    int id filters=min:1
  }
  stack {
    var $provided_secret { value = $env.$http_headers."X-Deal-Finder-Secret"|first_notnull:""|to_text }
    precondition (($provided_secret != "") && ($provided_secret == "__DEAL_FINDER_SECRET_RAW__")) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }
    db.transaction {
      stack {
        db.get deal_finder_analyses {
          field_name = "id"
          field_value = $input.id
          lock = true
        } as $analysis
        precondition (($analysis != null) && ($analysis.status == "pending")) {
          error_type = "inputerror"
          error = "Analysis is not pending"
        }
        db.edit deal_finder_analyses {
          field_name = "id"
          field_value = $analysis.id
          data = {updated_at: "now", status: "processing", analysis_status: "processing", started_at: "now"}
        } as $claimed
      }
    }
  }
  response = {analysis: {id: $claimed.id, listing_id: $claimed.listing_id, status: $claimed.status, analysis_version: $claimed.analysis_version, model: $claimed.model, input_hash: $claimed.input_hash, listing_content_hash: $claimed.listing_content_hash, input_snapshot: $claimed.input_snapshot}}
  tags = ["deal-finder", "internal", "worker", "analysis-claim"]
}
