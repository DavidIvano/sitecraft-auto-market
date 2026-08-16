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
    precondition (($input.target_locale == "de") || ($input.target_locale == "fr") || ($input.target_locale == "tr") || ($input.target_locale == "ar") || ($input.target_locale == "nl") || ($input.target_locale == "da") || ($input.target_locale == "sv") || ($input.target_locale == "fi") || ($input.target_locale == "es") || ($input.target_locale == "pt") || ($input.target_locale == "it") || ($input.target_locale == "pl") || ($input.target_locale == "cs") || ($input.target_locale == "sk") || ($input.target_locale == "sl") || ($input.target_locale == "bg") || ($input.target_locale == "hr") || ($input.target_locale == "ro") || ($input.target_locale == "hu") || ($input.target_locale == "el") || ($input.target_locale == "et") || ($input.target_locale == "lv") || ($input.target_locale == "lt") || ($input.target_locale == "mt") || ($input.target_locale == "ga")) {
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
              if ($input.target_locale == "de") {
                db.add locales {
                  data = {created_at: now, updated_at: now, code: "de", base_language: "de", native_name: "Deutsch", english_name: "German", direction: "ltr", is_active: true, is_default: true, is_public: false, fallback_locale: null, sort_order: 10}
                } as $locale
              }
              elseif ($input.target_locale == "fr") {
                db.add locales {
                  data = {created_at: now, updated_at: now, code: "fr", base_language: "fr", native_name: "Français", english_name: "French", direction: "ltr", is_active: true, is_default: false, is_public: false, fallback_locale: "en", sort_order: 70}
                } as $locale
              }
              elseif ($input.target_locale == "tr") {
                db.add locales {
                  data = {created_at: now, updated_at: now, code: "tr", base_language: "tr", native_name: "Türkçe", english_name: "Turkish", direction: "ltr", is_active: true, is_default: false, is_public: false, fallback_locale: "en", sort_order: 60}
                } as $locale
              }
              elseif ($input.target_locale == "nl") {
                db.add locales {
                  data = {created_at: now, updated_at: now, code: "nl", base_language: "nl", native_name: "Nederlands", english_name: "Dutch", direction: "ltr", is_active: true, is_default: false, is_public: false, fallback_locale: "en", sort_order: 140}
                } as $locale
              }
              elseif ($input.target_locale == "da") {
                db.add locales {
                  data = {created_at: now, updated_at: now, code: "da", base_language: "da", native_name: "Dansk", english_name: "Danish", direction: "ltr", is_active: true, is_default: false, is_public: false, fallback_locale: "en", sort_order: 130}
                } as $locale
              }
              elseif ($input.target_locale == "sv") {
                db.add locales {
                  data = {created_at: now, updated_at: now, code: "sv", base_language: "sv", native_name: "Svenska", english_name: "Swedish", direction: "ltr", is_active: true, is_default: false, is_public: false, fallback_locale: "en", sort_order: 310}
                } as $locale
              }
              elseif ($input.target_locale == "fi") {
                db.add locales {
                  data = {created_at: now, updated_at: now, code: "fi", base_language: "fi", native_name: "Suomi", english_name: "Finnish", direction: "ltr", is_active: true, is_default: false, is_public: false, fallback_locale: "en", sort_order: 160}
                } as $locale
              }
              elseif ($input.target_locale == "es") {
                db.add locales {
                  data = {created_at: now, updated_at: now, code: "es", base_language: "es", native_name: "Español", english_name: "Spanish", direction: "ltr", is_active: true, is_default: false, is_public: false, fallback_locale: "en", sort_order: 300}
                } as $locale
              }
              elseif ($input.target_locale == "pt") {
                db.add locales {
                  data = {created_at: now, updated_at: now, code: "pt", base_language: "pt", native_name: "Português", english_name: "Portuguese", direction: "ltr", is_active: true, is_default: false, is_public: false, fallback_locale: "en", sort_order: 260}
                } as $locale
              }
              elseif ($input.target_locale == "it") {
                db.add locales {
                  data = {created_at: now, updated_at: now, code: "it", base_language: "it", native_name: "Italiano", english_name: "Italian", direction: "ltr", is_active: true, is_default: false, is_public: false, fallback_locale: "en", sort_order: 210}
                } as $locale
              }
              elseif ($input.target_locale == "pl") {
                db.add locales {
                  data = {created_at: now, updated_at: now, code: "pl", base_language: "pl", native_name: "Polski", english_name: "Polish", direction: "ltr", is_active: true, is_default: false, is_public: false, fallback_locale: "en", sort_order: 250}
                } as $locale
              }
              elseif ($input.target_locale == "cs") {
                db.add locales {
                  data = {created_at: now, updated_at: now, code: "cs", base_language: "cs", native_name: "Čeština", english_name: "Czech", direction: "ltr", is_active: true, is_default: false, is_public: false, fallback_locale: "en", sort_order: 120}
                } as $locale
              }
              elseif ($input.target_locale == "sk") {
                db.add locales {
                  data = {created_at: now, updated_at: now, code: "sk", base_language: "sk", native_name: "Slovenčina", english_name: "Slovak", direction: "ltr", is_active: true, is_default: false, is_public: false, fallback_locale: "en", sort_order: 280}
                } as $locale
              }
              elseif ($input.target_locale == "sl") {
                db.add locales {
                  data = {created_at: now, updated_at: now, code: "sl", base_language: "sl", native_name: "Slovenščina", english_name: "Slovenian", direction: "ltr", is_active: true, is_default: false, is_public: false, fallback_locale: "en", sort_order: 290}
                } as $locale
              }
              elseif ($input.target_locale == "bg") {
                db.add locales {
                  data = {created_at: now, updated_at: now, code: "bg", base_language: "bg", native_name: "Български", english_name: "Bulgarian", direction: "ltr", is_active: true, is_default: false, is_public: false, fallback_locale: "en", sort_order: 100}
                } as $locale
              }
              elseif ($input.target_locale == "hr") {
                db.add locales {
                  data = {created_at: now, updated_at: now, code: "hr", base_language: "hr", native_name: "Hrvatski", english_name: "Croatian", direction: "ltr", is_active: true, is_default: false, is_public: false, fallback_locale: "en", sort_order: 110}
                } as $locale
              }
              elseif ($input.target_locale == "ro") {
                db.add locales {
                  data = {created_at: now, updated_at: now, code: "ro", base_language: "ro", native_name: "Română", english_name: "Romanian", direction: "ltr", is_active: true, is_default: false, is_public: false, fallback_locale: "en", sort_order: 270}
                } as $locale
              }
              elseif ($input.target_locale == "hu") {
                db.add locales {
                  data = {created_at: now, updated_at: now, code: "hu", base_language: "hu", native_name: "Magyar", english_name: "Hungarian", direction: "ltr", is_active: true, is_default: false, is_public: false, fallback_locale: "en", sort_order: 190}
                } as $locale
              }
              elseif ($input.target_locale == "el") {
                db.add locales {
                  data = {created_at: now, updated_at: now, code: "el", base_language: "el", native_name: "Ελληνικά", english_name: "Greek", direction: "ltr", is_active: true, is_default: false, is_public: false, fallback_locale: "en", sort_order: 180}
                } as $locale
              }
              elseif ($input.target_locale == "et") {
                db.add locales {
                  data = {created_at: now, updated_at: now, code: "et", base_language: "et", native_name: "Eesti", english_name: "Estonian", direction: "ltr", is_active: true, is_default: false, is_public: false, fallback_locale: "en", sort_order: 150}
                } as $locale
              }
              elseif ($input.target_locale == "lv") {
                db.add locales {
                  data = {created_at: now, updated_at: now, code: "lv", base_language: "lv", native_name: "Latviešu", english_name: "Latvian", direction: "ltr", is_active: true, is_default: false, is_public: false, fallback_locale: "en", sort_order: 220}
                } as $locale
              }
              elseif ($input.target_locale == "lt") {
                db.add locales {
                  data = {created_at: now, updated_at: now, code: "lt", base_language: "lt", native_name: "Lietuvių", english_name: "Lithuanian", direction: "ltr", is_active: true, is_default: false, is_public: false, fallback_locale: "en", sort_order: 230}
                } as $locale
              }
              elseif ($input.target_locale == "mt") {
                db.add locales {
                  data = {created_at: now, updated_at: now, code: "mt", base_language: "mt", native_name: "Malti", english_name: "Maltese", direction: "ltr", is_active: true, is_default: false, is_public: false, fallback_locale: "en", sort_order: 240}
                } as $locale
              }
              elseif ($input.target_locale == "ga") {
                db.add locales {
                  data = {created_at: now, updated_at: now, code: "ga", base_language: "ga", native_name: "Gaeilge", english_name: "Irish", direction: "ltr", is_active: true, is_default: false, is_public: false, fallback_locale: "en", sort_order: 200}
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
