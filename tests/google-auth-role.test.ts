import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("Google sign-in preserves roles for existing users", () => {
  const script = readFileSync(new URL("docs/xano/oauth-google-continue.xs", root), "utf8");
  const existingBranch = script.split("if ($existing_user != null) {")[1]?.split("else {")[0] || "";
  const newUserBranch = script.split("else {")[1] || "";

  assert.match(existingBranch, /db\.edit automarket_users/);
  assert.doesNotMatch(existingBranch, /role\s*:\s*"user"/);
  assert.match(newUserBranch, /db\.add automarket_users/);
  assert.match(newUserBranch, /role\s*:\s*"user"/);
});
