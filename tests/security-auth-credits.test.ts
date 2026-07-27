import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getRegistrationErrorCode, getRegistrationErrorMessage } from "../src/lib/registrationErrors.ts";

const root = new URL("..", import.meta.url);
const readProjectFile = (path: string) => readFileSync(new URL(path, root), "utf8");

test("registration creates only a server-owned ordinary user and wallet", () => {
  const script = readProjectFile("docs/xano/security-stop-risk/POST_auth_register.xs");
  const input = script.split("input {")[1]?.split("stack {")[0] || "";
  const create = script.split("db.add automarket_users")[1]?.split("db.get user_credits")[0] || "";

  assert.match(input, /text name/);
  assert.match(input, /email email/);
  assert.match(input, /password password/);
  for (const forbidden of ["role", "is_admin", "is_dealer", "credits", "ai_credits", "google_id", "email_verified", "blocked"]) {
    assert.doesNotMatch(input, new RegExp(`\\b${forbidden}\\b`));
  }
  assert.match(create, /role\s*:\s*"user"/);
  assert.match(script, /db\.add user_credits/);
  assert.match(script, /ai_credits\s*:\s*10/);
  assert.match(script, /security\.create_auth_token/);
});

test("duplicate password and OAuth identities stop before all registration writes", () => {
  const script = readProjectFile("docs/xano/security-stop-risk/POST_auth_register.xs");
  const duplicateGuard = script.split("if ($existing_user != null) {")[1]?.split("db.add automarket_users")[0] || "";

  assert.match(duplicateGuard, /HTTP\/1\.1 409 Conflict/);
  assert.match(duplicateGuard, /ACCOUNT_LINK_REQUIRED/);
  assert.match(duplicateGuard, /EMAIL_ALREADY_REGISTERED/);
  assert.doesNotMatch(duplicateGuard, /db\.(add|edit)/);
  assert.doesNotMatch(script, /db\.edit automarket_users/);
  assert.doesNotMatch(script, /debug\.log/);
});

test("duplicate registration cannot reset an administrator or inject privileged fields", () => {
  const script = readProjectFile("docs/xano/security-stop-risk/POST_auth_register.xs");
  const existingBranch = script.split("if ($existing_user != null) {")[1]?.split("db.add automarket_users")[0] || "";

  assert.doesNotMatch(existingBranch, /password\s*:/);
  assert.doesNotMatch(existingBranch, /role\s*:/);
  assert.doesNotMatch(existingBranch, /security\.create_auth_token/);
  assert.doesNotMatch(script, /1000000000|is_admin|is_dealer/);
});

test("me credits is authenticated, owner-scoped and side-effect free", () => {
  const script = readProjectFile("docs/xano/security-stop-risk/GET_me_credits.xs");

  assert.match(script, /auth = "automarket_users"/);
  assert.match(script, /error_type = "unauthorized"/);
  assert.match(script, /field_value = \$current_user\.id/);
  assert.match(script, /balance\s*:\s*\$balance/);
  assert.match(script, /wallet_type\s*:\s*"legacy_ai_credits"/);
  assert.doesNotMatch(script, /db\.(add|edit|patch|del|delete)/);
  assert.doesNotMatch(script, /\$input\.(?:id|user_id)|\bnow\b/);
  assert.doesNotMatch(script, /1000000000|ivanovdavid|role\s*:/i);
});

test("registration UI recognizes both safe conflict contracts", () => {
  const register = readProjectFile("src/pages/register.astro");

  assert.equal(getRegistrationErrorCode({ code: "EMAIL_ALREADY_REGISTERED" }), "EMAIL_ALREADY_REGISTERED");
  assert.equal(getRegistrationErrorCode({ payload: { code: "ACCOUNT_LINK_REQUIRED" } }), "ACCOUNT_LINK_REQUIRED");
  assert.match(getRegistrationErrorMessage({ code: "ACCOUNT_LINK_REQUIRED" }) || "", /связан с Google/);
  assert.match(register, /id="register-google-link"/);
  assert.match(register, /getRegistrationErrorMessage\(result\)/);
  assert.match(register, /registrationCode !== "ACCOUNT_LINK_REQUIRED"/);
});

