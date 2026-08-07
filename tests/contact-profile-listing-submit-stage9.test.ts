import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ContactProfileApiError,
  isSameContactProfile,
  normalizeContactProfile,
  readContactProfileApiResponse,
} from "../src/lib/contactProfile.ts";
import {
  createListingSubmitIdempotencyKey,
  getListingFilesFingerprint,
  runListingSubmissionWorkflow,
  type ListingSubmissionPhase,
} from "../src/lib/listingSubmissionWorkflow.ts";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("contact payload uses canonical fields, nulls hidden email, and normalizes German phones", () => {
  for (const phone of ["+4916096556543", "+49 160 96556543", "0049 160 96556543", "0160 96556543", "+49 (0) 160 96556543"]) {
    const result = normalizeContactProfile({
      display_name: "Davyd Ivanov",
      contact_phone: phone,
      contact_email: "",
      show_phone: true,
      show_email: false,
      preferred_contact_method: "phone",
    }, { requirePublicContact: true });
    assert.equal(result.ok, true, phone);
    assert.deepEqual(result.value, {
      first_name: "",
      last_name: "",
      display_name: "Davyd Ivanov",
      contact_phone: "+4916096556543",
      contact_email: null,
      show_phone: true,
      show_email: false,
      preferred_contact_method: "phone",
    });
    assert.equal("seller_phone" in (result.value || {}), false);
  }
});

test("contact visibility and preferred-method combinations are validated before PATCH", () => {
  const cases = [
    [{ show_phone: true }, "PHONE_REQUIRED"],
    [{ show_email: true }, "EMAIL_REQUIRED"],
    [{ contact_phone: "+4916096556543", show_phone: false, preferred_contact_method: "phone" }, "PREFERRED_CONTACT_UNAVAILABLE"],
    [{ contact_email: "seller@example.com", show_email: false, preferred_contact_method: "email" }, "PREFERRED_CONTACT_UNAVAILABLE"],
  ] as const;
  for (const [input, code] of cases) {
    assert.equal(normalizeContactProfile(input).issues.some((issue) => issue.code === code), true);
  }
  assert.equal(normalizeContactProfile({ contact_email: "Seller@Example.com", show_email: true, preferred_contact_method: "email" }).value?.contact_email, "seller@example.com");
});

test("normalized equality skips an unchanged contact PATCH", () => {
  assert.equal(isSameContactProfile(
    { display_name: "David", contact_phone: "+49 160 96556543", contact_email: "Seller@Example.com", show_phone: true, show_email: true, preferred_contact_method: "phone" },
    { display_name: "David", contact_phone: "+4916096556543", contact_email: "seller@example.com", show_phone: true, show_email: true, preferred_contact_method: "phone" },
  ), true);
});

test("contact API errors preserve status, code, field, message and retryability", async () => {
  const response = new Response(JSON.stringify({ code: "EMAIL_INVALID", field: "contact_email", message: "raw internal message" }), {
    status: 422,
    headers: { "content-type": "application/json" },
  });
  await assert.rejects(() => readContactProfileApiResponse(response), (error: unknown) => {
    assert.ok(error instanceof ContactProfileApiError);
    assert.equal(error.status, 422);
    assert.equal(error.code, "EMAIL_INVALID");
    assert.equal(error.field, "contact_email");
    assert.equal(error.message, "Введите корректный email.");
    assert.equal(error.retryable, false);
    return true;
  });

  for (const status of [400, 401, 403, 409, 429, 500]) {
    const error = new ContactProfileApiError({ status, payload: status === 400 ? "validation text" : { code: "UNKNOWN" } });
    assert.equal(error.status, status);
    assert.equal(error.retryable, status === 429 || status >= 500);
  }
});

test("contact API parser handles invalid JSON and text responses", async () => {
  await assert.rejects(() => readContactProfileApiResponse(new Response("{", { status: 400, headers: { "content-type": "application/json" } })), ContactProfileApiError);
  await assert.rejects(() => readContactProfileApiResponse(new Response("temporary failure", { status: 503, headers: { "content-type": "text/plain" } })), (error: unknown) => error instanceof ContactProfileApiError && error.retryable);
});

