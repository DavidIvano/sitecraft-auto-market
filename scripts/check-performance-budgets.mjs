import { readFile, readdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const root = new URL("../", import.meta.url);
const config = JSON.parse(await readFile(new URL("performance-budgets.json", root), "utf8"));
const assetDirectory = new URL("dist/client/_astro/", root);
const files = await readdir(assetDirectory);
const results = [];

const check = (name, actual, budget) => {
  const passed = actual <= budget;
  results.push({ name, actual, budget, passed });
  if (!passed) process.exitCode = 1;
};

for (const [prefix, budgetKey] of [["shared.", "sharedCssGzipBytes"], ["public.", "publicCssGzipBytes"], ["workspace.", "workspaceCssGzipBytes"]]) {
  const filename = files.find((file) => file.startsWith(prefix) && file.endsWith(".css"));
  if (!filename) throw new Error(`Missing built CSS entry: ${prefix}`);
  const bytes = await readFile(new URL(filename, assetDirectory));
  check(`${prefix.slice(0, -1)} CSS gzip`, gzipSync(bytes).byteLength, config.assets[budgetKey]);
}

const jsGzipSizes = await Promise.all(files.filter((file) => file.endsWith(".js")).map(async (filename) => ({
  filename,
  bytes: gzipSync(await readFile(new URL(filename, assetDirectory))).byteLength,
})));
const heicDecoderChunks = jsGzipSizes.filter(({ filename }) => filename.startsWith("heic-to."));
if (heicDecoderChunks.length !== 1) throw new Error(`Expected one lazy HEIC decoder chunk, found ${heicDecoderChunks.length}.`);
check("lazy HEIC decoder gzip", heicDecoderChunks[0].bytes, config.assets.heicDecoderGzipBytes);

const webpFallbackWasm = await Promise.all(files.filter((filename) => filename.startsWith("webp_enc") && filename.endsWith(".wasm")).map(async (filename) => ({
  filename,
  bytes: (await readFile(new URL(filename, assetDirectory))).byteLength,
})));
if (webpFallbackWasm.length !== 2) throw new Error(`Expected baseline and SIMD WebP fallback codecs, found ${webpFallbackWasm.length}.`);
for (const codec of webpFallbackWasm) {
  check(`lazy WebP fallback (${codec.filename})`, codec.bytes, config.assets.webpFallbackWasmBytes);
}

const regularJavaScript = jsGzipSizes.filter(({ filename }) => !filename.startsWith("heic-to."));
const largestJavaScript = regularJavaScript.sort((left, right) => right.bytes - left.bytes)[0];
check(`largest JavaScript gzip (${largestJavaScript.filename})`, largestJavaScript.bytes, config.assets.largestJavaScriptGzipBytes);

const uiLogo = await readFile(new URL("public/sitecraft-logo-ui.webp", root));
check("UI logo", uiLogo.byteLength, config.assets.uiLogoBytes);

const compressionSource = await readFile(new URL("src/lib/imageCompression.ts", root), "utf8");
const declaredImageBudget = Number(compressionSource.match(/IMAGE_MASTER_MAX_BYTES\s*=\s*(\d+)\s*\*\s*1024/)?.[1] || 0) * 1024;
check("browser image master", declaredImageBudget, config.assets.imageMasterBytes);

for (const result of results) {
  console.log(`${result.passed ? "PASS" : "FAIL"} ${result.name}: ${result.actual} / ${result.budget}`);
}
if (process.exitCode) throw new Error("Performance budget exceeded.");
