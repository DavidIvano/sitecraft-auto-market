import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("..", import.meta.url);
const readProjectFile = (path: string) => readFileSync(new URL(path, root), "utf8");

test("login and register share one equal-column auth shell", () => {
  const shell = readProjectFile("src/components/auth/AuthShell.astro");
  const login = readProjectFile("src/pages/login.astro");
  const register = readProjectFile("src/pages/register.astro");
  assert.match(login, /import AuthShell/);
  assert.match(register, /import AuthShell/);
  assert.match(login, /<AuthShell/);
  assert.match(register, /<AuthShell/);
  assert.match(shell, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(shell, /align-items: stretch/);
  assert.match(shell, /height: 100%/);
  assert.match(shell, /@media \(max-width: 820px\)[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.doesNotMatch(login + register, /auth-avatar|>SC</);
});

test("auth controls are labelled, password-manager friendly and touch safe", () => {
  const shell = readProjectFile("src/components/auth/AuthShell.astro");
  const login = readProjectFile("src/pages/login.astro");
  const register = readProjectFile("src/pages/register.astro");
  assert.match(shell, /min-height: 48px/);
  assert.match(login, /for="login-email"/);
  assert.match(login, /id="login-email"[\s\S]*autocomplete="email"/);
  assert.match(login, /id="login-password"[\s\S]*autocomplete="current-password"/);
  assert.match(register, /for="register-password-confirm"/);
  assert.match(register, /autocomplete="new-password"/);
  assert.match(login + register, /aria-pressed="false"/);
  assert.doesNotMatch(login + register, /set:html/);
});

test("auth endpoints, OAuth redirect and post-login redirect remain intact", () => {
  const login = readProjectFile("src/pages/login.astro");
  const register = readProjectFile("src/pages/register.astro");
  assert.match(login, /\/oauth\/google\/init/);
  assert.match(login, /\/auth\/google\/callback/);
  assert.match(login, /fetch\(`\$\{apiUrl\}\/auth\/login`/);
  assert.match(register, /fetch\(`\$\{apiUrl\}\/auth\/register`/);
  assert.match(login + register, /setAuthToken\(token\)/);
  assert.match(login + register, /consumeNext\("\/dashboard"\)/);
  assert.match(login, /setAuthButtonBusy\(button, true/);
  assert.match(register, /setAuthButtonBusy\(submit, true/);
});
