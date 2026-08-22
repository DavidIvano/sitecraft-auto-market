table_trigger "seo_enqueue_translation_change" {
  table = "car_listing_translations"
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
    var $event_key { value = "translation:" ~ ($row.id|to_int) ~ ":" ~ ($row.updated_at|first_notnull:now|to_text) ~ ":" ~ $input.action }
    try_catch {
      try {
        db.add_or_edit seo_refresh_queue {
          field_name = "event_key"
          field_value = $event_key
          data = {
            event_key: $event_key,
            event_type: "translation_" ~ $input.action,
            car_listing_id: $row.car_listing_id|to_int,
            locale_code: $row.locale_code|first_notnull:""|trim|to_lower,
            status: "pending",
            attempts: 0,
            available_at: now,
            updated_at: now
          }
        } as $queued
      }
      catch {
        debug.log {
          value = {event: "seo_queue_enqueue_failed", source: "car_listing_translations"}
        }
      }
    }
  }
  history = 10
  tags = ["sitecraft-auto-market", "seo", "queue"]
}
