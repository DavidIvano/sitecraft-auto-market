import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const createDraft = read("../docs/xano/multilingual-stage-10/release-2/POST_listings_create_draft.after.xs");
const submitModeration = read("../docs/xano/multilingual-stage-10/release-2-1/POST_listings_submit_moderation.after.xs");
const editListing = read("../docs/xano/multilingual-stage-10/release-2-1/PATCH_dashboard_listings_id.after.xs");
const adminTranslations = read("../docs/xano/multilingual-stage-10/release-2-1/GET_admin_listing_translations.xs");
const draftSchema = read("../docs/xano/multilingual-stage-10/release-2/car_drafts.after.xs");
const moderationPage = read("../src/pages/admin/moderation.astro");
const apiRoutes = read("../src/lib/apiRoutes.ts");

test("Release 2 draft write validates and persists one registered source locale", () => {
  assert.match(draftSchema, /source_locale\?=de/);
  assert.match(createDraft, /text source_locale\?/);
  assert.match(createDraft, /db\.query locales/);
  assert.match(createDraft, /is_active == true/);
  assert.match(createDraft, /error = "UNSUPPORTED_SOURCE_LOCALE"/);
  assert.equal((createDraft.match(/source_locale\s*: \$source_locale/g) || []).length, 2);
});

for (const [name, source] of [
  ["submit moderation", submitModeration],
  ["owner listing edit", editListing],
] as const) {
  test(`${name} dual-writes original content and idempotent translation jobs`, () => {
    // Source hashes are stored in text columns and idempotency keys, so they must
    // be the 64-character hexadecimal representation, never raw binary bytes.
    assert.match(source, /json_encode\|sha256:false/);
    assert.doesNotMatch(source, /json_encode\|sha256:true/);
    assert.match(source, /schema_version\s*:\s*"listing-i18n-v1"/);
    assert.match(source, /if \(\(\$car\.translation_source_hash\|first_notnull:""\) != \$translation_source_hash\)/);
    assert.match(source, /translation_source_hash/);
    assert.match(source, /translation_version/);
    assert.match(source, /translations_ready\s*: false/);
    assert.match(source, /db\.query car_listing_translations/);
    assert.match(source, /translation_status\s*: "original"/);
    assert.match(source, /translation_source\s*: "original"/);
    assert.match(source, /db\.query translation_jobs/);
    assert.match(source, /idempotency_key: \$translation_job_key/);
    assert.match(source, /if \(\$existing_translation_job == null\)/);
    assert.match(source, /status: "outdated"/);
    assert.match(source, /status\s*: "pending"/);
  });
}

test("admin translation endpoint checks the server role before listing or translation reads", () => {
  const roleCheck = adminTranslations.indexOf('$current_user.role == "admin"');
  const listingRead = adminTranslations.indexOf("db.get car_listings");
  const translationRead = adminTranslations.indexOf("db.query car_listing_translations");
  assert.ok(roleCheck > -1);
  assert.ok(roleCheck < listingRead);
  assert.ok(roleCheck < translationRead);
  assert.doesNotMatch(adminTranslations, /@gmail\.com|current_user\.email/);
});

test("moderation exposes the admin-only translation view without enabling public locale reads", () => {
  assert.match(apiRoutes, /adminListingTranslations/);
  assert.match(moderationPage, /data-listing-translations-path-template/);
  assert.match(moderationPage, /data-load-translations/);
  assert.match(moderationPage, /Authorization: `Bearer \$\{token\}`/);
  assert.match(moderationPage, /cache: "no-store"/);
});
