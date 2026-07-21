import { getOrCreateSessionId } from "./session";

export type ProductEventName =
  | "access_state_shown"
  | "deal_finder_feed_loaded"
  | "deal_finder_detail_loaded"
  | "deal_finder_filter_applied"
  | "deal_finder_action_completed"
  | "deal_finder_action_failed"
  | "deal_finder_comparison_opened"
  | "deal_finder_notification_preferences_saved"
  | "buyer_search_started"
  | "buyer_search_completed"
  | "buyer_search_clarification_shown"
  | "buyer_search_filter_changed"
  | "buyer_search_zero_results"
  | "buyer_search_relaxation_applied"
  | "buyer_search_saved"
  | "credits_loaded";

export type ProductEvent = {
  id: string;
  name: ProductEventName;
  session_id: string;
  path: string;
  occurred_at: string;
  properties: Record<string, string | number | boolean>;
};

const EVENT_QUEUE_KEY = "sitecraft_product_event_queue";
const MAX_QUEUED_EVENTS = 50;
const ALLOWED_PROPERTY_KEYS = new Set([
  "action",
  "count",
  "criteria_count",
  "has_filters",
  "listing_id",
  "page",
  "result_count",
  "sort",
  "source",
  "state",
  "status",
  "frequency",
  "channel_email_enabled",
  "channel_push_enabled",
  "wallet_type",
]);

function createEventId() {
  return typeof window.crypto?.randomUUID === "function"
    ? window.crypto.randomUUID()
    : `event_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeProperties(properties: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(properties).flatMap(([key, value]) => {
      if (!ALLOWED_PROPERTY_KEYS.has(key)) return [];
      if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return [];
      return [[key, typeof value === "string" ? value.slice(0, 80) : value]];
    }),
  ) as Record<string, string | number | boolean>;
}

function enqueueEvent(event: ProductEvent) {
  try {
    const existing = JSON.parse(window.localStorage.getItem(EVENT_QUEUE_KEY) || "[]");
    const queue = Array.isArray(existing) ? existing : [];
    window.localStorage.setItem(EVENT_QUEUE_KEY, JSON.stringify([...queue, event].slice(-MAX_QUEUED_EVENTS)));
  } catch {
    // Analytics must never interrupt a product action.
  }
}

export function trackProductEvent(
  name: ProductEventName,
  properties: Record<string, unknown> = {},
): ProductEvent | null {
  if (typeof window === "undefined") return null;

  const event: ProductEvent = {
    id: createEventId(),
    name,
    session_id: getOrCreateSessionId(),
    path: window.location.pathname,
    occurred_at: new Date().toISOString(),
    properties: sanitizeProperties(properties),
  };

  enqueueEvent(event);
  window.dispatchEvent(new CustomEvent("sitecraft:product-event", { detail: event }));

  const target = window as typeof window & { dataLayer?: Array<Record<string, unknown>> };
  target.dataLayer?.push({ event: name, ...event.properties });
  return event;
}

export function readQueuedProductEvents(): ProductEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(EVENT_QUEUE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
