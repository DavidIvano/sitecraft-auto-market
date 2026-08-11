query "translations/internal/locales/prepare" verb=POST {
  api_group = "sitecraft-auto-market"
  input {
    text target_locale filters=trim|lower|max:35
    bool? dry_run?=true
  }
  stack {
    var $provided_secret { value = $env.$http_headers."X-Translation-Worker-Secret"|first_notnull:""|to_text }
    precondition (($provided_secret != "") && ($provided_secret == "__TRANSLATION_WORKER_SECRET_RAW__")) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }
    precondition (($input.target_locale == "fr") || ($input.target_locale == "tr") || ($input.target_locale == "ar")) {
      error_type = "inputerror"
      error = "Unsupported target locale"
    }
    db.query locales {
      where = $db.locales.code == $input.target_locale
      return = {type: "single"}
    } as $existing_locale
    var $locale { value = $existing_locale }
    var $outcome { value = "reused" }
    conditional {
      if ($existing_locale == null) {
        var.update $outcome { value = "would_create" }
        conditional {
          if ($input.dry_run != true) {
            conditional {
              if ($input.target_locale == "fr") {
                db.add locales {
                  data = {created_at: now, updated_at: now, code: "fr", base_language: "fr", native_name: "Français", english_name: "French", direction: "ltr", is_active: true, is_default: false, is_public: false, fallback_locale: "en", sort_order: 70}
                } as $locale
              }
              elseif ($input.target_locale == "tr") {
                db.add locales {
                  data = {created_at: now, updated_at: now, code: "tr", base_language: "tr", native_name: "Türkçe", english_name: "Turkish", direction: "ltr", is_active: true, is_default: false, is_public: false, fallback_locale: "en", sort_order: 60}
                } as $locale
              }
              else {
                db.add locales {
                  data = {created_at: now, updated_at: now, code: "ar", base_language: "ar", native_name: "العربية", english_name: "Arabic", direction: "rtl", is_active: true, is_default: false, is_public: false, fallback_locale: "en", sort_order: 50}
                } as $locale
              }
            }
            var.update $outcome { value = "created" }
          }
        }
      }
    }
  }
  response = {dry_run: $input.dry_run, outcome: $outcome, locale: {id: $locale.id, code: ($locale.code|first_notnull:$input.target_locale), direction: $locale.direction, is_active: $locale.is_active, is_public: $locale.is_public}}
  tags = ["translations", "internal", "worker", "locales", "idempotent"]
}
