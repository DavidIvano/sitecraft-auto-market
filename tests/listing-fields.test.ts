import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  formatTuvValue,
  isDisplayValue,
  maskVin,
  normalizeListingFields,
  parseNullableBoolean,
  sanitizePublicDescription,
  validateTuvFields,
} from "../src/lib/listingFields.ts";

const july2026 = new Date(2026, 6, 14, 12, 0, 0);

test("normalizes legacy aliases into the canonical listing contract", () => {
  const fields = normalizeListingFields({
    drive_type: "Полный",
    owner_count: 2,
    condition: "Б/у",
    first_registration_date: "2020-03",
  } as never);

  assert.equal(fields.drivetrain, "Полный");
  assert.equal(fields.owners_count, 2);
  assert.equal(fields.vehicle_condition, "Б/у");
  assert.equal(fields.first_registration, "2020-03");
});

test("parses boolean true values", () => assert.equal(parseNullableBoolean("true"), true));
test("parses boolean false values", () => assert.equal(parseNullableBoolean("0"), false));
test("keeps an unknown TÜV answer nullable", () => assert.equal(parseNullableBoolean(""), null));

test("accepts a confirmed future TÜV month", () => {
  assert.equal(validateTuvFields(true, "2027-03", july2026).valid, true);
});

test("rejects confirmed TÜV without a month", () => {
  assert.match(validateTuvFields(true, "", july2026).issues.join(" "), /YYYY-MM/);
});

test("rejects an invalid TÜV month format", () => {
  assert.equal(validateTuvFields(true, "03.2027", july2026).valid, false);
});

test("rejects an expired TÜV month", () => {
  assert.match(validateTuvFields(true, "2026-06", july2026).issues.join(" "), /будущем/);
});

test("accepts no valid TÜV when the month is empty", () => {
  assert.deepEqual(validateTuvFields(false, "", july2026), {
    valid: true,
    issues: [],
    hasValidTuv: false,
    validUntil: null,
  });
});

test("clears a stale TÜV month when the answer is no", () => {
  assert.deepEqual(validateTuvFields(false, "2027-01", july2026), {
    valid: true,
    issues: [],
    hasValidTuv: false,
    validUntil: null,
  });
  assert.equal(normalizeListingFields({ has_valid_tuv: "false", tuv_valid_until: "2027-01" } as never).tuv_valid_until, null);
});

test("requires an explicit TÜV answer at submit time", () => {
  assert.match(validateTuvFields(null, null, july2026).issues.join(" "), /Укажите/);
});

test("formats a future TÜV month for the public detail", () => {
  assert.equal(formatTuvValue(true, "2027-03"), "до 03/2027");
});

test("formats an explicit missing TÜV as no", () => {
  assert.equal(formatTuvValue(false, null), "Нет");
});

test("masks a valid VIN and hides an invalid VIN", () => {
  assert.equal(maskVin("WVWZZZ1JZXW000001"), "WVW***********001");
  assert.equal(maskVin("NOT-A-VIN"), "");
});

test("removes seller PII from a public description", () => {
  const result = sanitizePublicDescription([
    "Автомобиль в хорошем визуальном состоянии.",
    "Телефон: +49 151 23456789",
    "Пишите на seller@example.com",
    "Первая регистрация: 2020-03",
  ].join("\n"));

  assert.match(result, /Автомобиль/);
  assert.match(result, /2020-03/);
  assert.doesNotMatch(result, /151 23456789|seller@example\.com/);
});

test("hides empty technical values but keeps an explicit no", () => {
  assert.equal(isDisplayValue("NaN"), false);
  assert.equal(isDisplayValue(0), false);
  assert.equal(isDisplayValue("Нет"), true);
});

test("create, edit, and moderation contracts clear the TÜV date unless confirmed true", async () => {
  const files = await Promise.all([
    readFile(new URL("../src/pages/dashboard/new.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/dashboard/listings/edit.astro", import.meta.url), "utf8"),
    readFile(new URL("../docs/xano-endpoint-post-listings-create-draft.xs", import.meta.url), "utf8"),
    readFile(new URL("../docs/xano-endpoint-post-listings-submit-moderation.xs", import.meta.url), "utf8"),
    readFile(new URL("../docs/xano-endpoint-patch-dashboard-listing.xs", import.meta.url), "utf8"),
  ]);
  assert.match(files[0], /input\.disabled = hasValidTuv !== "true"/);
  assert.match(files[1], /input\.disabled = !enabled/);
  assert.match(files[2], /var \$tuv_valid_until \{\s*value = null/);
  assert.match(files[3], /if \(\$has_valid_tuv != true\)[\s\S]*?value = null/);
  assert.match(files[4], /if \(\$input\.has_valid_tuv == true\)/);
});
