import assert from "node:assert/strict";
import test from "node:test";
import {
  canRunModerationAction,
  getEffectiveModerationStatus,
  getLifecycleStatus,
  getModerationQueueCounts,
  getModerationQueueGroup,
  getStatusConflict,
  getStatusLabel,
  getStatusTone,
  isModerationApproved,
  isModerationBlocked,
  isPendingModeration,
} from "../src/lib/listingStatus.ts";

const fixture = (status: string | null, moderation_status: string | null) => ({ status, moderation_status });

test("1. pending lifecycle and moderation status enter pending", () => {
  const listing = fixture("pending_review", "pending_review");
  assert.equal(getEffectiveModerationStatus(listing), "pending_review");
  assert.equal(getModerationQueueGroup(listing), "pending");
  assert.equal(getStatusConflict(listing), null);
  assert.equal(isPendingModeration(listing), true);
});

test("2. approved pair enters approved", () => {
  const listing = fixture("approved", "approved");
  assert.equal(getModerationQueueGroup(listing), "approved");
  assert.equal(isModerationApproved(listing), true);
});

test("3. explicit pending wins over approved lifecycle and exposes conflict", () => {
  const listing = fixture("approved", "pending_review");
  assert.equal(getEffectiveModerationStatus(listing), "pending_review");
  assert.ok(getStatusConflict(listing));
  assert.equal(getModerationQueueGroup(listing), "conflict");
  assert.equal(isPendingModeration(listing), false);
});

test("4. explicit approved wins over pending lifecycle and exposes conflict", () => {
  const listing = fixture("pending_review", "approved");
  assert.equal(getEffectiveModerationStatus(listing), "approved");
  assert.ok(getStatusConflict(listing));
  assert.equal(getModerationQueueGroup(listing), "conflict");
  assert.equal(isModerationApproved(listing), false);
});

test("5. deleted pending requires manual attention and no normal action", () => {
  const listing = fixture("deleted", "pending_review");
  assert.equal(getModerationQueueGroup(listing), "conflict");
  assert.ok(getStatusConflict(listing));
  assert.equal(canRunModerationAction(listing, "approve"), false);
  assert.equal(canRunModerationAction(listing, "reject"), false);
});

test("6. blocked lifecycle overrides action availability and flags approved conflict", () => {
  const listing = fixture("blocked", "approved");
  assert.equal(isModerationBlocked(listing), true);
  assert.equal(getModerationQueueGroup(listing), "conflict");
  assert.ok(getStatusConflict(listing));
  assert.equal(canRunModerationAction(listing, "sold"), false);
});

test("7. published with null moderation safely falls back to approved", () => {
  const listing = fixture("published", null);
  assert.equal(getEffectiveModerationStatus(listing), "approved");
  assert.equal(getModerationQueueGroup(listing), "approved");
});

test("8. draft with null moderation does not enter a queue", () => {
  const listing = fixture("draft", null);
  assert.equal(getEffectiveModerationStatus(listing), null);
  assert.equal(getModerationQueueGroup(listing), null);
});

test("9. needs_fix lifecycle safely supplies moderation fallback", () => {
  const listing = fixture("needs_fix", null);
  assert.equal(getEffectiveModerationStatus(listing), "needs_fix");
  assert.equal(getModerationQueueGroup(listing), "needs_fix");
  assert.equal(canRunModerationAction(listing, "approve"), true);
  assert.equal(canRunModerationAction(listing, "reject"), true);
});

test("10. unknown values are stable and require manual review", () => {
  const listing = fixture("mystery", "later_maybe");
  assert.equal(getLifecycleStatus(listing), "unknown");
  assert.equal(getEffectiveModerationStatus(listing), "unknown");
  assert.equal(getModerationQueueGroup(listing), "conflict");
  assert.ok(getStatusConflict(listing));
  assert.equal(canRunModerationAction(listing, "approve"), false);
});

test("filters, counters, labels, tones, and actions share the same model", () => {
  const listings = [
    fixture("pending_review", "pending_review"),
    fixture("approved", "approved"),
    fixture("approved", "pending_review"),
    fixture("published", null),
    fixture("draft", null),
  ];
  const counts = getModerationQueueCounts(listings);
  assert.deepEqual({ all: counts.all, pending: counts.pending, approved: counts.approved, conflict: counts.conflict }, { all: 5, pending: 1, approved: 2, conflict: 1 });
  assert.equal(getStatusLabel("pending"), "Ожидают проверки");
  assert.equal(getStatusLabel("conflict"), "Конфликт статусов");
  assert.equal(getStatusTone("approved"), "success");
  assert.equal(getStatusTone("conflict"), "danger");
  assert.equal(canRunModerationAction(listings[0], "approve"), true);
  assert.equal(canRunModerationAction(listings[1], "sold"), true);
  assert.equal(canRunModerationAction(listings[2], "approve"), false);
  assert.equal(canRunModerationAction(listings[4], "approve"), false);
  assert.equal(canRunModerationAction(listings[1], "restore"), false);
});
