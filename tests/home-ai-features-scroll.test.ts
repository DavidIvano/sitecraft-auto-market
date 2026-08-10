import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("AI feature cards become a discoverable horizontal rail on mobile and tablet", async () => {
  const [homepage, styles] = await Promise.all([
    readFile(new URL("../src/pages/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/global.css", import.meta.url), "utf8"),
  ]);

  assert.match(homepage, /<div class="ai-feature-grid" role="list">/);
  assert.equal((homepage.match(/class="ai-feature-card" role="listitem"/g) || []).length, 4);
  assert.match(styles, /@media \(max-width: 980px\)[\s\S]*?\.home-ai-features \.ai-feature-grid \{[\s\S]*?grid-auto-flow: column/);
  assert.match(styles, /\.home-ai-features \.ai-feature-grid \{[\s\S]*?overflow-x: auto[\s\S]*?scroll-snap-type: x mandatory/);
  assert.match(styles, /\.home-ai-features \.ai-feature-card \{[\s\S]*?scroll-snap-align: start[\s\S]*?scroll-snap-stop: always/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.home-ai-features \.ai-feature-grid \{\s*grid-auto-columns: calc\(100% - 42px\)/);
});
