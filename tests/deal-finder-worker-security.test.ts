import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { handleRequest } from "../workers/deal-finder-sync/src/index.ts";
import type { DealFinderSyncEnv } from "../workers/deal-finder-sync/src/env.ts";

const root = new URL("..", import.meta.url);
const readProjectFile = (path: string) => readFileSync(new URL(path, root), "utf8");
const triggerHeader = (value: string) => ({ "X-Deal-Finder-Secret": value });
const baseEnv: DealFinderSyncEnv = {
  DEAL_FINDER_WORKER_TRIGGER_SECRET: "trigger-only-test-value",
  XANO_DEAL_FINDER_INGEST_SECRET: "xano-only-test-value",
  OPENAI_API_KEY: "openai-only-test-value",
  KLEINANZEIGEN_AGENT_API_KEY: "provider-only-test-value",
  XANO_API_BASE_URL: "https://xano.example.test/api:group",
  DEAL_FINDER_MANUAL_SYNC_ENABLED: "false",
  DEAL_FINDER_MANUAL_AI_ENABLED: "false",
  DEAL_FINDER_SYNC_ENABLED: "false",
  DEAL_FINDER_AI_ENABLED: "false",
};

test("manual Worker routes reject a missing trigger secret", async () => {
  const response = await handleRequest(new Request("https://worker.example/analyze", { method: "POST" }), baseEnv);
  assert.equal(response.status, 401);
  assert.equal((await response.json() as { code: string }).code, "UNAUTHORIZED");
});

test("manual Worker routes reject an incorrect trigger secret", async () => {
  const response = await handleRequest(new Request("https://worker.example/analyze", { method: "POST", headers: triggerHeader("incorrect") }), baseEnv);
  assert.equal(response.status, 401);
});

test("Xano secret is never accepted as the incoming trigger secret", async () => {
  const response = await handleRequest(new Request("https://worker.example/analyze", { method: "POST", headers: triggerHeader(baseEnv.XANO_DEAL_FINDER_INGEST_SECRET!) }), baseEnv);
  assert.equal(response.status, 401);
});

test("OpenAI and provider keys are never accepted as incoming trigger secrets", async () => {
  for (const key of [baseEnv.OPENAI_API_KEY!, baseEnv.KLEINANZEIGEN_AGENT_API_KEY!]) {
    const response = await handleRequest(new Request("https://worker.example/analyze", { method: "POST", headers: triggerHeader(key) }), baseEnv);
    assert.equal(response.status, 401);
  }
});

test("the correct trigger secret authenticates before the manual gate", async () => {
  const response = await handleRequest(new Request("https://worker.example/analyze", { method: "POST", headers: triggerHeader(baseEnv.DEAL_FINDER_WORKER_TRIGGER_SECRET!) }), baseEnv);
  assert.equal(response.status, 503);
  assert.equal((await response.json() as { code: string }).code, "AI_DISABLED");
});

test("disabled manual sync performs no network calls", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => { calls += 1; throw new Error("unexpected network call"); }) as typeof fetch;
  try {
    for (const path of ["/sync", "/sync/dry-run"]) {
      const response = await handleRequest(new Request(`https://worker.example${path}`, { method: "POST", headers: triggerHeader(baseEnv.DEAL_FINDER_WORKER_TRIGGER_SECRET!) }), baseEnv);
      assert.equal(response.status, 503);
      assert.equal((await response.json() as { code: string }).code, "SYNC_DISABLED");
    }
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("disabled manual AI performs no network calls", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => { calls += 1; throw new Error("unexpected network call"); }) as typeof fetch;
  try {
    for (const path of ["/analyze", "/analyze/dry-run"]) {
      const response = await handleRequest(new Request(`https://worker.example${path}`, { method: "POST", headers: triggerHeader(baseEnv.DEAL_FINDER_WORKER_TRIGGER_SECRET!) }), baseEnv);
      assert.equal(response.status, 503);
      assert.equal((await response.json() as { code: string }).code, "AI_DISABLED");
    }
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("trigger secret is not forwarded to Xano", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let receivedXanoSecret = "";
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    receivedXanoSecret = new Headers(init?.headers).get("X-Deal-Finder-Secret") || "";
    return Response.json({ data: [] });
  }) as typeof fetch;
  try {
    const env = { ...baseEnv, DEAL_FINDER_MANUAL_AI_ENABLED: "true" };
    const response = await handleRequest(new Request("https://worker.example/analyze/dry-run", { method: "POST", headers: triggerHeader(env.DEAL_FINDER_WORKER_TRIGGER_SECRET!) }), env);
    assert.equal(response.status, 200);
    assert.equal(receivedXanoSecret, env.XANO_DEAL_FINDER_INGEST_SECRET);
    assert.notEqual(receivedXanoSecret, env.DEAL_FINDER_WORKER_TRIGGER_SECRET);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("health returns only the documented safe booleans and labels", async () => {
  const response = await handleRequest(new Request("https://worker.example/health"), baseEnv);
  const payload = await response.json() as Record<string, unknown>;
  assert.deepEqual(payload, {
    ok: true,
    service: "sitecraft-deal-finder-sync",
    source: "kleinanzeigen_agent",
    xanoConfigured: true,
    providerConfigured: true,
    openaiConfigured: true,
    manualSyncEnabled: false,
    manualAiEnabled: false,
    scheduledSyncEnabled: false,
  });
  const serialized = JSON.stringify(payload);
  for (const secret of [
    baseEnv.DEAL_FINDER_WORKER_TRIGGER_SECRET!,
    baseEnv.XANO_DEAL_FINDER_INGEST_SECRET!,
    baseEnv.OPENAI_API_KEY!,
    baseEnv.KLEINANZEIGEN_AGENT_API_KEY!,
    baseEnv.XANO_API_BASE_URL!,
  ]) assert.doesNotMatch(serialized, new RegExp(secret));
});

test("incoming authentication reads only the dedicated trigger variable", () => {
  const source = readProjectFile("workers/deal-finder-sync/src/index.ts");
  const authLine = source.split("\n").find((line) => line.includes("constantTimeSecretEqual(request.headers")) || "";
  assert.match(authLine, /DEAL_FINDER_WORKER_TRIGGER_SECRET/);
  assert.doesNotMatch(authLine, /XANO_DEAL_FINDER_INGEST_SECRET|OPENAI_API_KEY|KLEINANZEIGEN_AGENT_API_KEY/);
});

test("browser modules contain no server secret names", () => {
  const browserSource = [
    "src/lib/deal-finder/api.ts",
    "src/lib/deal-finder/client.ts",
    "src/lib/deal-finder/analysis-view.ts",
  ].map(readProjectFile).join("\n");
  assert.doesNotMatch(browserSource, /DEAL_FINDER_WORKER_TRIGGER_SECRET|XANO_DEAL_FINDER_INGEST_SECRET|OPENAI_API_KEY|KLEINANZEIGEN_AGENT_API_KEY/);
});

test("Cloudflare artifact preparation removes environment files from dist", () => {
  const prepare = readProjectFile("scripts/prepare-cloudflare-pages.mjs");
  assert.match(prepare, /removeEnvironmentFiles\(join\(root, "dist"\)\)/);
  assert.match(prepare, /entry\.name === "\.dev\.vars"/);
  assert.match(prepare, /entry\.name\.startsWith\("\.env\."\)/);
});
