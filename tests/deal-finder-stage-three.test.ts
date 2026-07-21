import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildComparisonRows,
  normalizeComparisonIds,
  readComparisonIds,
  toggleComparisonId,
} from "../src/lib/deal-finder/comparison.ts";
import {
  defaultNotificationPreferences,
  isInsideQuietHours,
  notificationDedupeKey,
  notificationSuppressionReason,
  registerNotificationDelivery,
} from "../src/lib/deal-finder/notifications.ts";
import { dealFinderMockListings } from "../src/lib/deal-finder/mock-data.ts";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

test("comparison keeps unique positive ids and never accepts a fifth car", () => {
  assert.deepEqual(normalizeComparisonIds([1, "2", 2, -4, 0, 3, 4, 5]), [1, 2, 3, 4]);
  const storage = memoryStorage();
  [1001, 1002, 1003, 1004].forEach((id) => toggleComparisonId(storage, id));
  const result = toggleComparisonId(storage, 1005);
  assert.equal(result.status, "limit");
  assert.deepEqual(readComparisonIds(storage), [1001, 1002, 1003, 1004]);
  assert.equal(toggleComparisonId(storage, 1002).status, "removed");
});

test("comparison marks missing facts and best numeric values without inventing data", () => {
  const rows = buildComparisonRows([dealFinderMockListings[0], { ...dealFinderMockListings[1], mileage: null }]);
  const price = rows.find((row) => row.key === "price");
  const mileage = rows.find((row) => row.key === "mileage");
  assert.equal(price?.cells[0].best, true);
  assert.equal(mileage?.cells[1].missing, true);
  assert.equal(mileage?.cells[1].value, "Нет данных");
});

test("quiet hours support overnight intervals in the configured timezone", () => {
  const preferences = defaultNotificationPreferences();
  assert.equal(isInsideQuietHours(preferences, new Date("2026-07-19T21:30:00.000Z")), true);
  assert.equal(isInsideQuietHours(preferences, new Date("2026-07-19T06:00:00.000Z")), false);
});

test("notification channels, events and score can suppress a delivery", () => {
  const preferences = { ...defaultNotificationPreferences(), email_enabled: true, quiet_hours_enabled: false };
  assert.equal(notificationSuppressionReason({ preferences, event: "hot_deal", channel: "web_push", dealScore: 90 }), "channel_disabled");
  assert.equal(notificationSuppressionReason({ preferences, event: "hot_deal", channel: "email", dealScore: 50 }), "below_score");
  assert.equal(notificationSuppressionReason({ preferences, event: "hot_deal", channel: "email", dealScore: 90 }), null);
});

test("delivery log rejects the same event and channel twice", () => {
  const storage = memoryStorage();
  const delivery = {
    dedupe_key: notificationDedupeKey({ userId: 7, listingId: 1002, event: "hot_deal", version: "v1" }),
    listing_id: 1002,
    event: "hot_deal" as const,
    channel: "email" as const,
    status: "preview" as const,
    created_at: "2026-07-19T12:00:00.000Z",
  };
  assert.equal(registerNotificationDelivery(storage, delivery).accepted, true);
  assert.equal(registerNotificationDelivery(storage, delivery).accepted, false);
  assert.equal(registerNotificationDelivery(storage, { ...delivery, channel: "web_push" }).accepted, true);
});

test("stage three exposes comparison, shortlist and notification controls", () => {
  const client = readFileSync(new URL("../src/lib/deal-finder/client.ts", import.meta.url), "utf8");
  const comparison = readFileSync(new URL("../src/lib/deal-finder/comparison.ts", import.meta.url), "utf8");
  const header = readFileSync(new URL("../src/components/deal-finder/DealFinderHeader.astro", import.meta.url), "utf8");
  const xano = readFileSync(new URL("../docs/xano/deal-finder-stage-3.xs", import.meta.url), "utf8");
  assert.match(client, /mountDealFinderComparison/);
  assert.match(client, /mountDealFinderNotifications/);
  assert.match(comparison, /Нет данных/);
  assert.match(header, /Сравнение/);
  assert.match(header, /Уведомления/);
  assert.match(xano, /unique = \[user_id, channel, dedupe_key\]/);
  assert.match(xano, /\$auth\.id/);
});
