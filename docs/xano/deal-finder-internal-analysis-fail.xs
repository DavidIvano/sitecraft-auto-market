query "deal-finder/internal/analyses/{id}/fail" verb=POST {
  api_group = "sitecraft-auto-market"
  input {
    int id filters=min:1
    text error_code filters=trim|max:64
  }
  stack {
    var $provided_secret { value = $env.$http_headers."X-Deal-Finder-Secret"|first_notnull:""|to_text }
    precondition (($provided_secret != "") && ($provided_secret == "__DEAL_FINDER_SECRET_RAW__")) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }
    precondition (($input.error_code == "OPENAI_TIMEOUT") || ($input.error_code == "OPENAI_RATE_LIMIT") || ($input.error_code == "OPENAI_AUTH_ERROR") || ($input.error_code == "OPENAI_INVALID_OUTPUT") || ($input.error_code == "OPENAI_UPSTREAM_ERROR") || ($input.error_code == "ANALYSIS_VALIDATION_ERROR") || ($input.error_code == "ANALYSIS_CONFIGURATION_ERROR") || ($input.error_code == "UNKNOWN_ANALYSIS_ERROR")) {
      error_type = "inputerror"
      error = "Invalid error code"
    }
    db.get deal_finder_analyses {
      field_name = "id"
      field_value = $input.id
    } as $analysis
    precondition (($analysis != null) && ($analysis.status == "processing")) {
      error_type = "inputerror"
      error = "Analysis is not processing"
    }
    db.edit deal_finder_analyses {
      field_name = "id"
      field_value = $analysis.id
      data = {updated_at: "now", status: "failed", analysis_status: "failed", failed_at: "now", error_code: $input.error_code, error_message: null, retry_count: $analysis.retry_count + 1}
    } as $failed
  }
  response = {analysis: {id: $failed.id, status: $failed.status}}
  tags = ["deal-finder", "internal", "worker", "analysis-fail"]
}