test("manual workflow orders contacts before upload and stops on each failed phase", async () => {
  const phases: ListingSubmissionPhase[] = [];
  const calls: string[] = [];
  const result = await runListingSubmissionWorkflow({
    validate: () => { calls.push("validate"); },
    ensureContacts: () => { calls.push("contacts"); return "contacts"; },
    ensureImages: () => { calls.push("images"); return ["image"]; },
    ensureListing: () => { calls.push("listing"); return { draftId: 12 }; },
    submitModeration: () => { calls.push("moderation"); return { listing_id: 34 }; },
    onPhase: (phase) => phases.push(phase),
  });
  assert.deepEqual(calls, ["validate", "contacts", "images", "listing", "moderation"]);
  assert.equal(result.listing_id, 34);
  assert.deepEqual(phases, ["validating", "saving_contacts", "uploading_images", "creating_listing", "submitting_moderation", "success"]);

  const failedCalls: string[] = [];
  await assert.rejects(() => runListingSubmissionWorkflow({
    validate: () => { failedCalls.push("validate"); },
    ensureContacts: () => { failedCalls.push("contacts"); throw new Error("contact failure"); },
    ensureImages: () => { failedCalls.push("images"); return []; },
    ensureListing: () => { failedCalls.push("listing"); return {}; },
    submitModeration: () => { failedCalls.push("moderation"); },
  }));
  assert.deepEqual(failedCalls, ["validate", "contacts"]);
});

test("file reuse fingerprint and listing idempotency key are stable", () => {
  const files = [
    { name: "b.jpg", size: 2, lastModified: 20 },
    { name: "a.jpg", size: 1, lastModified: 10 },
  ];
  assert.equal(getListingFilesFingerprint(files), getListingFilesFingerprint([...files].reverse()));
  assert.equal(createListingSubmitIdempotencyKey(15, "local-draft-1"), "listing-submit:15:local-draft-1");
});

test("manual page uses the canonical contact parser, guarded state machine, image reuse, and modern draft routes", async () => {
  const source = await read("src/pages/dashboard/new.astro");
  assert.match(source, /isManualSubmitRunning/);
  assert.match(source, /runListingSubmissionWorkflow/);
  assert.match(source, /ensureContacts:[\s\S]*ensureImages:[\s\S]*ensureListing:[\s\S]*submitModeration:/);
  assert.match(source, /readContactProfileApiResponse/);
  assert.match(source, /contact_email: validation\.value\.contact_email/);
  assert.match(source, /manualUploadState\?\.fingerprint === fingerprint/);
  assert.match(source, /createListingSubmitIdempotencyKey/);
  assert.match(source, /listingsCreateDraft/);
  assert.match(source, /listingsSubmitModeration/);
  assert.match(source, /readListingSubmissionApiResponse/);
  assert.match(source, /import \{ LEGACY_PUBLIC_LOCALE \} from "\.\.\/\.\.\/i18n\/config"/);
  assert.equal((source.match(/payload\.set\("source_locale", LEGACY_PUBLIC_LOCALE\)/g) || []).length, 2);
  assert.match(source, /UNSUPPORTED_SOURCE_LOCALE/);
  assert.match(source, /showManualFieldErrors\(error\.issues\)/);
  assert.match(source, /manualModerationRetryOnly = false/);
  assert.match(source, /price" min="100" max="500000"/);
  assert.match(source, /window\.location\.href = "\/dashboard\/listings\?submitted=1"/);
  assert.doesNotMatch(source, /if \(!response\.ok\) throw new Error\("Контакты не сохранены/);
});

test("Xano stage 9 contract accepts nullable email, returns field errors, and scopes idempotency per user", async () => {
  const profile = await read("docs/xano/contact-profile-listing-submit-stage-9/PATCH_me_contact_profile.after.xs");
  const draft = await read("docs/xano/contact-profile-listing-submit-stage-9/POST_listings_create_draft.after.xs");
  const table = await read("docs/xano/contact-profile-listing-submit-stage-9/car_drafts.after.xs");
  assert.match(profile, /text contact_email\? filters=trim\|lower/);
  assert.match(profile, /code: "EMAIL_INVALID", field: "contact_email"/);
  assert.match(profile, /code: "PHONE_INVALID", field: "contact_phone"/);
  assert.match(profile, /regex_matches:\$next_phone/);
  assert.doesNotMatch(profile, /\$next_phone\|regex_matches:/);
  assert.match(draft, /text idempotency_key\?/);
  assert.match(draft, /car_drafts\.user_id == \$auth\.id/);
  assert.match(draft, /car_drafts\.idempotency_key == \$input\.idempotency_key/);
  assert.match(table, /btree\|unique[\s\S]*user_id[\s\S]*idempotency_key/);
});
