import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("build and Pages pipeline verify hashed assets and static routing", async () => {
  const packageJson = await read("../package.json");
  const prepare = await read("../scripts/prepare-cloudflare-pages.mjs");
  const verify = await read("../scripts/verify-built-assets.mjs");
  const routes = await read("../public/_routes.json");
  const headers = await read("../public/_headers");

  assert.match(packageJson, /node scripts\/verify-built-assets\.mjs/);
  assert.match(prepare, /env\.ASSETS\?\.fetch/);
  assert.match(prepare, /url\.pathname\.startsWith\("\/_astro\/"\)/);
  assert.match(prepare, /text\\\\\/html/);
  assert.match(prepare, /status: 404/);
  assert.match(verify, /statSync\(localPath\)\.size === 0/);
  assert.match(routes, /"\/_astro\/\*"/);
  assert.match(headers, /\/dashboard\/\*[\s\S]*private, no-store, max-age=0/);
  assert.match(headers, /\/_astro\/\*[\s\S]*immutable/);
});

test("new listing uses real accessible photo buttons and bounded validation", async () => {
  const page = await read("../src/pages/dashboard/new.astro");
  const css = await read("../src/styles/global.css");
  const design = await read("../src/styles/components/forms.css");

  assert.match(page, /<button class="photo-dropzone"[^>]*data-photo-select/);
  assert.match(page, /<button class="ai-draft-dropzone"[^>]*data-ai-photo-select/);
  assert.match(page, /data-max-size="8388608"/);
  assert.match(page, /new Set\(\["image\/avif", "image\/webp", "image\/jpeg", "image\/png"\]\)/);
  assert.match(page, /Повторяющиеся фотографии не добавлены/);
  assert.match(page, /Пустые файлы не добавлены/);
  assert.match(css, /\.photo-input[\s\S]*clip-path: inset\(50%\)/);
  assert.match(design, /input\.photo-input[\s\S]*min-height: 0/);
  assert.doesNotMatch(css, /\.listing-form-enhanced label\s*\{\s*pointer-events:\s*none/);
});

test("mobile header uses Lucide Menu and X with keyboard-safe closing", async () => {
  const header = await read("../src/components/Header.astro");
  const icons = await read("../src/lib/appIcons.ts");
  const css = await read("../src/styles/global.css");

  assert.match(header, /data-lucide="menu"/);
  assert.match(header, /data-lucide="x"/);
  assert.match(header, /event\.key === "Escape"/);
  assert.match(header, /menuToggle\.focus\(\)/);
  assert.match(header, /document\.addEventListener\("pointerdown"/);
  assert.match(icons, /\bMenu\b/);
  assert.doesNotMatch(css, /\.menu-toggle span\s*\{[\s\S]*background:\s*currentColor/);
  assert.doesNotMatch(css, /\.menu-toggle\.is-open span:nth-child/);
});
