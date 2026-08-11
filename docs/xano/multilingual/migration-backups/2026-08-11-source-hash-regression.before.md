# Xano source-hash regression: rollback note

Дата: 11 августа 2026 года. Branch: `v1`.

Перед исправлением сохранены идентификаторы и SHA-256 полного XanoScript:

- endpoint `3982675`, `POST /listings/submit-moderation`: `8b4152d41592af1c1b55f1c723e90948ef317268a16d4941585441b2f04403d9`;
- endpoint `3969714`, `PATCH /dashboard/listings/{id}`: `8ce21528e8e974fba93e15d6b2e36e7d0dfc9be03a96cceb76b74fd0b3a586a1`.

Изменяются только операции нормализации двух переводимых полей и текстовый формат SHA-256. Все auth, owner scope, поля, статусы и очереди остаются без изменений.

## До исправления

```xanoscript
title       : $value|regex_replace:"\\r\\n?":"\n"|trim
description : $value|regex_replace:"\\r\\n?":"\n"|trim
```

В `3969714` дополнительно было:

```xanoscript
value = $translation_source_document|json_encode|sha256:true
```

Фильтр `regex_replace` в Xano принимает regex слева, затем replacement и subject. Старый порядок хешировал пустые title/description. `sha256:true` возвращает raw binary и не подходит для текстовых hash-полей.

## После исправления

```xanoscript
title       : ("/\\r\\n?/"|regex_replace:"\n":$value)|trim
description : ("/\\r\\n?/"|regex_replace:"\n":$value)|trim
value       = $translation_source_document|json_encode|sha256:false
```

Для rollback заменить только эти выражения обратно и опубликовать endpoint с `publish=true`. Полный live endpoint перед изменением также можно восстановить по Xano history для указанных endpoint IDs.

После публикации проверены полные SHA-256:

- endpoint `3982675`: `a019ac66da7ef4b7e253fb92f0c4b4b4a4d1633dc89322fe099b3a4c2ff5bf11`;
- endpoint `3969714`: `a1af924e74d8552931d2e778881c1f43cf59c3277425148e7d14808711b1cdb3`.
