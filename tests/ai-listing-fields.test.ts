import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAiDraftFields } from "../src/lib/ai/normalizeAiDraftFields.ts";

test("AI normalization does not invent document or seller fields", () => {
  const { fields } = normalizeAiDraftFields({
    brand: "BMW",
    model: "320d",
    owners_count: null as never,
    first_registration: "",
    vin: "",
    seller_phone: "",
    seller_email: "",
    has_valid_tuv: null,
    tuv_valid_until: null,
  });

  assert.equal(fields.brand, "BMW");
  assert.equal(fields.owners_count, undefined);
  assert.equal(fields.first_registration, undefined);
  assert.equal(fields.vin, undefined);
  assert.equal(fields.seller_phone, undefined);
  assert.equal(fields.seller_email, undefined);
  assert.equal(fields.has_valid_tuv, undefined);
  assert.equal(fields.tuv_valid_until, undefined);
});

test("AI normalization preserves confirmed structured TUV values", () => {
  const { fields, warnings } = normalizeAiDraftFields({
    has_valid_tuv: true,
    tuv_valid_until: "2027-11",
  });

  assert.equal(fields.has_valid_tuv, true);
  assert.equal(fields.tuv_valid_until, "2027-11");
  assert.deepEqual(warnings, []);
});

test("AI normalization rejects localized TUV date text", () => {
  const { fields, warnings } = normalizeAiDraftFields({
    has_valid_tuv: true,
    tuv_valid_until: "11.2027",
  });

  assert.equal(fields.has_valid_tuv, true);
  assert.equal(fields.tuv_valid_until, undefined);
  assert.match(warnings.join(" "), /YYYY-MM/);
});

test("AI normalization maps drivetrain and five-plus owners", () => {
  const { fields } = normalizeAiDraftFields({
    drivetrain: "AWD",
    owners_count: "5+",
  });

  assert.equal(fields.drivetrain, "Полный");
  assert.equal(fields.owners_count, "5");
});
