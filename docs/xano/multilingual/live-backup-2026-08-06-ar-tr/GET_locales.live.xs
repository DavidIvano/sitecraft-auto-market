query locales verb=GET {
  api_group = "sitecraft-auto-market"

  input {
  }

  stack {
    db.query locales {
      where = ($db.locales.is_active)
      sort = {locales.sort_order: "asc"}
      return = {type: "list"}
    } as $locale_rows

    var $public_locales {
      value = []
    }

    foreach ($locale_rows) {
      each as $locale_row {
        conditional {
          if (($locale_row.code == "de") || ($locale_row.code == "ru") || ($locale_row.code == "uk") || ($locale_row.code == "en")) {
            array.push $public_locales {
              value = {
                code       : $locale_row.code
                name       : $locale_row.english_name|first_notnull:$locale_row.native_name
                native_name: $locale_row.native_name
                direction  : $locale_row.direction|first_notnull:"ltr"
              }
            }
          }
        }
      }
    }
  }

  response = {
    default_locale : "ru"
    fallback_locale: "de"
    items          : $public_locales
  }

  tags = ["sitecraft-auto-market", "public", "i18n", "locales"]
}