import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildPublicSellerContact,
  getSellerDisplayName,
  hasPublicSellerContact,
  normalizeContactEmail,
  normalizeContactPhone,
  validateSellerContactProfile,
} from "../src/lib/contactProfile.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("contact phone normalization accepts international user input", () => {
  assert.equal(normalizeContactPhone("+49 123 4567890"), "+491234567890");
  assert.equal(normalizeContactPhone("+49 (123) 4567890"), "+491234567890");
  assert.equal(normalizeContactPhone("0049 123 4567890"), "+491234567890");
  assert.equal(normalizeContactPhone("0123 4567890"), "+491234567890");
  assert.equal(normalizeContactPhone("+49 (0) 123 4567890"), "+491234567890");
  for (const invalid of ["491234567890", "+0123456789", "+49call-me", "<b>+491234567890</b>", "+49123\n456"]) {
    assert.equal(normalizeContactPhone(invalid), "");
  }
});

test("contact email is normalized and unsafe mailto values are rejected", () => {
  assert.equal(normalizeContactEmail(" Seller@Example.COM "), "seller@example.com");
  assert.equal(normalizeContactEmail("seller@example.com\r\nBcc:bad@example.com"), "");
  assert.equal(normalizeContactEmail("not-an-email"), "");
  assert.equal(normalizeContactEmail(`${"a".repeat(250)}@example.com`), "");
});

test("profile visibility and preferred method are validated consistently", () => {
  assert.match(validateSellerContactProfile({ show_phone: true }).message, /номер телефона/);
  assert.match(validateSellerContactProfile({ show_email: true }).message, /email/);
  assert.match(validateSellerContactProfile({
    contact_phone: "+491234567890",
    preferred_contact_method: "phone",
  }).message, /предпочтительного/);
  assert.equal(validateSellerContactProfile({
    contact_phone: "+49 123 4567890",
    show_phone: true,
    preferred_contact_method: "phone",
  }).value.contact_phone, "+491234567890");
  assert.equal(validateSellerContactProfile({}, { requirePublicContact: false }).valid, true);
  assert.equal(validateSellerContactProfile({}, { requirePublicContact: true }).valid, false);
});

test("public contact projection never includes disabled values", () => {
  const hidden = buildPublicSellerContact({
    contact_phone: "+491234567890",
    contact_email: "seller@example.com",
    show_phone: false,
    show_email: false,
  });
  assert.equal(hidden, null);

  const emailOnly = buildPublicSellerContact({
    contact_phone: "+491234567890",
    contact_email: "Seller@Example.com",
    show_phone: false,
    show_email: true,
    preferred_contact_method: "email",
  });
  assert.deepEqual(emailOnly, {
    email: "seller@example.com",
    email_href: "mailto:seller@example.com",
    preferred_method: "email",
  });
  assert.equal(hasPublicSellerContact({ contact_email: "seller@example.com", show_email: true }), true);
});

test("seller name follows the public display order without using email", () => {
  assert.equal(getSellerDisplayName({ display_name: "David", first_name: "D", last_name: "I" }), "David");
  assert.equal(getSellerDisplayName({ first_name: "David", last_name: "Ivanov" }), "David Ivanov");
  assert.equal(getSellerDisplayName({}, "Legacy seller"), "Legacy seller");
  assert.equal(getSellerDisplayName({ contact_email: "login@example.com" }), "Продавец автомобиля");
});

test("dashboard contact form initializes once, refreshes auth, retries only GET, and preserves input on PATCH errors", () => {
  const source = read("src/components/dashboard/ContactProfileForm.astro");
  for (const fn of [
    "initializeContactProfile",
    "loadContactProfile",
    "saveContactProfile",
    "readContactForm",
    "validateContactProfile",
    "fillContactForm",
    "setContactFormState",
  ]) assert.match(source, new RegExp(`function ${fn}`));
  assert.match(source, /contactProfileBound/);
  assert.match(source, /getAuthToken\(\)/);
  assert.match(source, /const delays = \[0, 1000, 3000\]/);
  assert.match(source, /method: "PATCH"/);
  assert.match(source, /seller-contact-profile-updated/);
  assert.match(source, /cache: "no-store"/);
  assert.match(source, /data-contact-field-error="contact_phone"/);
  assert.match(source, /aria-invalid/);
  assert.doesNotMatch(source, /form\.reset\(\)/);
});

test("public contact modal displays values, supports copy, and restores focus", () => {
  const source = read("src/components/ContactSellerModal.astro");
  assert.match(source, /data-contact-phone-value/);
  assert.match(source, /data-contact-email-value/);
  assert.match(source, /data-copy-contact="phone"/);
  assert.match(source, /data-copy-contact="email"/);
  assert.match(source, /navigator\.clipboard\.writeText/);
  assert.match(source, /Скопировано/);
  assert.match(source, /addEventListener\("cancel"/);
  assert.match(source, /lastTrigger\?\.focus/);
});

test("manual and AI publication share profile contacts and moderation requires a public channel", () => {
  const source = read("src/pages/dashboard/new.astro");
  assert.match(source, /loadSellerContactProfile/);
  assert.match(source, /saveSellerContactProfile/);
  assert.match(source, /API_ROUTES\.contactProfile/);
  assert.match(source, /requirePublicContact: false/);
  assert.match(source, /requirePublicContact: true/);
  assert.match(source, /show_phone/);
  assert.match(source, /showPhone/);
  assert.doesNotMatch(source, /authUser\?\.email/);
  assert.doesNotMatch(source, /firstValue\(source\.seller_phone\)/);
});

test("listing editor uses the global contact profile instead of editable legacy snapshots", () => {
  const source = read("src/pages/dashboard/listings/edit.astro");
  assert.match(source, /Изменить контакты для всех объявлений/);
  assert.match(source, /API_ROUTES\.contactProfile/);
  assert.match(source, /hasPublicSellerContact/);
  assert.doesNotMatch(source, /name="seller_phone"/);
  assert.doesNotMatch(source, /name="seller_email"/);
});

test("Xano contact patches keep auth ownership and never fall back to login email", () => {
  const profile = read("docs/xano/seller-contact-system-stage-6/PATCH_me_contact_profile.after.xs");
  const publicCar = read("docs/xano/seller-contact-system-stage-6/GET_cars_slug.after.xs");
  const moderation = read("docs/xano/seller-contact-system-stage-6/POST_listings_submit_moderation.after.xs");

  assert.match(profile, /auth = "automarket_users"/);
  assert.match(profile, /field_value = \$auth\.id/);
  assert.match(profile, /\|replace:" ":""/);
  assert.match(profile, /\(\$next_phone\|substr:0:2\) == "00"/);
  assert.match(profile, /\(\$next_phone\|substr:0:1\) == "0"/);
  assert.match(profile, /\(\$next_phone\|substr:0:4\) == "\+490"/);
  assert.match(publicCar, /\$seller_profile\.show_phone/);
  assert.match(publicCar, /\$seller_profile\.show_email/);
  assert.match(publicCar, /value = null/);
  assert.match(publicCar, /var \$phone_href/);
  assert.match(publicCar, /value = "tel:"\|concat:\$public_phone/);
  assert.match(publicCar, /phone_href\s+: \$phone_href/);
  assert.doesNotMatch(publicCar, /phone_href\s+: \(\$public_phone == null\) \? null/);
  assert.match(moderation, /\$auth_user\.show_phone/);
  assert.match(moderation, /\$auth_user\.show_email/);
  assert.doesNotMatch(moderation, /value = \$auth_user\.email/);
  assert.match(moderation, /Добавьте телефон или email и разрешите его показ покупателям/);
});
