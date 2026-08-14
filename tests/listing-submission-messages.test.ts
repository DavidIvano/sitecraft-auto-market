import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildListingSubmissionFailureMessage,
  summarizeListingIssues,
} from "../src/lib/listingSubmissionMessages.ts";

test("explains why a listing was saved but not submitted and asks for a retry", () => {
  const message = buildListingSubmissionFailureMessage("Добавьте минимум одну фотографию.", { saved: true });

  assert.match(message, /сохранено, но не отправлено на модерацию/i);
  assert.match(message, /Причина: Добавьте минимум одну фотографию/i);
  assert.match(message, /повторите отправку/i);
});

test("deduplicates concrete field reasons", () => {
  assert.equal(summarizeListingIssues([
    { field: "images", message: "Добавьте фотографию." },
    { field: "photos", message: "Добавьте фотографию." },
    { field: "seller_email", message: "Проверьте email." },
  ]), "Добавьте фотографию. Проверьте email");
});

test("manual form preserves native month and radio activation", async () => {
  const source = await readFile(new URL("../src/pages/dashboard/new.astro", import.meta.url), "utf8");

  assert.match(source, /nativePickerAndChoiceTypes[\s\S]*?"month"[\s\S]*?"radio"/);
  assert.match(source, /nativePickerAndChoiceTypes\.has\(control\.type\)[\s\S]*?return/);
  assert.match(source, /has_valid_tuv_explicit: hasValidTuv/);
});

test("manual submission replaces a closed restored draft and focuses concrete field errors", async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL("../src/pages/dashboard/new.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/workspace-overrides.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, /isNonEditableListingDraftError\(errorPayload\)/);
  assert.match(source, /resetClosedManualDraft\(payload\)[\s\S]*?ensureManualDraft\(payload, uploadedImages, false\)/);
  assert.match(source, /manualSubmissionId = crypto\.randomUUID\(\)/);
  assert.match(source, /payload\.delete\("draft_id"\)/);
  assert.match(source, /scrollIntoView\(\{ behavior: "auto", block: "center" \}\)[\s\S]*?focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /clearResolvedManualFieldError\(event\.target\)/);
  assert.match(source, /container\.querySelectorAll<HTMLElement>\("\[data-manual-field-error\]"\)[\s\S]*?node\.remove\(\)/);
  assert.match(source, /container\.classList\.remove\("has-field-error"\)/);
  assert.match(source, /container\.classList\.add\("has-field-error"\)/);
  assert.doesNotMatch(source, /if \(!validateQuizStep\(index\)\) \{\s*updateQuizStep\(index\)/);
  assert.match(source, /if \(form\?\.querySelector\("\.is-invalid"\)\) return;[\s\S]*?setMessage\(getStepTitle/);
  assert.match(styles, /fieldset\.has-field-error[\s\S]*?border-color: var\(--danger\)/);
});

test("mobile workspace navigation keeps every visible item scrollable and shows a hint", async () => {
  const [layout, styles] = await Promise.all([
    readFile(new URL("../src/layouts/BaseLayout.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/workspace-overrides.css", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /mac-sidebar-scroll-indicator/);
  assert.match(layout, /has-scrollable-nav/);
  assert.match(styles, /\.mac-sidebar-nav[\s\S]*?overflow-x: auto/);
  assert.match(styles, /\.mac-sidebar-link:nth-child\(n \+ 5\)[\s\S]*?display: flex/);
  assert.match(styles, /\.mac-sidebar-link\[hidden\][\s\S]*?display: none !important/);
});
