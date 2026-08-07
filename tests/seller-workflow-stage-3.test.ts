import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("seller workflow has three steps, one submit action, and AI as a helper", async () => {
  const source = await read("../src/pages/dashboard/new.astro");
  assert.equal((source.match(/data-quiz-jump=/g) || []).length, 3);
  assert.match(source, /Фото[\s\S]*Данные автомобиля[\s\S]*Проверка и отправка/);
  assert.match(source, /data-open-ai-helper>Заполнить данные с AI/);
  assert.equal((source.match(/data-quiz-submit/g) || []).length, 2);
  assert.doesNotMatch(source, /data-side-submit/);
  assert.match(source, /LOCAL_DRAFT_KEY/);
  assert.match(source, /LOCAL_DRAFT_FIELDS[\s\S]{0,500}"sellerPhone"/);
  assert.match(source, /LOCAL_DRAFT_FIELDS[\s\S]{0,700}"sellerEmail"/);
  assert.match(source, /submissionId:\s*ensureManualSubmissionId\(\)/);
});

test("global seller CTA uses one name and canonical route", async () => {
  const [header, layout, home] = await Promise.all([
    read("../src/components/Header.astro"),
    read("../src/layouts/BaseLayout.astro"),
    read("../src/pages/index.astro"),
  ]);
  for (const source of [header, home]) {
    assert.match(source, /href="\/dashboard\/new"[^>]*>[\s\S]{0,120}Продать авто</);
  }
  assert.match(layout, /href: "\/dashboard\/new"[\s\S]{0,120}label: "Добавить объявление"/);
  assert.doesNotMatch(`${header}\n${layout}`, /href:\s*"\/sell"/);
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
