import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = process.env.HTTP_TEST_PORT || "4349";
const baseUrl = `http://127.0.0.1:${port}`;
const wrangler = join(root, "node_modules", ".bin", "wrangler");
const integrationEnv = {
  ...process.env,
  I18N_ENABLED: "true",
  I18N_API_READ_ENABLED: "true",
  I18N_PUBLIC_ROUTES_ENABLED: "true",
};

const build = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], {
  cwd: root,
  env: integrationEnv,
  stdio: "inherit",
});
if (build.status !== 0) throw new Error(`Cloudflare integration build failed with exit code ${build.status}`);

if (!existsSync(join(root, "dist", "client", "_worker.js", "index.js"))) {
  throw new Error("Cloudflare Pages bundle is missing. Run npm run build first.");
}

const runtime = spawn(wrangler, ["pages", "dev", "dist/client", "--port", port, "--ip", "127.0.0.1"], {
  cwd: root,
  env: integrationEnv,
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
});
let runtimeLog = "";
for (const stream of [runtime.stdout, runtime.stderr]) {
  stream?.on("data", (chunk) => {
    runtimeLog = `${runtimeLog}${chunk}`.slice(-8000);
  });
}

const stopRuntime = async () => {
  if (runtime.exitCode !== null || !runtime.pid) return;
  try {
    process.kill(-runtime.pid, "SIGTERM");
  } catch {
    runtime.kill("SIGTERM");
  }
  await Promise.race([once(runtime, "exit"), new Promise((resolvePromise) => setTimeout(resolvePromise, 3000))]);
};

try {
  const deadline = Date.now() + 30000;
  let ready = false;
  while (Date.now() < deadline) {
    if (runtime.exitCode !== null) throw new Error(`Cloudflare runtime exited early.\n${runtimeLog}`);
    try {
      const response = await fetch(`${baseUrl}/privacy`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      // Runtime is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 350));
  }
  if (!ready) throw new Error(`Cloudflare runtime did not become ready.\n${runtimeLog}`);

  const requestedLocales = String(process.env.HTTP_TEST_LOCALES || process.env.HTTP_TEST_LOCALE || "")
    .split(",")
    .map((locale) => locale.trim())
    .filter(Boolean);
  const locales = requestedLocales.length ? [...new Set(requestedLocales)] : [""];
  for (const locale of locales) {
    const testArguments = ["scripts/http-public-seo-integration.mjs", "--base-url", baseUrl];
    if (locale) testArguments.push("--locale", locale);
    const testProcess = spawn(process.execPath, testArguments, {
      cwd: root,
      env: integrationEnv,
      stdio: "inherit",
    });
    const [exitCode] = await once(testProcess, "exit");
    if (exitCode !== 0) throw new Error(`HTTP integration test failed${locale ? ` for ${locale}` : ""} with exit code ${exitCode}`);
  }
} finally {
  await stopRuntime();
}
