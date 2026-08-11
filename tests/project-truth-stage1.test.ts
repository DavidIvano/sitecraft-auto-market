import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("project status records working device locale detection instead of the stale claim", async () => {
  const status = await readProjectFile("PROJECT_STATUS_AND_ROADMAP_RU.md");

  assert.match(status, /Выбор языка устройства уже работает/);
  assert.match(status, /неизвестный `hi-IN,hi` \| fallback `lang="en"`/);
  assert.doesNotMatch(status, /Автоматическое определение языка устройства \*\*пока не реализовано\*\*/);
  assert.doesNotMatch(status, /Accept-Language` не анализируется/);
});

test("current Xano manifest distinguishes released and missing contracts", async () => {
  const manifest = await readProjectFile("docs/xano/CURRENT_ENDPOINT_MANIFEST_RU.md");

  assert.match(manifest, /3995775 \| POST \| `\/dashboard\/listings\/\{id\}\/promote` \| WORKING/);
  assert.match(manifest, /3997839 \| POST \| `\/deal-finder\/listings\/\{id\}\/translate-description` \| WORKING/);
  assert.match(manifest, /`POST \/purchases\/create`/);
  assert.match(manifest, /`GET \/dealer-profile`/);
  assert.match(manifest, /MISSING/);
});

test("production UI does not expose actions whose backend is missing", async () => {
  const [layout, pricing, newListing, payment, moderation, dealer] = await Promise.all([
    readProjectFile("src/layouts/BaseLayout.astro"),
    readProjectFile("src/pages/pricing.astro"),
    readProjectFile("src/pages/dashboard/new.astro"),
    readProjectFile("src/pages/payment/success.astro"),
    readProjectFile("src/pages/admin/moderation.astro"),
    readProjectFile("src/pages/dashboard/dealer.astro"),
  ]);

  assert.doesNotMatch(layout, /href: "\/dashboard\/dealer"/);
  assert.doesNotMatch(pricing, />Купить<|>Выбрать</);
  assert.doesNotMatch(newListing, /Купить 10/);
  assert.doesNotMatch(payment, /apply-purchase-button|purchaseApply/);
  assert.match(moderation, /const candidates: ModerationAction\[\] = \["approve", "reject", "block", "delete", "sold"\]/);
  assert.doesNotMatch(moderation, /data-image-action|data-add-images-for/);
  assert.match(dealer, /UI-прототип/);
  assert.doesNotMatch(dealer, /fetch\(|type="submit"|Подключить Dealer Plan/);
});

test("prototype admin pages do not call unavailable Xano endpoints", async () => {
  const pages = await Promise.all([
    readProjectFile("src/pages/admin/dealers.astro"),
    readProjectFile("src/pages/admin/purchases.astro"),
    readProjectFile("src/pages/admin/paid-products.astro"),
  ]);

  for (const page of pages) {
    assert.match(page, /UI-прототип/);
    assert.doesNotMatch(page, /fetch\(/);
  }
});
