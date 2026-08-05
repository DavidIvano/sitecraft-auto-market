// Вставляется в публичные GET /cars, GET /cars/{slug}, seller-listings и related.
// Переменная объявления в текущей итерации должна называться $car.

input {
  text lang?="ru" filters=trim|lower
}

precondition (($input.lang == "de") || ($input.lang == "ru") || ($input.lang == "uk") || ($input.lang == "en")) {
  error_type = "inputerror"
  error = "Unsupported locale"
}

var $source_locale {
  value = $car.source_locale|first_notnull:"ru"|trim|lower
}

// Хеш рассчитывает миграционный worker и сохраняет в car_listings.
// Resolver не должен применять перевод, если исходный хеш ещё не подготовлен.
var $source_hash { value = $car.translation_source_hash|first_notnull:"" }
var $translation { value = null }

conditional {
  if ($input.lang != $source_locale) {
    db.query car_listing_translations {
      where = (($db.car_listing_translations.car_listing_id == $car.id)
        && ($db.car_listing_translations.locale_code == $input.lang)
        && ($db.car_listing_translations.source_locale == $source_locale)
        && ($db.car_listing_translations.source_hash == $source_hash)
        && ($db.car_listing_translations.translation_status == "completed"))
      sort = {car_listing_translations.updated_at: "desc"}
      return = {type: "single"}
    } as $translation_row

    conditional {
      if ($translation_row != null) {
        var.update $translation {
          value = {
            id           : $translation_row.id
            locale       : $translation_row.locale_code
            source_locale: $translation_row.source_locale
            source_hash  : $translation_row.source_hash
            status       : $translation_row.translation_status
            updated_at   : $translation_row.updated_at
            content      : {
              title             : $translation_row.title
              description       : $translation_row.description
              seo_title         : $translation_row.seo_title
              seo_description   : $translation_row.seo_description
              image_alt_texts   : $translation_row.image_alt_texts
              search_keywords   : $translation_row.search_keywords
            }
          }
        }
      }
    }
  }
}

// Добавить в публичный DTO, не заменяя оригинальные поля:
// source_locale: $source_locale
// translation  : $translation
