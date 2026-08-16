import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { onRequestGet, onRequestHead } from "../functions/api/r2-images/[[key]].ts";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("R2 image function returns image bytes with immutable metadata", async () => {
  const bytes = new Uint8Array([82, 73, 70, 70]);
  const response = await onRequestGet({
    env: {
      R2_BUCKET: {
        async get(key: string) {
          assert.equal(key, "listing-images/15/2026/07/photo.webp");
          return {
            body: bytes,
            httpEtag: '"photo-etag"',
            writeHttpMetadata(headers: Headers) {
              headers.set("content-type", "image/webp");
            },
          };
        },
      },
    },
    params: { key: ["listing-images", "15", "2026", "07", "photo.webp"] },
  } as never);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
});

test("R2 image function supports crawler HEAD checks without downloading bytes", async () => {
  const response = await onRequestHead({
    env: {
      R2_BUCKET: {
        async get(key: string) {
          assert.equal(key, "listing-images/15/photo.webp");
          return {
            body: new Uint8Array([1]),
            httpEtag: '"photo-etag"',
            writeHttpMetadata(headers: Headers) {
              headers.set("content-type", "image/webp");
            },
          };
        },
      },
    },
    params: { key: ["listing-images", "15", "photo.webp"] },
  } as never);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.equal(response.headers.get("etag"), '"photo-etag"');
  assert.equal(await response.text(), "");
});

test("R2 image function creates a bounded responsive variant through Images binding", async () => {
  const transformedBytes = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]);
  const transformer = {
    transform(options: Record<string, unknown>) {
      assert.deepEqual(options, { width: 480, fit: "scale-down" });
      return this;
    },
    async output(options: Record<string, unknown>) {
      assert.deepEqual(options, { format: "image/webp", quality: 68, anim: false });
      return { response: () => new Response(transformedBytes, { headers: { "content-type": "image/webp" } }) };
    },
  };
  const response = await onRequestGet({
    request: new Request("https://automarket.sitecraft.agency/api/r2-images/photo.webp?width=480&quality=68"),
    env: {
      R2_BUCKET: {
        async get() {
          return {
            body: new Uint8Array([1, 2, 3]),
            httpEtag: '"master"',
            writeHttpMetadata() {},
          };
        },
      },
      IMAGES: { input: () => transformer },
    },
    params: { key: ["photo.webp"] },
  } as never);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-sitecraft-image-variant"), "480w-q68");
  assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), transformedBytes);
});

test("R2 image function rejects missing and traversal keys", async () => {
  const env = { R2_BUCKET: { async get() { throw new Error("must not read bucket"); } } };
  for (const key of [undefined, ["..", "secret"]]) {
    const response = await onRequestGet({ env, params: { key } } as never);
    assert.equal(response.status, 404);
  }
});

test("Advanced Mode sends API image paths to Pages Functions before static assets", async () => {
  const prepare = await read("../scripts/prepare-cloudflare-pages.mjs");
  assert.match(prepare, /const isApiRoute = url\.pathname === "\/api" \|\| url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(prepare, /const isStaticAsset = !isApiRoute &&/);
  assert.match(prepare, /runPagesFunctions/);
});

test("new listing highlights only incomplete required controls and photos", async () => {
  const page = await read("../src/pages/dashboard/new.astro");
  const css = await read("../src/styles/global.css");
  assert.match(page, /function isRequiredControlComplete/);
  assert.match(page, /function updateRequiredFieldState/);
  assert.match(page, /control\.validity\.valid/);
  assert.match(page, /control\.type === "radio"/);
  assert.match(page, /control\.type === "file"/);
  assert.match(page, /classList\.toggle\("is-required-pending", pending\)/);
  assert.match(page, /id="photo-input"[\s\S]*?multiple[\s\S]*?required/);
  assert.match(page, /function showManualFieldErrors/);
  assert.match(page, /errorNode\.dataset\.manualFieldError = issue\.field/);
  assert.match(page, /aria-describedby/);
  assert.match(page, /Исправьте отмеченные поля/);
  assert.match(css, /\.is-required-pending:not\(\.is-invalid\)/);
  assert.match(css, /content: "Обязательно"/);
  assert.doesNotMatch(page, /is-required-pending[\s\S]{0,200}aria-invalid/);
});

test("public detail constrains modal and grid without horizontal overflow", async () => {
  const css = await read("../src/styles/global.css");
  assert.match(css, /\.detail-promotion-disclosure[\s\S]*?gap: 8px/);
  assert.match(css, /\.contact-seller-modal[\s\S]*?max-width: calc\(100dvw - 24px\)/);
  assert.match(css, /\.car-detail-grid > \*[\s\S]*?min-width: 0/);
  assert.match(css, /\.contact-seller-actions \.button[\s\S]*?overflow-wrap: anywhere/);
});
