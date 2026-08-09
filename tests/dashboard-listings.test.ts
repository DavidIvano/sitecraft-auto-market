import assert from "node:assert/strict";
import test from "node:test";

import {
  DASHBOARD_LISTING_PLACEHOLDER,
  formatLastViewedAt,
  formatViewCount,
  getDashboardListingActions,
  getDashboardListingThumbnail,
  getSafeDashboardImageUrl,
  normalizeViewCount,
} from "../src/lib/dashboardListings.ts";

const image = (overrides: Record<string, unknown>) => ({
  id: 1,
  car_listing_id: 55,
  image_url: "https://images.example.com/default.webp",
  sort_order: 0,
  is_main: false,
  is_primary: false,
  is_deleted: false,
  ...overrides,
});

test("dashboard thumbnail prefers an active main image", () => {
  const result = getDashboardListingThumbnail({
    id: 55,
    images: [
      image({ id: 1, is_primary: true, image_url: "https://images.example.com/primary.webp" }),
      image({ id: 2, is_main: true, sort_order: 9, image_url: "https://images.example.com/main.webp" }),
    ],
  });
  assert.equal(result.url, "https://images.example.com/main.webp");
});

test("dashboard thumbnail falls back to primary then sort order", () => {
  assert.equal(
    getDashboardListingThumbnail({
      id: 55,
      images: [
        image({ id: 1, sort_order: 0, image_url: "https://images.example.com/ordered.webp" }),
        image({ id: 2, is_primary: true, sort_order: 5, image_url: "https://images.example.com/primary.webp" }),
      ],
    }).url,
    "https://images.example.com/primary.webp",
  );

  assert.equal(
    getDashboardListingThumbnail({
      id: 55,
      images: [
        image({ id: 1, sort_order: 8, image_url: "https://images.example.com/eight.webp" }),
        image({ id: 2, sort_order: 2, image_url: "https://images.example.com/two.webp" }),
      ],
    }).url,
    "https://images.example.com/two.webp",
  );
});

test("deleted and unsafe images are ignored", () => {
  const result = getDashboardListingThumbnail({
    id: 55,
    images: [
      image({ is_main: true, is_deleted: true, image_url: "https://images.example.com/deleted.webp" }),
      image({ id: 2, image_url: "blob:https://example.com/photo" }),
      image({ id: 3, image_url: "http://localhost/photo.webp" }),
      image({ id: 4, image_url: "https://images.example.com/active.webp" }),
    ],
  });
  assert.equal(result.url, "https://images.example.com/active.webp");
  assert.equal(getSafeDashboardImageUrl("data:image/png;base64,abc"), "");
});

test("listing without an image keeps a working placeholder", () => {
  const result = getDashboardListingThumbnail({ id: 55, images: [] });
  assert.deepEqual(result, { url: DASHBOARD_LISTING_PLACEHOLDER, isPlaceholder: true });
});

test("pending listing keeps its owner dashboard thumbnail but has no public link", () => {
  const listing = {
    id: 55,
    slug: "private-listing",
    status: "pending_review" as const,
    moderation_status: "pending_review" as const,
    thumbnail_url: "https://images.example.com/pending.webp",
  };
  assert.equal(getDashboardListingThumbnail(listing).url, "https://images.example.com/pending.webp");
  assert.equal(getDashboardListingActions(listing).viewHref, "");
  assert.equal(getDashboardListingActions(listing).canDelete, true);
});

test("blocked and deleted listings cannot use owner delete", () => {
  assert.equal(getDashboardListingActions({ id: 1, status: "blocked" }).canDelete, false);
  assert.equal(getDashboardListingActions({ id: 2, status: "deleted" }).canDelete, false);
});

test("listing status selects one primary action", () => {
  assert.deepEqual(
    { label: getDashboardListingActions({ id: 1, status: "draft" }).primaryLabel, href: getDashboardListingActions({ id: 1, status: "draft" }).primaryHref },
    { label: "Продолжить", href: "/dashboard/listings/edit?id=1" },
  );
  assert.equal(getDashboardListingActions({ id: 2, status: "needs_fix" }).primaryLabel, "Исправить");
  assert.equal(getDashboardListingActions({ id: 3, status: "published", slug: "public-car" }).primaryLabel, "Посмотреть");
  assert.equal(getDashboardListingActions({ id: 3, status: "published", slug: "public-car" }).editHref, "/dashboard/listings/edit?id=3");
});

test("view counters are safe and use correct Russian plural forms", () => {
  assert.equal(normalizeViewCount(undefined), 0);
  assert.equal(normalizeViewCount("invalid"), 0);
  assert.equal(formatViewCount(0), "0 просмотров");
  assert.equal(formatViewCount(1), "1 просмотр");
  assert.equal(formatViewCount(2), "2 просмотра");
  assert.equal(formatViewCount(5), "5 просмотров");
  assert.equal(formatViewCount(21), "21 просмотр");
  assert.doesNotMatch(formatViewCount(undefined), /undefined|NaN|null/);
});

test("last view date is formatted and invalid values stay empty", () => {
  const now = new Date(2026, 6, 29, 16, 0, 0);
  const viewed = new Date(2026, 6, 29, 14, 35, 0);
  assert.match(formatLastViewedAt(viewed.toISOString(), now), /^Последний просмотр: сегодня, 14:35$/);
  assert.equal(formatLastViewedAt(undefined, now), "");
  assert.equal(formatLastViewedAt("invalid", now), "");
});
