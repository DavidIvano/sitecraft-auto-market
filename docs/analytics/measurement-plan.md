# SiteCraft Stage 0 measurement plan

Статус: базовый контракт событий  
Дата: 19 июля 2026 года

## Принципы

- аналитика не должна блокировать пользовательское действие;
- не отправлять email, телефон, имя, полный поисковый запрос или описание;
- использовать случайный `session_id`, а не пользовательский ID;
- хранить не более 50 недоставленных событий в браузере;
- серверная доставка и срок хранения утверждаются перед Stage 1.

## Реализованные client events

| Событие | Когда | Свойства |
| --- | --- | --- |
| `access_state_shown` | Показано состояние доступа | `state` |
| `deal_finder_feed_loaded` | Лента успешно загружена | `page`, `result_count`, `count`, `sort` |
| `deal_finder_detail_loaded` | Открыта детальная страница | `listing_id`, `status` |
| `deal_finder_filter_applied` | Применены фильтры | `has_filters`, `sort` |
| `deal_finder_action_completed` | Рабочее действие успешно | `action`, `listing_id`, `status` |
| `deal_finder_action_failed` | Рабочее действие не выполнено | `action`, `listing_id`, `status` |
| `credits_loaded` | Баланс успешно прочитан | `count`, `wallet_type` |

## Privacy allowlist

Разрешены только: `action`, `count`, `has_filters`, `listing_id`, `page`, `result_count`, `sort`, `state`, `status`, `wallet_type`.

Любые другие свойства отбрасываются клиентом до постановки события в очередь.

## Базовые показатели Stage 0

- доля `sign_in_required` на защищённых страницах после ранее успешного входа;
- доля `role_required` для пользователей, которым должен быть разрешён Deal Finder;
- частота `temporarily_unavailable` и `rate_limited`;
- успешность действий сохранить, скрыть, восстановить и просмотрено;
- время от загрузки ленты до открытия детали;
- число повторных AI-запросов без изменения объявления;
- число несогласованных legacy-балансов.

## Следующий backend-шаг

До Stage 1 добавить защищённый batch endpoint `POST /analytics/product-events`, серверную валидацию allowlist, TTL и дедупликацию по `id`. После подтверждённой доставки локальное событие можно удалить.

