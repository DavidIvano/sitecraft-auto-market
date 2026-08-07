import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isSafeLightboxImageUrl } from "../src/lib/media/lightbox.ts";

const root = new URL("..", import.meta.url);
const readProjectFile = (path: string) => readFileSync(new URL(path, root), "utf8");

test("lightbox accepts HTTPS raster sources and the local placeholder only", () => {
  assert.equal(isSafeLightboxImageUrl("https://images.example.com/car.webp"), true);
  assert.equal(isSafeLightboxImageUrl("https://cdn.example.com/image?id=12"), true);
  assert.equal(isSafeLightboxImageUrl("/deal-finder-placeholder.svg"), true);
  assert.equal(isSafeLightboxImageUrl("https://images.example.com/icon.svg"), false);
  assert.equal(isSafeLightboxImageUrl("javascript:alert(1)"), false);
  assert.equal(isSafeLightboxImageUrl("data:image/png;base64,abc"), false);
  assert.equal(isSafeLightboxImageUrl("http://images.example.com/car.jpg"), false);
});

test("one global native dialog owns close, navigation, zoom and focus restoration", () => {
  const component = readProjectFile("src/components/media/ImageLightbox.astro");
  const module = readProjectFile("src/lib/media/lightbox.ts");
  const layout = readProjectFile("src/layouts/BaseLayout.astro");
  assert.match(component, /<dialog class="image-lightbox" id="site-image-lightbox"/);
  assert.match(layout, /<ImageLightbox \/>/);
  assert.match(module, /dialog\.showModal\(\)/);
  assert.match(module, /event\.target === dialog/);
  assert.match(module, /dialog\.addEventListener\("cancel"/);
  assert.match(module, /event\.key === "Escape"[\s\S]*close\(\)/);
  assert.match(module, /returnFocus\?\.focus/);
  assert.match(module, /document\.documentElement\.classList\.add\("image-lightbox-open"\)/);
  assert.match(module, /activeIndex = \(nextIndex \+ items\.length\) % items\.length/);
  assert.match(module, /count\.value = `\$\{activeIndex \+ 1\} \/ \$\{items\.length\}`/);
  assert.match(module, /event\.key === "ArrowLeft"/);
  assert.match(module, /Math\.abs\(deltaX\) > 48/);
  assert.match(module, /MAX_SCALE = 3/);
  assert.match(module, /viewport\.addEventListener\("dblclick"/);
  assert.match(module, /pointers\.size === 2/);
});

test("vehicle galleries use the shared trigger while logos and icons do not", () => {
  const files = [
    "src/pages/cars/[slug].astro",
    "src/pages/dashboard/listings.astro",
    "src/pages/dashboard/listings/edit.astro",
    "src/pages/dashboard/new.astro",
    "src/pages/admin/moderation.astro",
    "src/lib/deal-finder/client.ts",
  ].map(readProjectFile);
  files.forEach((source) => assert.match(source, /data-lightbox-trigger/));
  assert.match(files[0], /data-lightbox-sources=\{JSON\.stringify\(galleryImages\)\}/);
  assert.match(files[5], /JSON\.stringify\(lightboxImages\)/);
  assert.doesNotMatch(readProjectFile("src/lib/publicCarCard.ts"), /data-lightbox-trigger/);
  assert.match(readProjectFile("src/components/CarCard.astro"), /renderPublicCarCardMarkup/);
  assert.match(readProjectFile("src/pages/cars/index.astro"), /renderPublicCarCardMarkup/);
  const header = readProjectFile("src/components/Header.astro");
  const layout = readProjectFile("src/layouts/BaseLayout.astro");
  assert.doesNotMatch(header, /data-lightbox-trigger/);
  assert.doesNotMatch(layout.split("<ImageLightbox />")[0], /sitecraft-logo\.png[^\n]*data-lightbox-trigger/);
});

test("lightbox viewport owns the full stage and navigation overlays it", () => {
  const css = readProjectFile("src/styles/global.css");
  const stage = css.match(/\.image-lightbox-stage\s*\{[^}]+\}/)?.[0] || "";
  const viewport = css.match(/\.image-lightbox-viewport\s*\{[^}]+\}/)?.[0] || "";
  const navigation = css.match(/\.image-lightbox-nav\s*\{[^}]+\}/g)?.find((rule) => /position:\s*absolute/.test(rule)) || "";
  assert.match(stage, /grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.doesNotMatch(stage, /52px/);
  assert.match(viewport, /width:\s*100%/);
  assert.match(viewport, /position:\s*relative/);
  assert.match(viewport, /grid-column:\s*1/);
  assert.match(navigation, /position:\s*absolute/);
  assert.match(css, /\.image-lightbox-nav\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(css, /\.image-lightbox-viewport img\s*\{[^}]*object-fit:\s*contain[^}]*object-position:\s*center/s);
  assert.match(css, /\.image-lightbox-viewport img\s*\{[^}]*width:\s*100%[^}]*height:\s*100%/s);
  assert.match(css, /\.image-lightbox-viewport img\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0/s);
  assert.doesNotMatch(css, /grid-template-columns:\s*52px\s+minmax\(0, 1fr\)\s+52px/);
});
