import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("AI feature cards become a discoverable horizontal rail on mobile and tablet", async () => {
  const [homepage, styles, systemStyles] = await Promise.all([
    readFile(new URL("../src/pages/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/global.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/premium-system.css", import.meta.url), "utf8"),
  ]);

  assert.match(homepage, /<div class="ai-feature-grid" role="list">/);
  assert.equal((homepage.match(/class="ai-feature-card" role="listitem"/g) || []).length, 4);
  assert.match(styles, /@media \(max-width: 980px\)[\s\S]*?\.home-ai-features \.ai-feature-grid \{[\s\S]*?grid-auto-flow: column/);
  assert.match(styles, /\.home-ai-features \.ai-feature-grid \{[\s\S]*?overflow-x: auto[\s\S]*?scroll-snap-type: x mandatory/);
  assert.match(styles, /\.home-ai-features \.ai-feature-card \{[\s\S]*?scroll-snap-align: start[\s\S]*?scroll-snap-stop: always/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.home-ai-features \.ai-feature-grid \{\s*grid-auto-columns: calc\(100% - 42px\)/);
  assert.match(systemStyles, /@media \(max-width: 640px\)[\s\S]*?\.section-heading > :first-child \{[\s\S]*?width:\s*100%[\s\S]*?text-align:\s*start/);
  assert.match(systemStyles, /\.home-ai-features \.section-heading h2 \{[\s\S]*?max-width:\s*100%/);
  assert.match(systemStyles, /:where\(\.category-track, \.brand-track\) \{[\s\S]*?padding:\s*8px 4px 16px/);
  assert.match(systemStyles, /:where\([\s\S]*?\.category-track \.category-slide[\s\S]*?\.brand-track \.brand-chip-card[\s\S]*?\.home-ai-features \.ai-feature-card[\s\S]*?\):hover \{\s*transform:\s*none/);
});
