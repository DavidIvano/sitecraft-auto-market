import assert from "node:assert/strict";
import test from "node:test";
import {
  PHONE_COUNTRIES,
  composeInternationalPhone,
  sanitizeNationalPhoneDigits,
  splitInternationalPhone,
  validateInternationalPhone,
} from "../src/lib/internationalPhone.ts";
import { normalizeContactPhone } from "../src/lib/contactProfile.ts";
import { ListingSubmissionApiError } from "../src/lib/aiDraftSubmission.ts";

test("country selector covers international calling codes used by the marketplace", () => {
  assert.ok(PHONE_COUNTRIES.length > 200);
  for (const expected of [["DE", "49"], ["TR", "90"], ["UA", "380"], ["US", "1"]]) {
    assert.ok(PHONE_COUNTRIES.some(({ code, callingCode }) => code === expected[0] && callingCode === expected[1]));
  }
});

test("visible national number is reduced to digits without silently truncating invalid input", () => {
  assert.equal(sanitizeNationalPhoneDigits("(0160) 965-56-543 ext. 9"), "0160965565439");
  assert.equal(sanitizeNationalPhoneDigits("12345678901234567890"), "12345678901234567890");
});

test("country-specific validation produces canonical E.164 values", () => {
  assert.deepEqual(validateInternationalPhone("DE", "016096556543"), {
    valid: true,
    e164: "+4916096556543",
    message: "",
  });
  assert.equal(validateInternationalPhone("TR", "5551234567").e164, "+905551234567");
  assert.equal(validateInternationalPhone("DE", "123").valid, false);
  assert.equal(validateInternationalPhone("DE", "01609655654399999999").valid, false);
  assert.equal(composeInternationalPhone("UA", "0501234567"), "+380501234567");
});

test("saved international numbers split back into the correct country and national number", () => {
  const split = splitInternationalPhone("+905551234567");
  assert.equal(split.country, "TR");
  assert.equal(split.nationalDigits, "5551234567");
  assert.equal(split.valid, true);
});

test("contact normalization rejects invalid length and keeps valid legacy formatting", () => {
  assert.equal(normalizeContactPhone("+49 160 96556543"), "+4916096556543");
  assert.equal(normalizeContactPhone("0049 160 96556543"), "+4916096556543");
  assert.equal(normalizeContactPhone("0160 96556543"), "+4916096556543");
  assert.equal(normalizeContactPhone("+49123"), "");
  assert.equal(normalizeContactPhone("+49160965565439999999"), "");
});

test("new-listing and profile forms use country plus digits-only phone controls", async () => {
  const { readFile } = await import("node:fs/promises");
  const [component, listingPage, profileForm] = await Promise.all([
    readFile(new URL("../src/components/InternationalPhoneField.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/dashboard/new.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/dashboard/ContactProfileForm.astro", import.meta.url), "utf8"),
  ]);
  assert.match(component, /aria-label="Страна и телефонный код"/);
  assert.match(component, /inputmode="numeric"/);
  assert.match(component, /pattern="\[0-9\]\*"/);
  assert.match(component, /data-phone-canonical/);
  assert.match(listingPage, /nationalName="sellerPhoneNational"/);
  assert.match(listingPage, /initializeInternationalPhoneFields\(document\)/);
  assert.match(profileForm, /nationalName="contact_phone_national"/);
});

test("authorization failures explain the concrete moderation reason in Russian", () => {
  assert.match(new ListingSubmissionApiError(401, "Unauthorized").message, /Сессия завершена/);
  assert.match(new ListingSubmissionApiError(403, "Access denied").message, /отклонил право/);
});
