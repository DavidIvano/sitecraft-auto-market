export const DEAL_FINDER_NOTIFICATION_PREFERENCES_KEY = "sitecraft_deal_finder_notification_preferences";
export const DEAL_FINDER_NOTIFICATION_DELIVERIES_KEY = "sitecraft_deal_finder_notification_deliveries";
export const DEAL_FINDER_NOTIFICATION_DELIVERY_LIMIT = 100;

export type DealFinderNotificationFrequency = "instant" | "daily" | "weekly";
export type DealFinderNotificationEvent = "hot_deal" | "new_match" | "price_change" | "next_action";
export type DealFinderNotificationChannel = "email" | "web_push";

export type DealFinderNotificationPreferences = {
  email_enabled: boolean;
  web_push_enabled: boolean;
  frequency: DealFinderNotificationFrequency;
  quiet_hours_enabled: boolean;
  quiet_start: string;
  quiet_end: string;
  minimum_score: number;
  events: DealFinderNotificationEvent[];
  timezone: string;
  updated_at: string | null;
  storage: "device" | "server";
};

export type DealFinderNotificationDelivery = {
  dedupe_key: string;
  listing_id: number;
  event: DealFinderNotificationEvent;
  channel: DealFinderNotificationChannel;
  status: "preview" | "sent" | "suppressed" | "failed";
  created_at: string;
};

const frequencies = new Set<DealFinderNotificationFrequency>(["instant", "daily", "weekly"]);
const supportedEvents = new Set<DealFinderNotificationEvent>(["hot_deal", "new_match", "price_change", "next_action"]);
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function defaultNotificationPreferences(): DealFinderNotificationPreferences {
  return {
    email_enabled: false,
    web_push_enabled: false,
    frequency: "daily",
    quiet_hours_enabled: true,
    quiet_start: "22:00",
    quiet_end: "07:00",
    minimum_score: 75,
    events: ["hot_deal", "new_match", "price_change"],
    timezone: "Europe/Berlin",
    updated_at: null,
    storage: "device",
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function normalizeNotificationPreferences(value: unknown): DealFinderNotificationPreferences {
  const defaults = defaultNotificationPreferences();
  const record = asRecord(value);
  const score = Number(record.minimum_score);
  const events = Array.isArray(record.events)
    ? [...new Set(record.events.filter((event): event is DealFinderNotificationEvent => supportedEvents.has(event as DealFinderNotificationEvent)))]
    : defaults.events;
  return {
    email_enabled: typeof record.email_enabled === "boolean" ? record.email_enabled : defaults.email_enabled,
    web_push_enabled: typeof record.web_push_enabled === "boolean" ? record.web_push_enabled : defaults.web_push_enabled,
    frequency: frequencies.has(record.frequency as DealFinderNotificationFrequency) ? record.frequency as DealFinderNotificationFrequency : defaults.frequency,
    quiet_hours_enabled: typeof record.quiet_hours_enabled === "boolean" ? record.quiet_hours_enabled : defaults.quiet_hours_enabled,
    quiet_start: typeof record.quiet_start === "string" && timePattern.test(record.quiet_start) ? record.quiet_start : defaults.quiet_start,
    quiet_end: typeof record.quiet_end === "string" && timePattern.test(record.quiet_end) ? record.quiet_end : defaults.quiet_end,
    minimum_score: Number.isFinite(score) ? Math.min(100, Math.max(0, Math.round(score))) : defaults.minimum_score,
    events,
    timezone: typeof record.timezone === "string" && record.timezone.trim() ? record.timezone.trim().slice(0, 64) : defaults.timezone,
    updated_at: typeof record.updated_at === "string" && Number.isFinite(Date.parse(record.updated_at)) ? new Date(record.updated_at).toISOString() : null,
    storage: record.storage === "server" ? "server" : "device",
  };
}

export function readNotificationPreferences(storage: Pick<Storage, "getItem"> | null) {
  if (!storage) return defaultNotificationPreferences();
  try {
    return normalizeNotificationPreferences(JSON.parse(storage.getItem(DEAL_FINDER_NOTIFICATION_PREFERENCES_KEY) || "null"));
  } catch {
    return defaultNotificationPreferences();
  }
}

export function writeNotificationPreferences(
  storage: Pick<Storage, "setItem"> | null,
  value: DealFinderNotificationPreferences,
  now = new Date(),
) {
  const normalized = normalizeNotificationPreferences({ ...value, updated_at: now.toISOString(), storage: "device" });
  storage?.setItem(DEAL_FINDER_NOTIFICATION_PREFERENCES_KEY, JSON.stringify(normalized));
  return normalized;
}

function minutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function isInsideQuietHours(preferences: DealFinderNotificationPreferences, now = new Date()) {
  if (!preferences.quiet_hours_enabled) return false;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: preferences.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const current = Number(parts.find((part) => part.type === "hour")?.value || 0) * 60
    + Number(parts.find((part) => part.type === "minute")?.value || 0);
  const start = minutes(preferences.quiet_start);
  const end = minutes(preferences.quiet_end);
  if (start === end) return true;
  return start < end ? current >= start && current < end : current >= start || current < end;
}

export function notificationDedupeKey(input: {
  userId: number;
  listingId: number;
  event: DealFinderNotificationEvent;
  version?: string | number | null;
}) {
  const version = String(input.version ?? "initial").trim().slice(0, 80) || "initial";
  return `${input.userId}:${input.listingId}:${input.event}:${version}`;
}

export function readNotificationDeliveries(storage: Pick<Storage, "getItem"> | null) {
  if (!storage) return [];
  try {
    const value = JSON.parse(storage.getItem(DEAL_FINDER_NOTIFICATION_DELIVERIES_KEY) || "[]");
    return Array.isArray(value) ? value.filter((item) => item && typeof item.dedupe_key === "string").slice(0, DEAL_FINDER_NOTIFICATION_DELIVERY_LIMIT) as DealFinderNotificationDelivery[] : [];
  } catch {
    return [];
  }
}

export function registerNotificationDelivery(
  storage: Pick<Storage, "getItem" | "setItem"> | null,
  delivery: DealFinderNotificationDelivery,
) {
  const deliveries = readNotificationDeliveries(storage);
  if (deliveries.some((item) => item.dedupe_key === delivery.dedupe_key && item.channel === delivery.channel)) {
    return { accepted: false, deliveries };
  }
  const next = [delivery, ...deliveries].slice(0, DEAL_FINDER_NOTIFICATION_DELIVERY_LIMIT);
  storage?.setItem(DEAL_FINDER_NOTIFICATION_DELIVERIES_KEY, JSON.stringify(next));
  return { accepted: true, deliveries: next };
}

export function notificationSuppressionReason(input: {
  preferences: DealFinderNotificationPreferences;
  event: DealFinderNotificationEvent;
  channel: DealFinderNotificationChannel;
  dealScore?: number | null;
  now?: Date;
}) {
  const { preferences, event, channel } = input;
  if (channel === "email" && !preferences.email_enabled) return "channel_disabled";
  if (channel === "web_push" && !preferences.web_push_enabled) return "channel_disabled";
  if (!preferences.events.includes(event)) return "event_disabled";
  if (event !== "next_action" && Number(input.dealScore || 0) < preferences.minimum_score) return "below_score";
  if (isInsideQuietHours(preferences, input.now || new Date())) return "quiet_hours";
  return null;
}
