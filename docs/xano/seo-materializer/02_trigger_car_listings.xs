table_trigger "seo_enqueue_car_listing_change" {
  table = "car_listings"
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
    var $listing_id { value = $row.id|to_int }
    var $event_key { value = "listing:" ~ $listing_id ~ ":" ~ ($row.updated_at|first_notnull:now|to_text) ~ ":" ~ $input.action }
    try_catch {
      try {
        db.add_or_edit seo_refresh_queue {
          field_name = "event_key"
          field_value = $event_key
          data = {
            event_key: $event_key,
            event_type: "listing_" ~ $input.action,
            car_listing_id: $listing_id,
            translation_version: $row.translation_version|first_notnull:0,
            status: "pending",
            attempts: 0,
            available_at: now,
            updated_at: now
          }
        } as $queued
      }
      catch {
        debug.log {
          value = {event: "seo_queue_enqueue_failed", source: "car_listings"}
        }
      }
    }
  }
  history = 10
  tags = ["sitecraft-auto-market", "seo", "queue"]
}
