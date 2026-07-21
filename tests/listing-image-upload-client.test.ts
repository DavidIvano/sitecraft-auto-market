import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const uploadModulePath = new URL("../src/lib/listingImageUpload.ts", import.meta.url);

async function source() {
  return readFile(uploadModulePath, "utf8");
}

test("upload uses the shared auth source and lets the browser set multipart Content-Type", async () => {
  const moduleSource = await source();
  assert.match(moduleSource, /import \{ getAuthToken \} from "\.\/authClient"/);
  assert.match(moduleSource, /const authToken = String\(getAuthToken\(\) \|\| ""\)\.trim\(\)/);
  assert.match(moduleSource, /new Headers\(\{ Authorization: `Bearer \$\{authToken\}` \}\)/);
  assert.doesNotMatch(moduleSource, /"Content-Type": "multipart\/form-data"/);
});

test("missing shared auth token exits before any FormData or fetch work", async () => {
  const moduleSource = await source();
  const tokenGuard = moduleSource.indexOf('throw new Error("Сессия истекла. Войдите снова.")');
  const formData = moduleSource.indexOf("const formData = new FormData()");
  const uploadFetch = moduleSource.indexOf("const response = await fetch(uploadUrl");

  assert.ok(tokenGuard >= 0);
  assert.ok(formData > tokenGuard);
  assert.ok(uploadFetch > tokenGuard);
});
