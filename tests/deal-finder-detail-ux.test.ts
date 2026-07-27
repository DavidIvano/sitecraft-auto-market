import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderDealFinderDetailView } from "../src/lib/deal-finder/detail-view.ts";
import { normalizeDealFinderReturnUrl } from "../src/lib/deal-finder/routes.ts";
import {
  chooseTranslationQueueAction,
  isAllowedTranslationTarget,
  safeTranslationText,
  translationIsStale,
} from "../src/lib/deal-finder/translation.ts";
import type { DealFinderListingDetails, DealFinderTranslation } from "../src/lib/deal-finder/types.ts";

const root = new URL("..", import.meta.url);
const readProjectFile = (path: string) => readFileSync(new URL(path, root), "utf8");

const details: DealFinderListingDetails = {
  listing: {
    id: 59,
    platform: "kleinanzeigen",
    external_id: "detail-59",
    source_url: "https://www.kleinanzeigen.de/s-anzeige/detail-59",
    title: "Volkswagen Golf <script>alert(1)</script>",
    description: "Erste Zeile\nZweite Zeile <b>nicht als HTML</b>",
    price: 4500,
    currency: "EUR",
    brand: "Volkswagen",
    model: "Golf",
    year: 2012,
    mileage: 186000,
    fuel_type: "Diesel",
    transmission: "Schaltgetriebe",
    power_kw: 77,
    city: "Braunschweig",
    postal_code: "38100",
    source_image_url: "https://images.example.com/one.jpg",
    source_images: [
      "https://images.example.com/one.jpg",
      "https://images.example.com/two.webp",
      "https://images.example.com/blocked.svg",
      "https://images.example.com/three.jpg",
    ],
    image_status: "available",
    first_seen_at: "2026-07-20T10:00:00.000Z",
    last_seen_at: "2026-07-21T10:00:00.000Z",
    last_checked_at: "2026-07-21T10:00:00.000Z",
    source_status: "active",
    user_status: "new",
    unavailable_checks: 0,
    is_new: true,
    is_saved: false,
    is_viewed: false,
    is_hidden: false,
  },
  analysis: {
    id: 1,
    listing_id: 59,
    status: "completed",
    analysis_version: "deal-finder-v1",
    deal_score: 72,
    risk_score: 41,
    liquidity_score: 66,
    data_quality_score: 80,
    confidence_score: 0.74,
    recommendation: "REVIEW",
    ai_summary: "Проверить документы.",
    positive_signals: ["Цена"],
    negative_signals: ["Пробег"],
    missing_information: ["TUV"],
    known_defects: [],
    recommended_questions: ["Когда сервис?"],
  },
  search: null,
  allowed_actions: { view: true, save: true, hide: true, reanalyze: true },
};

function renderedDetail() {
  return renderDealFinderDetailView({
    details,
    workspaceHtml: '<section data-workspace-fixture><button type="submit">Сохранить заметку</button></section>',
    returnHref: "/dashboard/deal-finder/?page=3&sort=price_asc",
  });
}

test("detail layout keeps description and full AI in main content before the sticky sidebar", () => {
  const html = renderedDetail();
  const descriptionIndex = html.indexOf("deal-detail-description");
  const analysisIndex = html.indexOf("deal-detail-analysis");
  const sidebarIndex = html.indexOf("deal-detail-sidebar");
  assert.ok(descriptionIndex > 0 && analysisIndex > descriptionIndex && sidebarIndex > analysisIndex);
  assert.doesNotMatch(html.slice(sidebarIndex), /deal-detail-description-text/);
  assert.match(html, /deal-detail-layout/);
  const css = readProjectFile("src/styles/global.css");
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\) clamp\(320px, 28vw, 380px\)/);
  assert.match(css, /\.deal-detail-sidebar-panel\s*\{[^}]*position:\s*sticky/s);
  assert.match(css, /@media \(max-width: 860px\)[\s\S]*\.deal-detail-layout\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
});

test("compact gallery renders one active image and all safe images as lazy thumbnails/lightbox sources", () => {
  const html = renderedDetail();
  assert.equal((html.match(/data-gallery-main-image/g) || []).length, 1);
  assert.equal((html.match(/data-gallery-thumbnail=/g) || []).length, 3);
  assert.match(html, /data-lightbox-sources=/);
  assert.match(html, /data-gallery-previous/);
  assert.match(html, /data-gallery-next/);
  assert.doesNotMatch(html, /blocked\.svg/);
  assert.match(html, /loading="lazy"/);
  const client = readProjectFile("src/lib/deal-finder/client.ts");
  assert.match(client, /preload\.src = src/);
  assert.match(client, /Math\.abs\(deltaX\) > 48/);
  assert.match(client, /data-gallery-counter/);
});

test("description is escaped, preserves line structure and exposes Russian translation states", () => {
  const html = renderedDetail();
  assert.match(html, /lang="de" data-translation-original/);
  assert.match(html, /lang="ru" data-translation-result hidden/);
  assert.match(html, /Erste Zeile\nZweite Zeile &lt;b&gt;nicht als HTML&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /data-translation-request/);
  assert.match(html, /data-translation-view="original"/);
  assert.match(html, /data-translation-view="translated"/);
  const css = readProjectFile("src/styles/global.css");
  assert.match(css, /white-space:\s*pre-line/);
  assert.match(css, /max-width:\s*80ch/);
  assert.match(css, /hyphens:\s*auto/);
});

