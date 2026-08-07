import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizeContactEmail,
  normalizeContactPhone,
  validateContactProfile,
} from "../src/lib/contactProfile.ts";

test("validates public phone and email visibility", () => {
  assert.match(validateContactProfile({ show_phone: true }), /номер телефона/);
  assert.match(validateContactProfile({ show_email: true, contact_email: "bad" }), /email/);
  assert.equal(validateContactProfile({ show_phone: true, contact_phone: "+491234567890" }), "");
  assert.equal(validateContactProfile({ show_email: true, contact_email: "seller@example.com" }), "");
});

test("requires the preferred contact method to be public", () => {
  assert.match(validateContactProfile({ preferred_contact_method: "phone", contact_phone: "+491234567890" }), /предпочтительного способа/);
  assert.match(validateContactProfile({ preferred_contact_method: "email", contact_email: "seller@example.com" }), /предпочтительного способа/);
});

test("normalizes phone and email before PATCH", () => {
  assert.equal(normalizeContactPhone("0049 (123) 4567890"), "+491234567890");
  assert.equal(normalizeContactEmail(" Seller@Example.COM "), "seller@example.com");
});

test("contact form waits for auth, retries GET, and does not retry PATCH", async () => {
  const source = await readFile(new URL("../src/components/dashboard/ContactProfileForm.astro", import.meta.url), "utf8");
  assert.match(source, /waitForAuthRestore/);
  assert.match(source, /const delays = \[0, 1000, 3000\]/);
  assert.match(source, /const token = String\(getAuthToken\(\)/);
  assert.match(source, /await fetch\(`\$\{apiUrl\}\$\{API_ROUTES\.contactProfile\}`/);
  assert.match(source, /method: "PATCH"/);
  assert.doesNotMatch(source, /const token = getAuthToken\(\);/);
});
