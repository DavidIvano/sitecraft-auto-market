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
const missing = [];
const checked = new Set();
const assetPattern = /<(?:script|link)\b[^>]*(?:src|href)=["'](\/_astro\/[^"'#?]+)(?:[?#][^"']*)?["'][^>]*>/gi;

for (const htmlFile of htmlFiles) {
  const html = readFileSync(htmlFile, "utf8");
  for (const match of html.matchAll(assetPattern)) {
    const publicPath = match[1];
    if (checked.has(publicPath)) continue;
    checked.add(publicPath);
    const localPath = join(clientDir, publicPath.replace(/^\//, ""));
    if (!existsSync(localPath) || !statSync(localPath).isFile() || statSync(localPath).size === 0) {
      missing.push(`${publicPath} referenced by ${htmlFile}`);
    }
  }
}

if (htmlFiles.length === 0) {
  throw new Error("No HTML files found in dist/client");
}
if (checked.size === 0) {
  throw new Error("No /_astro asset references found in built HTML");
}
if (missing.length) {
  throw new Error(`Broken built asset references:\n${missing.join("\n")}`);
}

console.log(`Verified ${checked.size} built asset references across ${htmlFiles.length} HTML files.`);
