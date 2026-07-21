import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { onRequestOptions, onRequestPost } from "../functions/api/upload-listing-images.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

function bucket(failAt = 0) {
  const puts: string[] = [];
  const deletes: string[] = [];
  return {
    puts,
    deletes,
    binding: {
      async put(key: string) {
        puts.push(key);
        if (failAt && puts.length === failAt) throw new Error("mock put failure");
      },
      async delete(key: string) { deletes.push(key); },
    },
  };
}

function env(overrides: Record<string, unknown> = {}) {
  const r2 = bucket();
  return {
    value: {
      R2_BUCKET: r2.binding,
      R2_PUBLIC_BASE_URL: "https://cdn.example.com",
      XANO_API_URL: "https://xano.example/api:test",
      ALLOWED_UPLOAD_ORIGINS: "https://sitecraft-auto-market.pages.dev,http://127.0.0.1:4322",
      ENVIRONMENT: "production",
      ...overrides,
    },
    r2,
  };
}

function request(method = "POST", origin = "https://sitecraft-auto-market.pages.dev", token = "valid") {
  const headers = new Headers({ Origin: origin });
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return new Request("https://sitecraft-auto-market.pages.dev/api/upload-listing-images", { method, headers });
}

function uploadRequest(files: File[], token = "valid") {
  const data = new FormData();
  files.forEach((file) => data.append("files", file));
  return new Request("https://sitecraft-auto-market.pages.dev/api/upload-listing-images", {
    method: "POST",
    headers: { Origin: "https://sitecraft-auto-market.pages.dev", Authorization: `Bearer ${token}` },
    body: data,
  });
}

function image(name = "car.webp", size = 10, type = "image/webp") {
  return new File([new Uint8Array(size)], name, { type });
}

async function body(response: Response) { return response.json() as Promise<Record<string, unknown>>; }

test("OPTIONS echoes only an explicitly allowed origin", async () => {
  const { value } = env();
  const allowed = await onRequestOptions({ request: request("OPTIONS", "http://127.0.0.1:4322", ""), env: value as never });
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get("Access-Control-Allow-Origin"), "http://127.0.0.1:4322");
  assert.equal(allowed.headers.get("Vary"), "Origin");

  const denied = await onRequestOptions({ request: request("OPTIONS", "https://malicious.example", ""), env: value as never });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("Access-Control-Allow-Origin"), null);
  assert.equal((await body(denied)).code, "ORIGIN_NOT_ALLOWED");
});

test("missing Authorization returns 401 without touching R2", async () => {
  const { value, r2 } = env();
  const response = await onRequestPost({ request: request("POST", undefined, ""), env: value as never });
  assert.equal(response.status, 401);
  assert.equal(r2.puts.length, 0);
});

test("missing Xano URL fails closed with 503", async () => {
  const { value, r2 } = env({ XANO_API_URL: undefined, PUBLIC_XANO_API_URL: undefined });
  const response = await onRequestPost({ request: request(), env: value as never });
  assert.equal(response.status, 503);
  assert.equal((await body(response)).code, "AUTH_CONFIGURATION_MISSING");
  assert.equal(r2.puts.length, 0);
});

test("invalid token returns 401 without touching R2", async () => {
  globalThis.fetch = async () => new Response("{}", { status: 401 });
  const { value, r2 } = env();
  const response = await onRequestPost({ request: request(), env: value as never });
  assert.equal(response.status, 401);
  assert.equal(r2.puts.length, 0);
});

test("Xano failure and invalid success payload fail closed", async () => {
  for (const mocked of [new Response("down", { status: 500 }), new Response("{}", { status: 200 })]) {
    globalThis.fetch = async () => mocked.clone();
    const { value, r2 } = env();
    const response = await onRequestPost({ request: request(), env: value as never });
    assert.ok(response.status === 503 || response.status === 401);
    assert.equal(r2.puts.length, 0);
  }
});

test("Xano root and nested user payloads both authorize only positive integer IDs", async () => {
  for (const payload of [{ id: 42 }, { user: { id: 43 } }]) {
    globalThis.fetch = async () => Response.json(payload);
    const { value, r2 } = env();
    const response = await onRequestPost({ request: uploadRequest([image()]), env: value as never });
    assert.equal(response.status, 200);
    assert.equal(r2.puts.length, 1);
  }

  globalThis.fetch = async () => Response.json({ user: { id: 0 } });
  const { value, r2 } = env();
  const response = await onRequestPost({ request: uploadRequest([image()]), env: value as never });
  assert.equal(response.status, 401);
  assert.equal(r2.puts.length, 0);
});

test("missing R2 configuration returns a safe 503", async () => {
  const missingBinding = env({ R2_BUCKET: undefined });
  const response = await onRequestPost({ request: request(), env: missingBinding.value as never });
  assert.equal((await body(response)).code, "R2_BINDING_MISSING");

  const missingUrl = env({ R2_PUBLIC_BASE_URL: undefined });
  const response2 = await onRequestPost({ request: request(), env: missingUrl.value as never });
  assert.equal((await body(response2)).code, "R2_PUBLIC_URL_MISSING");
});

test("server rejects empty, unsupported, oversized, and too many files", async () => {
  globalThis.fetch = async () => Response.json({ id: 42 });
  const cases: Array<[File[], number, string]> = [
    [[], 400, "FILES_REQUIRED"],
    [[image("empty.webp", 0)], 400, "EMPTY_FILE"],
    [[image("bad.svg", 10, "image/svg+xml")], 400, "UNSUPPORTED_FILE_TYPE"],
    [[image("text.txt", 10, "text/plain")], 400, "UNSUPPORTED_FILE_TYPE"],
    [[image("large.webp", 1024 * 1024 + 1)], 413, "FILE_TOO_LARGE"],
    [Array.from({ length: 9 }, (_, index) => image(`${index}.webp`)), 400, "TOO_MANY_FILES"],
  ];
  for (const [files, status, code] of cases) {
    const { value, r2 } = env();
    const response = await onRequestPost({ request: uploadRequest(files), env: value as never });
    assert.equal(response.status, status);
    assert.equal((await body(response)).code, code);
    assert.equal(r2.puts.length, 0);
  }
});

test("valid authenticated upload uses verified user id and returns HTTPS URL", async () => {
  globalThis.fetch = async () => Response.json({ id: 42 });
  const { value, r2 } = env();
  const response = await onRequestPost({ request: uploadRequest([image()]), env: value as never });
  const payload = await body(response) as { success: boolean; images: Array<{ key: string; url: string; is_primary: boolean }> };
  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.match(payload.images[0].key, /^listing-images\/42\/\d{4}\/\d{2}\/[a-f0-9-]+\.webp$/);
  assert.match(payload.images[0].url, /^https:\/\/cdn\.example\.com\//);
  assert.equal(payload.images[0].is_primary, true);
  assert.equal(r2.puts.length, 1);
});

test("partial batch failure deletes only keys created by this request", async () => {
  globalThis.fetch = async () => Response.json({ id: 77 });
  const mock = bucket(2);
  const { value } = env({ R2_BUCKET: mock.binding });
  const response = await onRequestPost({ request: uploadRequest([image("1.webp"), image("2.webp")]), env: value as never });
  assert.equal(response.status, 500);
  assert.equal(mock.puts.length, 2);
  assert.deepEqual(mock.deletes, [mock.puts[0]]);
});
