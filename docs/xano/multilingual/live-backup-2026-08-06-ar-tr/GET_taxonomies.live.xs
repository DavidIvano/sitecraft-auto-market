query taxonomies verb=GET {
  api_group = "sitecraft-auto-market"

  input {
    text lang?=ru filters=trim|lower
  }

  stack {
    precondition (($input.lang == "de") || ($input.lang == "ru") || ($input.lang == "uk") || ($input.lang == "en")) {
      error_type = "inputerror"
      error = "Unsupported locale"
    }

    db.query taxonomy_translations {
      where = (($db.taxonomy_translations.locale_code == $input.lang) && ($db.taxonomy_translations.is_active != false))
      sort = {
        taxonomy_translations.taxonomy  : "asc"
        taxonomy_translations.sort_order: "asc"
      }

      return = {type: "list"}
    } as $translation_rows

    var $public_taxonomies {
      value = []
    }

    foreach ($translation_rows) {
      each as $translation_row {
        array.push $public_taxonomies {
          value = {
            taxonomy   : $translation_row.taxonomy
            code       : $translation_row.value_code
            locale     : $translation_row.locale_code
            label      : $translation_row.label
            short_label: $translation_row.short_label
            description: $translation_row.description
            sort_order : $translation_row.sort_order|first_notnull:0
          }
        }
      }
    }
  }

  response = {locale: $input.lang, items: $public_taxonomies}
  tags = ["sitecraft-auto-market", "public", "i18n", "taxonomies"]
}