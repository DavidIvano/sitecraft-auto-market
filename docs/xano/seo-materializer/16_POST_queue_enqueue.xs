query "seo/internal/queue/enqueue" verb=POST {
  api_group = "sitecraft-auto-market"
  input {
    text event_key filters=trim|min:8|max:255
    text? event_type?=manual_rebuild filters=trim|lower|max:80
    int? car_listing_id? filters=min:1
    text? locale_code? filters=trim|lower|max:35
  }
  stack {
    var $provided_secret {
      value = $env.$http_headers."X-Seo-Materializer-Secret"|first_notnull:""|to_text
    }
    precondition (($provided_secret != "") && ($provided_secret == "__SEO_MATERIALIZER_SECRET__")) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }
    db.add_or_edit seo_refresh_queue {
      field_name = "event_key"
      field_value = $input.event_key
      data = {
        event_key: $input.event_key
        event_type: $input.event_type
        car_listing_id: $input.car_listing_id
        locale_code: $input.locale_code
        status: "pending"
        attempts: 0
        available_at: now
        locked_at: null
        locked_by: null
        last_error_code: null
        materialization_generation: null
        materialization_cursor: 0
        updated_at: now
      }
    } as $job
  }
  response = {job: {id: $job.id, event_key: $job.event_key, status: $job.status}}
  tags = ["sitecraft-auto-market", "seo", "internal", "queue", "idempotent"]
}
