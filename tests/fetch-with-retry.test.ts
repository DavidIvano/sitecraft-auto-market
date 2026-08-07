import assert from "node:assert/strict";
import test from "node:test";

import { fetchWithRetry, isRetryableStatus, parseRetryAfter } from "../src/lib/http/fetchWithRetry.ts";

const noWait = async () => {};

test("retries 503 and then returns 200", async () => {
  let calls = 0;
  const response = await fetchWithRetry("https://example.test", {}, {
    sleep: noWait,
    jitterRatio: 0,
    fetchImpl: (async () => new Response(null, { status: ++calls === 1 ? 503 : 200 })) as typeof fetch,
  });
  assert.equal(response.status, 200);
  assert.equal(calls, 2);
});

test("honors Retry-After for 429", async () => {
  const waits: number[] = [];
  let calls = 0;
  await fetchWithRetry("https://example.test", {}, {
    jitterRatio: 0,
    sleep: async (delay) => { waits.push(delay); },
    fetchImpl: (async () => ++calls === 1
      ? new Response(null, { status: 429, headers: { "Retry-After": "2" } })
      : new Response(null, { status: 200 })) as typeof fetch,
  });
  assert.deepEqual(waits, [2_000]);
});

test("retries a network error but never retries 401, 404, or 422", async () => {
  let networkCalls = 0;
  const networkResponse = await fetchWithRetry("https://example.test", {}, {
    sleep: noWait,
    fetchImpl: (async () => {
      networkCalls += 1;
      if (networkCalls === 1) throw new TypeError("network");
      return new Response(null, { status: 200 });
    }) as typeof fetch,
  });
  assert.equal(networkResponse.status, 200);

  for (const status of [401, 404, 422]) {
    let calls = 0;
    const response = await fetchWithRetry("https://example.test", {}, {
      sleep: noWait,
      fetchImpl: (async () => { calls += 1; return new Response(null, { status }); }) as typeof fetch,
    });
    assert.equal(response.status, status);
    assert.equal(calls, 1);
  }
});

test("stops after three failed attempts", async () => {
  let calls = 0;
  const response = await fetchWithRetry("https://example.test", {}, {
    sleep: noWait,
    fetchImpl: (async () => { calls += 1; return new Response(null, { status: 503 }); }) as typeof fetch,
  });
  assert.equal(response.status, 503);
  assert.equal(calls, 3);
});

test("deduplicates matching in-flight GET requests", async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    await Promise.resolve();
    return Response.json({ ok: true });
  }) as typeof fetch;
  const [first, second] = await Promise.all([
    fetchWithRetry("https://example.test", {}, { dedupeKey: "same", fetchImpl }),
    fetchWithRetry("https://example.test", {}, { dedupeKey: "same", fetchImpl }),
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(await first.json(), { ok: true });
  assert.deepEqual(await second.json(), { ok: true });
});

test("classifies retry statuses and Retry-After values", () => {
  assert.equal(isRetryableStatus(408), true);
  assert.equal(isRetryableStatus(500), true);
  assert.equal(isRetryableStatus(403), false);
  assert.equal(parseRetryAfter("3"), 3_000);
  assert.equal(parseRetryAfter("invalid"), null);
});
