import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

const protectedActionContracts = [
  "docs/xano/admin-security-remediation/3966703.after.xs",
  "docs/xano/admin-security-remediation/3979595.after.xs",
  "docs/xano/admin-security-remediation/3975051.after.xs",
  "docs/xano/admin-security-remediation/3975107.after.xs",
  "docs/xano-endpoint-patch-dashboard-listing.xs",
  "docs/xano-endpoint-patch-dashboard-listings-id-delete.xs",
];

test("every protected listing mutation is connected to the user auth schema", () => {
  for (const file of protectedActionContracts) {
    const source = read(file);
    assert.match(source, /^\s*auth\s*=\s*"automarket_users"\s*$/mu, file);
    assert.match(source, /\$auth\.id/u, file);
  }
});

test("SEO hook deployment refuses to push protected endpoints without auth", () => {
  const source = read("scripts/deploy-xano-seo-hooks.mjs");
  const protectedFiles = [
    "admin/cars/id/approve_PATCH.xs",
    "admin/cars/id/block_PATCH.xs",
    "admin/cars/id/delete_PATCH.xs",
    "admin/cars/id/sold_PATCH.xs",
    "dashboard/listings/id_PATCH.xs",
    "dashboard/listings/id/delete_PATCH.xs",
  ];

  for (const file of protectedFiles) {
    assert.match(source, new RegExp(`${file.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}[^\n]+requiresUserAuth: true`, "u"), file);
  }
  assert.match(source, /hook\.requiresUserAuth/u);
  assert.match(source, /auth\\s\*=/u);
  assert.match(source, /not connected to automarket_users/u);
});

test("moderation actions expose progress, exact HTTP failures and success feedback", () => {
  const source = read("src/pages/admin/moderation.astro");

  assert.match(source, /readResponseError/u);
  assert.match(source, /response\.status === 401/u);
  assert.match(source, /response\.status === 403/u);
  assert.match(source, /getFriendlyErrorMessage/u);
  assert.match(source, /dataset\.state = state/u);
  assert.match(source, /aria-busy/u);
  assert.match(source, /Объявление одобрено и опубликовано/u);
});
