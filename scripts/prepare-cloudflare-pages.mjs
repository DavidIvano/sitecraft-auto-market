import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = join(root, "dist", "client");
const serverDir = join(root, "dist", "server");
const workerDir = join(clientDir, "_worker.js");
const functionsPluginDir = join(workerDir, "pages-functions");
const wranglerBin = join(root, "node_modules", ".bin", "wrangler");
const generatedWranglerDeployDir = join(root, ".wrangler", "deploy");

function removeEnvironmentFiles(directory) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) removeEnvironmentFiles(path);
    else if (entry.name === ".env" || entry.name.startsWith(".env.") || entry.name === ".dev.vars" || entry.name.startsWith(".dev.vars.")) {
      rmSync(path, { force: true });
    }
  }
}

for (const required of [clientDir, join(serverDir, "entry.mjs"), join(serverDir, "chunks")]) {
  if (!existsSync(required)) {
    throw new Error(`Cloudflare build artifact is missing: ${required}`);
  }
}

rmSync(workerDir, { recursive: true, force: true });
mkdirSync(workerDir, { recursive: true });
cpSync(join(serverDir, "entry.mjs"), join(workerDir, "astro-entry.mjs"));
cpSync(join(serverDir, "chunks"), join(workerDir, "chunks"), { recursive: true });
cpSync(join(serverDir, "virtual_astro_middleware.mjs"), join(workerDir, "virtual_astro_middleware.mjs"));

execFileSync(wranglerBin, [
  "pages",
  "functions",
  "build",
  join(root, "functions"),
  "--outdir",
  functionsPluginDir,
  "--plugin",
  "--compatibility-date",
  "2026-07-20",
], { cwd: root, stdio: "inherit" });

writeFileSync(join(workerDir, "index.js"), `import astroWorker from "./astro-entry.mjs";
import createPagesFunctions from "./pages-functions/index.js";

const runPagesFunctions = createPagesFunctions({});

export default {
  async fetch(request, env, context) {
    const next = (nextRequest = request) => astroWorker.fetch(nextRequest, env, context);
    return runPagesFunctions({
      request,
      env,
      data: {},
      functionPath: "",
      next,
      waitUntil: context.waitUntil.bind(context),
      passThroughOnException() {},
    });
  },
};
`);

// Astro's Cloudflare adapter emits a Workers deploy redirect that makes
// subsequent `wrangler pages` commands use the wrong deployment mode.
rmSync(generatedWranglerDeployDir, { recursive: true, force: true });
removeEnvironmentFiles(join(root, "dist"));

console.log("Prepared Cloudflare Pages Advanced Mode bundle in dist/client/_worker.js");
