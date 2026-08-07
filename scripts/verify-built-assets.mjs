import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = join(root, "dist", "client");

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

if (!existsSync(clientDir)) {
  throw new Error(`Build directory is missing: ${clientDir}`);
}

const htmlFiles = walk(clientDir).filter((path) => path.endsWith(".html"));
const workerDir = join(clientDir, "_worker.js");
const workerFiles = existsSync(workerDir)
  ? walk(workerDir).filter((path) => /\.(?:js|mjs)$/.test(path))
  : [];
const missing = [];
const checked = new Set();
const assetPattern = /<(?:script|link)\b[^>]*(?:src|href)=["'](\/_astro\/[^"'#?]+)(?:[?#][^"']*)?["'][^>]*>/gi;
const workerAssetPattern = /["'](\/_astro\/[A-Za-z0-9._-]+)["']/g;

function checkPublicAsset(publicPath, sourceFile) {
  if (checked.has(publicPath)) return;
  checked.add(publicPath);
  const localPath = join(clientDir, publicPath.replace(/^\//, ""));
  if (!existsSync(localPath) || !statSync(localPath).isFile() || statSync(localPath).size === 0) {
    missing.push(`${publicPath} referenced by ${sourceFile}`);
  }
}

for (const htmlFile of htmlFiles) {
  const html = readFileSync(htmlFile, "utf8");
  for (const match of html.matchAll(assetPattern)) {
    checkPublicAsset(match[1], htmlFile);
  }
}

if (htmlFiles.length === 0) {
  for (const workerFile of workerFiles) {
    const workerSource = readFileSync(workerFile, "utf8");
    for (const match of workerSource.matchAll(workerAssetPattern)) {
      checkPublicAsset(match[1], workerFile);
    }
  }
}

if (htmlFiles.length === 0 && workerFiles.length === 0) {
  throw new Error("Neither prerendered HTML nor an SSR Worker was found in dist/client");
}
if (checked.size === 0) {
  throw new Error("No /_astro asset references found in the built pages or SSR Worker");
}
if (missing.length) {
  throw new Error(`Broken built asset references:\n${missing.join("\n")}`);
}

console.log(`Verified ${checked.size} built asset references from ${htmlFiles.length ? `${htmlFiles.length} HTML files` : `${workerFiles.length} SSR Worker files`}.`);
