import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("..", import.meta.url);
const readProjectFile = (path: string) => readFileSync(new URL(path, root), "utf8");

test("temporary auth errors preserve a previously confirmed session", () => {
  const authClient = readProjectFile("src/lib/authClient.ts");
  const nonOkBranch = authClient.split("if (!response.ok) {")[1]?.split("}")[0] || "";

  assert.match(nonOkBranch, /if \(cachedUser\) return cachedUser/);
  assert.doesNotMatch(nonOkBranch, /clearAuth\(\)/);
  assert.match(authClient, /AUTH_USER_CACHE_MAX_AGE_MS = 5 \* 60 \* 1000/);
});

test("only an explicit unauthorized response clears the active session", () => {
  const authClient = readProjectFile("src/lib/authClient.ts");
  const unauthorizedBranch = authClient.split("if (response.status === 401) {")[1]?.split("return null;")[0] || "";

  assert.match(unauthorizedBranch, /clearAuth\(\)/);
  assert.match(authClient, /getAuthToken\(\) === token/);
  assert.match(authClient, /AUTH_UNAUTHORIZED_RETRY_COUNT = 1/);
  assert.match(authClient, /response\.status !== 401 \|\| attempt === AUTH_UNAUTHORIZED_RETRY_COUNT/);
  assert.match(authClient, /cache: "no-store"/);
});

test("parallel current-user checks share one backend request", () => {
  const authClient = readProjectFile("src/lib/authClient.ts");

  assert.match(authClient, /currentUserRequestKey === requestKey/);
  assert.match(authClient, /return currentUserRequest/);
  assert.match(authClient, /currentUserRequest = \(async \(\) =>/);
});

test("protected pages confirm a 401 before redirecting or clearing the session", () => {
  const authClient = readProjectFile("src/lib/authClient.ts");
  const listings = readProjectFile("src/pages/dashboard/listings.astro");
  const editor = readProjectFile("src/pages/dashboard/listings/edit.astro");
  const newListing = readProjectFile("src/pages/dashboard/new.astro");
  const moderation = readProjectFile("src/pages/admin/moderation.astro");
  const googleCallback = readProjectFile("src/pages/auth/google/callback.astro");

  assert.match(authClient, /export async function isSessionConfirmedExpired/);
  [listings, editor, newListing, moderation].forEach((source) => {
    assert.match(source, /isSessionConfirmedExpired/);
  });
  assert.match(googleCallback, /fetchCurrentUser\(apiUrl, token, \{ force: true \}\)/);
  assert.doesNotMatch(listings + editor + newListing + moderation, /status === 401[\s\S]{0,160}clearAuth\(\)/);
});

test("protected moderation exposes seller contact fields only to admins", () => {
  const endpoint = readProjectFile("docs/xano-critical-security-remediation/get-admin-moderation.xs");
  const page = readProjectFile("src/pages/admin/moderation.astro");

  assert.match(endpoint, /auth = "automarket_users"/);
  assert.match(endpoint, /Admin access required/);
  assert.doesNotMatch(endpoint, /unpick:\["seller_email", "seller_phone", "seller_name"/);
  assert.match(page, /Контакт продавца/);
  assert.match(page, /mailto:/);
  assert.match(page, /tel:/);
});

test("Google sessions are issued for the same 60-day period used by the browser", () => {
  const endpoint = readProjectFile("docs/xano/oauth-google-continue.xs");
  assert.match(endpoint, /expiration = 5184000/);
});
