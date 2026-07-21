import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("..", import.meta.url);
const readProjectFile = (path: string) => readFileSync(new URL(path, root), "utf8");

test("gallery thumbnails render real images instead of cropped CSS backgrounds", () => {
  const staticDetail = readProjectFile("src/pages/cars/[slug].astro");
  const liveDetail = readProjectFile("src/pages/cars/detail.astro");
  const styles = readProjectFile("src/styles/global.css");

  assert.match(staticDetail, /data-slide-src=\{imageUrl\}/);
  assert.match(staticDetail, /aria-pressed=\{index === 0 \? "true" : "false"\}/);
  assert.match(staticDetail, /loading="lazy"/);
  assert.match(staticDetail, /decoding="async"/);
  assert.doesNotMatch(staticDetail, /style=\{`background-image:url/);
  assert.doesNotMatch(liveDetail, /style="background-image:url/);
  assert.equal(existsSync(new URL("functions/cars/[slug].ts", root)), false);
  assert.match(styles, /\.gallery-thumb img\s*\{[\s\S]*?object-fit:\s*contain/);
  assert.match(styles, /\.gallery-thumb img\s*\{[\s\S]*?height:\s*100%/);
});
