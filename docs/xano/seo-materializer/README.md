# Production SEO materializer

Источник истины для очереди и XanoScript production materializer.

Поток данных:

1. approve/edit/sold/block/delete или готовый перевод создаёт идемпотентное событие в `seo_refresh_queue`;
2. Cloudflare Worker забирает очередь и получает privacy-minimized snapshot;
3. quality gate проверяет текст, идентичность автомобиля, цену, местоположение и безопасную HTTPS-фотографию;
4. Worker требует одинаковый набор публичных объявлений во всех 28 локалях;
5. facets, listing index, edges, stats, related links и sitemap manifests записываются в новую immutable generation;
6. Xano сверяет точные количества и одной транзакцией меняет 28 active manifest rows;
7. public catalog, taxonomy и sitemap читают только generation из active manifest pointer.

Такой pointer не требует массового обновления `is_active` во всех таблицах и не смешивает две генерации. Compatibility fallback в production frontend выключен.

`public-generation-pointer/` содержит точные production-версии публичных Xano contracts. Секрет materializer подставляется только в игнорируемую `.xano-live/` перед точечным Xano CLI push и никогда не хранится здесь.

`17_POST_queue_checkpoint.xs` разбивает большую immutable generation на фазы максимум по 36 batch-запросов. Cursor сохраняется в `seo_refresh_queue`, поэтому следующий Worker-вызов продолжает ту же deterministic generation и не превышает Cloudflare external-subrequest limit. Активация разрешена только финальной фазе после exact-count и 28-locale parity gate.