test("admin role and credit migration is complete and idempotent", () => {
  const records = JSON.parse(
    readProjectFile("docs/xano/admin-security-remediation/migration-verification.json"),
  ) as Array<Record<string, unknown>>;

  assert.equal(records.length, 2);
  assert.deepEqual(records.map(({ user_id }) => user_id), [1, 15]);
  for (const record of records) {
    assert.equal(record.role_after, "admin");
    assert.equal(record.oauth_identity_unchanged, true);
    assert.equal(record.password_unchanged, true);
    assert.ok(Number(record.balance_after) >= 10_000);
    assert.match(String(record.idempotency_key), /^admin-test-grant-v1-\d+$/);
    assert.equal(record.rerun_transaction_count, 1);
  }
});

const aiEndpointIds = [3974045, 3979609];

for (const endpointId of aiEndpointIds) {
  test(`AI endpoint ${endpointId} uses ordinary authenticated credit accounting`, () => {
    const script = readProjectFile(`docs/xano/admin-security-remediation/${endpointId}.after.xs`);

    assert.match(script, /auth = "automarket_users"/);
    assert.match(script, /\$auth\.id/);
    assert.match(script, /error_type = "unauthorized"/);
    assert.match(script, /precondition \(\$credits\.ai_credits > 0\)/);
    assert.match(script, /(?:\$credits\.ai_credits|\$balance_before) - 1/);
    assert.match(script, /db\.edit user_credits/);
    assert.match(script, /db\.add credit_transactions/);
    assert.doesNotMatch(script, /ivanovdavid|1000000000|is_unlimited_admin/i);
    assert.doesNotMatch(script, /db\.edit automarket_users/);
    assert.match(script, /gpt-5\.6-luna/);
    assert.match(script, /store: false/);
  });
}

const adminEndpointIds = [3966702, 3966703, 3966704, 3968561, 3975051, 3975107, 3979595, 3981578];

for (const endpointId of adminEndpointIds) {
  test(`admin endpoint ${endpointId} authorizes by auth id and server role only`, () => {
    const script = readProjectFile(`docs/xano/admin-security-remediation/${endpointId}.after.xs`);
    const roleGuardIndex = script.indexOf('precondition ($admin_user.role == "admin")');
    const privateDataIndex = script.search(/db\.(?:get|query) car_listings|db\.edit car_listings/);

    assert.match(script, /auth = "automarket_users"/);
    assert.match(script, /field_value = \$auth\.id/);
    assert.match(script, /error_type = "unauthorized"/);
    assert.match(script, /error_type = "accessdenied"/);
    assert.ok(roleGuardIndex >= 0);
    assert.ok(privateDataIndex > roleGuardIndex);
    assert.doesNotMatch(script, /ivanovdavid|1000000000|admin_email|special_email/i);
  });
}

test("frontend admin gating is role-only", () => {
  const authClient = readProjectFile("src/lib/authClient.ts");
  const adminHelper = authClient.split("export function isAdminUser")[1]?.split("export function isDealFinderUser")[0] || "";
  const header = readProjectFile("src/components/Header.astro");
  const moderation = readProjectFile("src/pages/admin/moderation.astro");

  assert.match(adminHelper, /role === "admin"/);
  assert.doesNotMatch(adminHelper, /email|ownerEmails|super_admin|\bowner\b/i);
  assert.doesNotMatch(authClient, /ivanovdavid119|ivanovdavid19/i);
  assert.match(header, /isAdminUser/);
  assert.match(moderation, /isAdminUser/);
});

test("active remediation scripts contain no known privilege backdoor markers", () => {
  for (const endpointId of [...aiEndpointIds, ...adminEndpointIds]) {
    const script = readProjectFile(`docs/xano/admin-security-remediation/${endpointId}.after.xs`);
    assert.doesNotMatch(
      script,
      /ivanovdavid119@gmail\.com|ivanovdavid19@gmail\.com|1000000000|special_email|admin_email|superuser|is_unlimited_admin/i,
    );
  }
});
