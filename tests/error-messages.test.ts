import assert from "node:assert/strict";
import test from "node:test";

import { getFriendlyErrorMessage } from "../src/lib/errorMessages.ts";

test("does not describe a duplicate listing request as an existing account", () => {
  const message = getFriendlyErrorMessage(new Error("A record with this value already exists"));

  assert.match(message, /повторный запрос/i);
  assert.doesNotMatch(message, /войдите|аккаунт/i);
});

test("keeps explicit registration conflicts account-specific", () => {
  assert.match(getFriendlyErrorMessage("EMAIL_ALREADY_REGISTERED"), /войдите|аккаунт/i);
});
