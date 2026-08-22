table_trigger "seo_enqueue_locale_change" {
  table = "locales"
  actions = {insert: true, update: true, delete: true, truncate: false}
  active = true
  input {
    json new
    json old
    enum action { values = ["insert", "update", "delete", "truncate"] }
    text datasource
  }
  stack {
    var $row { value = $input.new|first_notnull:$input.old }
    var $event_key { value = "locale:" ~ ($row.code|first_notnull:"unknown"|trim|to_lower) ~ ":" ~ ($row.updated_at|first_notnull:now|to_text) ~ ":" ~ $input.action }
    try_catch {
      try {
        db.add_or_edit seo_refresh_queue {
          field_name = "event_key"
          field_value = $event_key
          data = {
            event_key: $event_key,
            event_type: "locale_" ~ $input.action,
            locale_code: $row.code|first_notnull:""|trim|to_lower,
            status: "pending",
            attempts: 0,
            available_at: now,
            updated_at: now
          }
        } as $queued
      }
      catch {
        debug.log {
          value = {event: "seo_queue_enqueue_failed", source: "locales"}
        }
      }
    }
  }
  history = 10
  tags = ["sitecraft-auto-market", "seo", "queue"]
}