test("one action bar owns save, source, viewed, hide and compare states with Lucide icons", () => {
  const html = renderedDetail();
  assert.equal((html.match(/data-detail-action-bar/g) || []).length, 1);
  assert.equal((html.match(/data-deal-action="save"/g) || []).length, 1);
  for (const icon of ["bookmark", "external-link", "eye", "eye-off", "columns-2", "languages"]) {
    assert.match(html, new RegExp(`data-lucide="${icon}"`));
  }
  assert.match(html, /aria-pressed="false"/);
  const css = readProjectFile("src/styles/global.css");
  assert.match(css, /\.deal-action\.is-save/);
  assert.match(css, /\.deal-action\.is-viewed/);
  assert.match(css, /\.deal-action\.is-hide/);
  assert.match(css, /\.deal-action\.is-restore/);
  assert.match(css, /\.deal-action\.is-compare/);
  assert.match(css, /html\.image-lightbox-open \.deal-detail-action-bar\s*\{\s*display:\s*none/);
});

test("action and translation requests reject duplicate clicks and recover controls after failures", () => {
  const client = readProjectFile("src/lib/deal-finder/client.ts");
  assert.match(client, /if \(!id \|\| button\.disabled\) return/);
  assert.match(client, /button\.disabled = true/);
  assert.match(client, /catch \(error\)[\s\S]*button\.disabled = false/);
  assert.match(client, /if \(!translate \|\| translate\.disabled\) return/);
  assert.match(client, /translate\.disabled = true/);
  assert.match(client, /finally \{[\s\S]*translate\.disabled = false/);
  assert.doesNotMatch(client, /api\.openai\.com|OPENAI_API_KEY|X-Deal-Finder-Secret/);
});

test("return navigation preserves a safe Deal Finder list URL and rejects other paths", () => {
  assert.equal(
    normalizeDealFinderReturnUrl("https://automarket.sitecraft.agency/dashboard/deal-finder/?page=3&sort=price_asc"),
    "/dashboard/deal-finder/?page=3&sort=price_asc",
  );
  assert.equal(normalizeDealFinderReturnUrl("https://evil.example/phishing"), "/dashboard/deal-finder/");
  assert.equal(normalizeDealFinderReturnUrl("/dashboard/deal-finder/listing/?id=59"), "/dashboard/deal-finder/");
});

test("translation queue reuses completed and active hashes, and creates after a hash change", () => {
  const base: DealFinderTranslation = { id: 1, listing_id: 59, source_language: "de", target_language: "ru", status: "completed", source_text_hash: "same" };
  assert.equal(chooseTranslationQueueAction([base], "same").action, "cached");
  assert.equal(chooseTranslationQueueAction([{ ...base, status: "processing" }], "same").action, "active");
  assert.equal(chooseTranslationQueueAction([base], "changed").action, "create");
  assert.equal(translationIsStale("old", "new"), true);
  assert.equal(isAllowedTranslationTarget("ru"), true);
  assert.equal(isAllowedTranslationTarget("en"), false);
  assert.equal(safeTranslationText('<script>alert(1)</script><b>Текст</b>'), "alert(1)Текст");
});

test("translation Xano endpoint is owner-scoped, cached and uses Luna without mutating the source", () => {
  const endpoint = readProjectFile("docs/xano/deal-finder-frontend-translate-description.xs");
  const table = readProjectFile("docs/xano/deal-finder-translations.xs");
  assert.match(endpoint, /auth = "automarket_users"/);
  assert.match(endpoint, /\$current_user\.role == "admin"/);
  assert.match(endpoint, /\$current_user\.role == "deal_finder_admin"/);
  assert.match(endpoint, /deal_finder_listings\.user_id == \$current_user\.id/);
  assert.match(endpoint, /error_type = "notfound"/);
  assert.match(endpoint, /\$input\.target_language == "ru"/);
  assert.match(endpoint, /\$input\.source_language == "de"/);
  assert.match(endpoint, /\$listing\.description\|sha256/);
  assert.match(endpoint, /status == "completed"/);
  assert.match(endpoint, /status: "processing"/);
  assert.match(endpoint, /api\.openai\.com\/v1\/responses/);
  assert.match(endpoint, /gpt-5\.6-luna/);
  assert.match(endpoint, /store: false/);
  assert.match(endpoint, /strict: true/);
  assert.doesNotMatch(endpoint, /db\.edit deal_finder_listings/);
  assert.match(table, /user_id[\s\S]*deal_finder_listing_id[\s\S]*target_language[\s\S]*source_hash/);
  assert.match(table, /type: "btree\|unique"/);
});

test("detail remains noindex and absent from the public sitemap", () => {
  const page = readProjectFile("src/pages/dashboard/deal-finder/listing/index.astro");
  const sitemap = readProjectFile("src/pages/sitemap.xml.ts");
  assert.match(page, /noindex/);
  assert.doesNotMatch(sitemap, /deal-finder/);
});
