# Xano Scripts

Copy these scripts into Xano separately: tables go to the database/table XanoScript area, and each API block goes into its own API endpoint XanoScript editor.

## Table: car_listings

```xanoscript
table car_listings {
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now

    text slug filters=trim|lower
    text title filters=trim
    text brand filters=trim
    text model filters=trim
    int year
    int mileage
    text fuel_type filters=trim
    text transmission filters=trim
    decimal price
    text currency?=EUR filters=trim|upper
    text city filters=trim
    text country?=Германия filters=trim
    text description filters=trim

    enum status {
      values = ["draft", "pending_review", "approved", "rejected", "archived", "sold"]
    }

    text main_image_url?
  }

  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree|unique", field: [{name: "slug", op: "asc"}]}
    {type: "btree", field: [{name: "status", op: "asc"}]}
    {type: "btree", field: [{name: "created_at", op: "desc"}]}
  ]

  tags = ["sitecraft-auto-market"]
}
```

## Table: car_listing_images

```xanoscript
table car_listing_images {
  schema {
    int id
    timestamp created_at?=now

    int car_listing_id {
      table = "car_listings"
    }

    image image
    text image_url
    int sort_order?=0
    bool is_main?=false
  }

  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "car_listing_id", op: "asc"}]}
    {type: "btree", field: [{name: "sort_order", op: "asc"}]}
  ]

  tags = ["sitecraft-auto-market"]
}
```

## API: GET /cars

```xanoscript
query cars verb=GET {
  input {
  }

  stack {
    db.query car_listings {
      where = $db.car_listings.status == "approved"
      sort = {car_listings.created_at: "desc"}
      return = {type: "list"}
    } as $cars
  }

  response = $cars

  tags = ["sitecraft-auto-market"]
}
```

## API: GET /cars/{slug}

```xanoscript
query cars/{slug} verb=GET {
  input {
    text slug filters=trim|lower
  }

  stack {
    db.get car_listings {
      field_name = "slug"
      field_value = $input.slug
    } as $car

    precondition ($car != null && $car.status == "approved") {
      error_type = "notfound"
      error = "Car listing not found"
    }

    db.query car_listing_images {
      where = $db.car_listing_images.car_listing_id == $car.id
      sort = {car_listing_images.sort_order: "asc"}
      return = {type: "list"}
    } as $images

    var $model {
      value = $car|set:"images":$images
    }
  }

  response = $model

  tags = ["sitecraft-auto-market"]
}
```

## API: POST /cars

This endpoint creates a draft listing and stores images in Xano File Storage.

If `image[] images?` is not accepted by XanoScript, add it manually in the endpoint input editor:

```txt
Name: images
Type: Storage -> File Resource
Structure: List
Optional: yes
```

```xanoscript
query cars verb=POST {
  input {
    text title filters=trim
    text brand filters=trim
    text model filters=trim
    int year
    int mileage
    text fuel_type filters=trim
    text transmission filters=trim
    decimal price
    text currency?=EUR filters=trim|upper
    text city filters=trim
    text country?=Германия filters=trim
    text description filters=trim
    text status?=draft
    image[] images?
  }

  stack {
    var $timestamp {
      value = now|format_timestamp:"U"
    }

    var $slug {
      value = $input.title|lower|replace:" ":"-"|concat:$timestamp:"-"
    }

    db.add car_listings {
      data = {
        created_at     : "now"
        updated_at     : "now"
        slug           : $slug
        title          : $input.title
        brand          : $input.brand
        model          : $input.model
        year           : $input.year
        mileage        : $input.mileage
        fuel_type      : $input.fuel_type
        transmission   : $input.transmission
        price          : $input.price
        currency       : $input.currency
        city           : $input.city
        country        : $input.country
        description    : $input.description
        status         : "draft"
        main_image_url : null
      }
    } as $car

    var $sort_order {
      value = 0
    }

    conditional {
      if ($input.images != null) {
        foreach ($input.images) {
          each as $image_file {
            var $filename {
              value = "car"|concat:$car.id:"_"|concat:$sort_order:"_"|concat:"image.jpg":"_"
            }

            storage.create_image {
              access = "public"
              value = $image_file
              filename = $filename
            } as $image_metadata

            db.add car_listing_images {
              data = {
                created_at     : "now"
                car_listing_id : $car.id
                image          : $image_metadata
                image_url      : $image_metadata.url
                sort_order     : $sort_order
                is_main        : $sort_order == 0
              }
            } as $image_row

            conditional {
              if ($sort_order == 0) {
                db.edit car_listings {
                  field_name = "id"
                  field_value = $car.id
                  data = {
                    updated_at     : "now"
                    main_image_url : $image_metadata.url
                  }
                } as $car
              }
            }

            var.update $sort_order {
              value = $sort_order + 1
            }
          }
        }
      }
    }

    db.query car_listing_images {
      where = $db.car_listing_images.car_listing_id == $car.id
      sort = {car_listing_images.sort_order: "asc"}
      return = {type: "list"}
    } as $images

    var $model {
      value = $car|set:"images":$images
    }
  }

  response = $model

  tags = ["sitecraft-auto-market"]
}
```

## API: PATCH /cars/{id}/submit

```xanoscript
query cars/{id}/submit verb=PATCH {
  input {
    int id filters=min:1
  }

  stack {
    db.get car_listings {
      field_name = "id"
      field_value = $input.id
    } as $car

    precondition ($car != null) {
      error_type = "notfound"
      error = "Car listing not found"
    }

    db.edit car_listings {
      field_name = "id"
      field_value = $input.id
      data = {
        updated_at : "now"
        status     : "pending_review"
      }
    } as $car
  }

  response = $car

  tags = ["sitecraft-auto-market"]
}
```

## API: GET /admin/moderation

```xanoscript
query admin/moderation verb=GET {
  input {
  }

  stack {
    db.query car_listings {
      where = $db.car_listings.status == "pending_review"
      sort = {car_listings.created_at: "asc"}
      return = {type: "list"}
    } as $cars
  }

  response = $cars

  tags = ["sitecraft-auto-market"]
}
```

## API: PATCH /admin/cars/{id}/approve

```xanoscript
query admin/cars/{id}/approve verb=PATCH {
  input {
    int id filters=min:1
  }

  stack {
    db.edit car_listings {
      field_name = "id"
      field_value = $input.id
      data = {
        updated_at : "now"
        status     : "approved"
      }
    } as $car
  }

  response = $car

  tags = ["sitecraft-auto-market"]
}
```

## API: PATCH /admin/cars/{id}/reject

```xanoscript
query admin/cars/{id}/reject verb=PATCH {
  input {
    int id filters=min:1
    text reason? filters=trim
  }

  stack {
    db.edit car_listings {
      field_name = "id"
      field_value = $input.id
      data = {
        updated_at : "now"
        status     : "rejected"
      }
    } as $car
  }

  response = $car

  tags = ["sitecraft-auto-market"]
}
```
