query "deal-finder/internal/analyses/{id}/complete" verb=POST {
  api_group = "sitecraft-auto-market"
  input {
    int id filters=min:1
    text model filters=trim|max:100
    text? provider_response_id filters=trim|max:255
    int deal_score filters=min:0|max:100
    int risk_score filters=min:0|max:100
    int liquidity_score filters=min:0|max:100
    int data_quality_score filters=min:0|max:100
    decimal confidence_score filters=min:0|max:1
    json positive_signals
    json negative_signals
    json missing_information
    json known_defects
    json recommended_questions
    text recommendation filters=trim|max:32
    text ai_summary filters=trim|max:2000
    json usage
  }
  stack {
    var $provided_secret { value = $env.$http_headers."X-Deal-Finder-Secret"|first_notnull:""|to_text }
    precondition (($provided_secret != "") && ($provided_secret == "__DEAL_FINDER_SECRET_RAW__")) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }
    precondition (($input.recommendation == "HOT_DEAL") || ($input.recommendation == "CONTACT_NOW") || ($input.recommendation == "REVIEW") || ($input.recommendation == "WATCH") || ($input.recommendation == "SKIP") || ($input.recommendation == "INSUFFICIENT_DATA")) {
      error_type = "inputerror"
      error = "Invalid recommendation"
    }
    precondition ((($input.positive_signals|count) <= 20) && (($input.negative_signals|count) <= 20) && (($input.missing_information|count) <= 20) && (($input.known_defects|count) <= 20) && (($input.recommended_questions|count) <= 20)) {
      error_type = "inputerror"
      error = "Invalid analysis arrays"
    }
    precondition (($input.ai_summary|contains:"<") != true) {
      error_type = "inputerror"
      error = "Invalid summary"
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
      data = {
        updated_at: "now", status: "completed", analysis_status: "completed", model: $input.model,
        model_used: $input.model, provider_response_id: $input.provider_response_id,
        deal_score: $input.deal_score, risk_score: $input.risk_score, liquidity_score: $input.liquidity_score,
        data_quality_score: $input.data_quality_score, confidence_score: ($input.confidence_score|min:0.7),
        positive_signals: $input.positive_signals, negative_signals: $input.negative_signals,
        missing_information: $input.missing_information, known_defects: $input.known_defects,
        recommended_questions: $input.recommended_questions, recommendation: $input.recommendation,
        ai_summary: $input.ai_summary, input_tokens: ($input.usage|get:"input_tokens":0),
        output_tokens: ($input.usage|get:"output_tokens":0), total_tokens: ($input.usage|get:"total_tokens":0),
        estimated_cost: null, completed_at: "now", analyzed_at: "now", failed_at: null,
        error_code: null, error_message: null
      }
    } as $completed
  }
  response = {analysis: {id: $completed.id, status: $completed.status}}
  tags = ["deal-finder", "internal", "worker", "analysis-complete"]
}
