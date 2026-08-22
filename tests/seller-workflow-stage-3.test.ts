import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getUiPhraseMap } from "../src/i18n/uiTranslator.ts";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("seller workflow has four short steps, one submit action, and AI as a helper", async () => {
  const source = await read("../src/pages/dashboard/new.astro");
  assert.equal((source.match(/data-quiz-jump=/g) || []).length, 4);
  assert.match(source, /Фото[\s\S]*Автомобиль[\s\S]*Контакты[\s\S]*Проверка и отправка/);
  assert.match(source, /data-quiz-step="2"[\s\S]*Как с вами связаться/);
  assert.match(source, /data-first-registration/);
  assert.match(source, /регистрация не может быть раньше .*года выпуска/i);
  assert.match(source, /data-open-ai-helper>Заполнить данные с AI/);
  assert.equal((source.match(/data-quiz-submit/g) || []).length, 2);
  assert.doesNotMatch(source, /data-side-submit/);
  assert.match(source, /LOCAL_DRAFT_KEY/);
  assert.match(source, /LOCAL_DRAFT_FIELDS[\s\S]{0,500}"sellerPhone"/);
  assert.match(source, /LOCAL_DRAFT_FIELDS[\s\S]{0,700}"sellerEmail"/);
  assert.match(source, /Browsers cannot restore File objects[\s\S]*?activeQuizStep = 0/);
  assert.match(source, /submissionId:\s*ensureManualSubmissionId\(\)/);
});

test("new question flow is translated in every reviewed UI locale", () => {
  for (const locale of ["de", "en", "uk", "ar", "tr", "fr"] as const) {
    const phrases = getUiPhraseMap(locale);
    assert.ok(phrases["Какой автомобиль вы продаёте?"], `${locale} vehicle question`);
    assert.ok(phrases["Как с вами связаться?"], `${locale} contact question`);
    assert.ok(phrases["Марка ограничивает список моделей. Точную модификацию и двигатель сверьте с документами."], `${locale} reference note`);
    assert.ok(phrases["Основные характеристики"], `${locale} primary attributes`);
    assert.ok(phrases["Данные из документов"], `${locale} document details`);
    assert.ok(phrases["Контакты из профиля"], `${locale} profile contacts`);
  }
});

test("manual seller flow keeps the Xano contract while reducing visible input", async () => {
  const [source, styles, workspaceEntry] = await Promise.all([
    read("../src/pages/dashboard/new.astro"),
    read("../src/styles/components/listing-form.css"),
    read("../src/styles/entries/workspace.css"),
  ]);

  assert.match(source, /listing-smart-defaults[\s\S]*name="vehicleType" required[\s\S]*selected=\{item === "Легковой автомобиль"\}/);
  assert.match(source, /name="country"[\s\S]*value="Германия" required/);
  assert.match(source, /type="hidden" name="currency" value="EUR"/);
  assert.match(source, /data-required-details[\s\S]*name="drivetrain" required[\s\S]*name="firstRegistrationDate"[\s\S]*name="hasValidTuv"/);
  assert.match(source, /data-contact-details open[\s\S]*name="sellerName"[\s\S]*name="preferredContactMethod"/);
  assert.match(source, /control\.closest\("details"\)[\s\S]*disclosure\.open = true/);
  assert.match(source, /function updateProgressiveDetails/);
  assert.match(source, /function updateManualContactDisclosure/);
  assert.match(source, /data-local-preview=\{String\(import\.meta\.env\.DEV\)\}/);
  assert.match(source, /isLocalFormPreview = form instanceof HTMLFormElement[\s\S]*dataset\.localPreview === "true"[\s\S]*auth[\s\S]*!== "live"/);
  assert.match(source, /!getActiveAuthToken\(\) && !isLocalFormPreview/);
  assert.match(source, /if \(!isLocalFormPreview\) validateAuthToken\(\)/);
  assert.match(styles, /\.listing-details-disclosure > summary[\s\S]*min-height: 76px/);
  assert.match(styles, /\.listing-inline-settings > summary[\s\S]*min-height: 44px/);
  assert.match(workspaceEntry, /@import "\.\.\/components\/listing-form\.css"/);
});

test("AI seller assistant stays compact and rejects invented inspection claims", async () => {
  const source = await read("../src/pages/dashboard/new.astro");
  const styles = await read("../src/styles/premium-system.css");

  assert.match(source, /Фото → готовое объявление/);
  assert.match(source, /Стиль объявления/);
  assert.match(source, /sanitizeGeneratedSalesCopy/);
  assert.match(source, /на фото\|на фотограф[\s\S]{0,300}при осмотр/);
  assert.doesNotMatch(source, /Кузов .* выглядит аккуратно|Салон стоит отдельно проверить при осмотре/);
  assert.match(styles, /\.new-listing-hero \.ai-review-summary[\s\S]{0,1200}overflow-x: auto/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,180}animation: none/);
});

test("global seller CTA uses one name and canonical route", async () => {
  const [header, layout, home] = await Promise.all([
    read("../src/components/Header.astro"),
    read("../src/layouts/BaseLayout.astro"),
    read("../src/pages/index.astro"),
  ]);
  assert.match(header, /href="\/dashboard\/new"[^>]*>[\s\S]{0,160}messages\.navAddListing/);
  assert.match(home, /href="\/dashboard\/new"/);
  assert.match(layout, /href: "\/dashboard\/new"[\s\S]{0,120}label: messages\.navAddListing/);
});

test("dashboard data blocks use bounded retry and keep a user-scoped stale cache", async () => {
  const [dashboard, listings] = await Promise.all([
    read("../src/pages/dashboard/index.astro"),
    read("../src/pages/dashboard/listings.astro"),
  ]);
  assert.match(dashboard, /fetchWithRetry/);
  assert.match(listings, /Promise\.allSettled/);
  assert.match(dashboard, /getAuthUser\(\)\.id|getAuthUser\(\)\?\.id|userRaw\?\.id/);
  assert.match(listings, /getAuthUser\(\)\?\.id/);
  assert.match(`${dashboard}\n${listings}`, /window\.addEventListener\("online"/);
});
