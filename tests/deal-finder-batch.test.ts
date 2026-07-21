import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeTimestampValue, parseBatchArgs, runBatch } from "../scripts/deal-finder-analyze-listings.mjs";

test("batch CLI does nothing without explicit ids", async () => {
  const options = parseBatchArgs([]);
  assert.deepEqual(options.ids, []);
  assert.equal(options.dryRun, true);
  assert.deepEqual(await runBatch(options), []);
});

test("batch CLI defaults remain sequential, non-force and stop-on-error", () => {
  const options = parseBatchArgs(["--ids=2"]);
  assert.equal(options.dryRun, true);
  assert.equal(options.force, false);
  assert.equal(options.parallelism, 1);
  assert.equal(options.max, 1);
  assert.equal(options.stopOnError, true);
});

test("batch CLI accepts the approved four-listing plan", () => {
  const options = parseBatchArgs(["--ids=2,3,4,5", "--max=4", "--stop-on-error"]);
  assert.deepEqual(options.ids, [2, 3, 4, 5]);
  assert.equal(options.max, 4);
});

test("batch CLI allows one explicit repeat and rejects unsafe parallelism and overflow", () => {
  const repeat = parseBatchArgs(["--ids=2", "--force"]);
  assert.equal(repeat.force, true);
  assert.equal(parseBatchArgs(["--ids=2", "--force=false"]).force, false);
  assert.throws(() => parseBatchArgs(["--ids=2", "--parallelism=2"]), /PARALLELISM_NOT_ALLOWED/);
  assert.throws(() => parseBatchArgs(["--ids=2,3", "--max=1"]), /MAX_EXCEEDED/);
});

test("batch CLI keeps the Worker trigger separate from the Xano secret", () => {
  const script = readFileSync(new URL("../scripts/deal-finder-analyze-listings.mjs", import.meta.url), "utf8");
  assert.match(script, /triggerSecret: requiredEnvironment\("DEAL_FINDER_WORKER_TRIGGER_SECRET"\)/);
  assert.match(script, /xanoSecret: requiredEnvironment\("XANO_DEAL_FINDER_INGEST_SECRET"\)/);
  assert.match(script, /secretHeaders\(config\.triggerSecret\)/);
  assert.match(script, /secretHeaders\(config\.xanoSecret\)/);
});

test("batch timestamp helper accepts ISO, seconds and milliseconds", () => {
  assert.equal(normalizeTimestampValue("2026-07-16T09:00:00Z"), "2026-07-16T09:00:00Z");
  assert.equal(normalizeTimestampValue(1784192400), "2026-07-16T09:00:00.000Z");
  assert.equal(normalizeTimestampValue(1784192400000), "2026-07-16T09:00:00.000Z");
  assert.equal(normalizeTimestampValue(Number.NaN), null);
});
