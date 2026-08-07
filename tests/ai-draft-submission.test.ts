import assert from "node:assert/strict";
import test from "node:test";

import {
  BACKEND_FIELD_TO_CONTROL,
  extractAiDraftIdentity,
  extractListingFieldIssues,
  ListingSubmissionApiError,
  normalizeTuvSubmissionValue,
  readListingSubmissionApiResponse,
  validateAiDraftSubmission,
} from "../src/lib/aiDraftSubmission.ts";

const completeDraft = {
  title: "BMW 320d 2015",
  brand: "BMW",
  model: "320d",
  year: "2015",
  mileage: "145000",
  price: "8900",
  currency: "EUR",
  city: "Braunschweig",
  country: "Германия",
  vehicle_type: "Легковой автомобиль",
  body_type: "Седан",
  fuel_type: "Дизель",
  transmission: "Автомат",
  drivetrain: "Задний",
  doors: "4/5",
  seats: "5",
  color: "Чёрный",
  owners_count: "1",
  first_registration: "2015-03",
  vehicle_condition: "Б/у",
  seller_type: "Частный продавец",
  seller_name: "Test User",
  seller_phone: "+49 151 0000000",
  seller_email: "",
  has_valid_tuv: "false",
  tuv_valid_until: "",
  vin: "",
};

test("uses only explicit draft and listing ids", () => {
  assert.deepEqual(extractAiDraftIdentity({ id: 999, draft_id: 12, listing: { id: 34 } }), {
    draftId: 12,
    listingId: 34,
  });
  assert.deepEqual(extractAiDraftIdentity({ id: 999 }), { draftId: null, listingId: null });
});

test("extracts structured Xano payload errors and maps legacy fields", () => {
  const issues = extractListingFieldIssues({
    message: "Listing is not ready for moderation",
    payload: [
      { field: "owner_count", message: "Укажите количество владельцев." },
      { field: "images", message: "Добавьте фотографию." },
    ],
  });

  assert.equal(issues.length, 2);
  assert.equal(BACKEND_FIELD_TO_CONTROL[issues[0].field], "owners_count");
  assert.equal(BACKEND_FIELD_TO_CONTROL[issues[1].field], "photos");
});

test("requires phone or email, but not both", () => {
  assert.equal(validateAiDraftSubmission(completeDraft, { imageCount: 1 }).ok, true);
  assert.equal(validateAiDraftSubmission({ ...completeDraft, seller_phone: "", seller_email: "seller@example.com" }, { imageCount: 1 }).ok, true);
  assert.match(
    validateAiDraftSubmission({ ...completeDraft, seller_phone: "", seller_email: "" }, { imageCount: 1 }).errors.join(" "),
    /телефон или email/i,
  );
});

test("keeps false TUV explicit and clears its date in the contract", () => {
  assert.equal(normalizeTuvSubmissionValue(false), "false");
  assert.equal(normalizeTuvSubmissionValue("false"), "false");
  assert.equal(normalizeTuvSubmissionValue(null), "");
});

test("returns field issues for TUV, first registration, and images", () => {
  const result = validateAiDraftSubmission({
    ...completeDraft,
    first_registration: "",
    has_valid_tuv: "true",
    tuv_valid_until: "",
  }, { imageCount: 0, now: new Date(2026, 6, 15) });

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.issues.map((issue) => issue.field).filter((field) => ["first_registration", "tuv_valid_until", "images"].includes(field)),
    ["first_registration", "tuv_valid_until", "images"],
  );
});

test("rejects future first registration and more than eight images", () => {
  const result = validateAiDraftSubmission({
    ...completeDraft,
    first_registration: "2027-01",
  }, { imageCount: 9, now: new Date(2026, 6, 15) });

  assert.deepEqual(
    result.issues.map((issue) => issue.field).filter((field) => ["first_registration", "images"].includes(field)),
    ["first_registration", "images"],
  );
});

test("accepts false TUV and ignores a stale AI date", () => {
  const result = validateAiDraftSubmission({
    ...completeDraft,
    has_valid_tuv: "false",
    tuv_valid_until: "2027-12",
  }, { imageCount: 1, now: new Date(2026, 6, 15) });

  assert.equal(result.ok, true);
  assert.equal(result.issues.some((issue) => issue.field === "tuv_valid_until"), false);
});

test("reads structured errors from the final response contract", () => {
  assert.deepEqual(extractListingFieldIssues({
    success: false,
    code: "LISTING_NOT_READY",
    errors: [{ field: "seller_contact", message: "Укажите телефон или email продавца." }],
  }), [{ field: "seller_contact", message: "Укажите телефон или email продавца." }]);
});

test("preserves moderation field errors from an HTTP response", async () => {
  const response = new Response(JSON.stringify({
    success: false,
    code: "LISTING_NOT_READY",
    message: "Listing is not ready for moderation",
    errors: [
      { field: "price", message: "Укажите корректную цену." },
      { field: "images", message: "Добавьте минимум одну фотографию." },
    ],
  }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });

  await assert.rejects(() => readListingSubmissionApiResponse(response), (error: unknown) => {
    assert.ok(error instanceof ListingSubmissionApiError);
    assert.equal(error.status, 400);
    assert.equal(error.code, "LISTING_NOT_READY");
    assert.deepEqual(error.issues.map((issue) => issue.field), ["price", "images"]);
    return true;
  });
});
