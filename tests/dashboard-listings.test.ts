import assert from "node:assert/strict";
import test from "node:test";

import {
  DASHBOARD_LISTING_PLACEHOLDER,
  getDashboardListingActions,
  getDashboardListingThumbnail,
  getSafeDashboardImageUrl,
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
