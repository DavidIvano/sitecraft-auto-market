# Xano patch for Cloudflare R2 image URLs

Цель: Xano остаётся базой объявлений и модерации, но больше не хранит новые изображения как File Storage.

## Текущие подходящие поля

`car_listings`:

```txt
main_image_url text
```

`car_listing_images`:

```txt
image json
image_url text
sort_order integer
is_main boolean
is_deleted boolean
```

Новые поля не обязательны. R2 key можно хранить в `car_listing_images.image`:

```json
{
  "url": "https://images.sitecraft-auto-market.com/cars/temp/.../photo.webp",
  "key": "cars/temp/.../photo.webp",
  "provider": "cloudflare_r2",
  "contentType": "image/webp",
  "size": 456123
}
```

Если хочешь отдельное поле для удобной очистки R2, добавь в `car_listing_images`:

```txt
image_key text optional
```

## POST /cars

Оставь существующие поля объявления как есть. Добавь optional text inputs:

```txt
main_image_url text optional
cover_image_url text optional
image_urls text optional
image_keys text optional
r2_images text optional
```

Frontend отправляет `image_urls`, `image_keys`, `r2_images` как JSON-строки.

После создания `$car` и генерации slug добавь логику:

```txt
var $r2_images {
  value = []
}

conditional {
  if ($input.r2_images != null && $input.r2_images != "") {
    var.update $r2_images {
      value = $input.r2_images|json_decode
    }
  }
}

var $sort_order {
  value = 0
}

foreach ($r2_images) {
  db.add car_listing_images {
    data = {
      created_at     : "now"
      updated_at     : "now"
      car_listing_id : $car.id
      image          : {
        url         : $item.url
        key         : $item.key
        provider    : "cloudflare_r2"
        contentType : $item.contentType
        size        : $item.size
      }
      image_url      : $item.url
      sort_order     : $sort_order
      is_main        : $sort_order == 0
      is_deleted     : false
    }
  } as $image_row

  conditional {
    if ($sort_order == 0) {
      db.edit car_listings {
        field_name = "id"
        field_value = $car.id
        data = {
          main_image_url : $item.url
          updated_at     : "now"
        }
      } as $car_main_image_updated
    }
  }

  var.update $sort_order {
    value = $sort_order + 1
  }
}
```

Важно: старую file-логику `photos/photo_1...` можно временно оставить для совместимости, но новые объявления с сайта больше не отправляют file-поля.

## PATCH /dashboard/listings/{id}

Оставь существующие поля как есть. Добавь optional text inputs:

```txt
new_image_urls text optional
new_image_keys text optional
image_urls text optional
image_keys text optional
r2_images text optional
```

В месте, где раньше endpoint проходил по `$input.photos`, добавь аналогичный проход по `$input.r2_images|json_decode`.

Логика:

1. Если `replace_photos == true`, soft-delete старые строки `car_listing_images`.
2. Если есть `delete_image_ids`, soft-delete выбранные строки.
3. Если есть `r2_images`, добавить новые строки в `car_listing_images`.
4. Пересчитать `sort_order`.
5. Первый активный image row сделать `is_main = true`.
6. `car_listings.main_image_url` обновить URL первого активного image row.

## GET endpoints

`GET /cars` и `GET /cars/{slug}` можно оставить как есть, если они уже возвращают:

```txt
main_image_url
images[]
images[].image_url
```

Frontend уже умеет читать:

1. `cover_image_url`
2. `main_image_url`
3. `image_urls`
4. `images[].image_url`
5. `images[].image.url`

## Moderation

Статусы не менять:

```txt
draft -> pending_review -> approved
```

Публичные endpoint должны по-прежнему возвращать только approved объявления.
