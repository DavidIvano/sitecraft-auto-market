import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("dashboard summary remains a bounded responsive grid", async () => {
  const css = await read("src/styles/components/dashboard.css");
  assert.match(css, /\.app-shell-workspace \.dashboard-summary-grid \{[\s\S]*?display: grid/);
  assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 1180px\)[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?dashboard-summary-grid[\s\S]*?minmax\(0, 1fr\)/);
  assert.match(css, /\.dashboard-summary-card \{[\s\S]*?display: grid/);
});

test("auth pages do not render validation errors before interaction", async () => {
  const [login, register, publicCss] = await Promise.all([
    read("src/pages/login.astro"),
    read("src/pages/register.astro"),
    read("src/styles/components/public-pages.css"),
  ]);
  assert.match(login, /id="password-login-message"[^>]*hidden/);
  assert.match(register, /id="register-message"[^>]*hidden/);
  assert.match(login, /passwordMessage\.hidden = false/);
  assert.match(register, /message\.hidden = false/);
  assert.equal((login.match(/class="auth-form-note"/g) || []).length, 1);
  assert.equal((register.match(/class="auth-form-note"/g) || []).length, 1);
  assert.match(publicCss, /\.auth-form-note/);
});

test("support content is user-facing and seller steps stay balanced", async () => {
  const [support, css] = await Promise.all([
    read("src/pages/support.astro"),
    read("src/styles/components/public-pages.css"),
  ]);
  assert.match(support, /Публикация объявления/);
  assert.match(support, /Вход и аккаунт/);
  assert.doesNotMatch(support, /Доступ к модерации закрыт/);
  assert.match(css, /\.steps-grid \{[\s\S]*?repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 860px\)[\s\S]*?\.steps-grid[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 480px\)[\s\S]*?\.sell-window \.hero-actions/);
});

test("dashboard status never renders an account email", async () => {
  const dashboard = await read("src/pages/dashboard/index.astro");
  assert.doesNotMatch(dashboard, /Вы вошли как \$\{user\.email\}/);
  assert.doesNotMatch(dashboard, /Вход сохранён для \$\{userRaw\.email\}/);
  assert.match(dashboard, /class="dashboard-auth-status"/);
  assert.match(dashboard, /\[0, 1, 2, 3\]/);
});

test("seller form labels the visible photo stage as step one", async () => {
  const page = await read("src/pages/dashboard/new.astro");
  assert.match(page, /data-quiz-step="0"[\s\S]*?<span class="section-step">1<\/span>[\s\S]*?<h2>Фото и описание<\/h2>/);
});
