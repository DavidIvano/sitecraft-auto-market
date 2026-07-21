import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { dealFinderMockListings } from "../src/lib/deal-finder/mock-data.ts";
import { applyDealFinderScoreQuery } from "../src/lib/deal-finder/score-query.ts";
import { mergeImportedDealFinderListing, normalizeExternalListingId, normalizeSourceUrl } from "../src/lib/deal-finder/normalization.ts";
import { normalizeDealFinderListResponse } from "../src/lib/deal-finder/response.ts";
import { decodeDealFinderText } from "../src/lib/deal-finder/text.ts";
import { detailUrl, normalizeDealFinderListingId } from "../src/lib/deal-finder/routes.ts";

const root = new URL("..", import.meta.url);
const readProjectFile = (path: string) => readFileSync(new URL(path, root), "utf8");

test("Deal Finder decodes source HTML entities for display", () => {
  assert.equal(decodeDealFinderText("Automatik10&#x2F;2012 &amp; TÜV"), "Automatik10/2012 & TÜV");
});

test("Deal Finder normalizes source URLs and removes tracking parameters", () => {
  assert.equal(
    normalizeSourceUrl("https://www.kleinanzeigen.de/s-anzeige/test/?utm_source=x&fbclid=abc&keep=yes#ignore"),
    "https://www.kleinanzeigen.de/s-anzeige/test?keep=yes",
  );
  assert.equal(normalizeExternalListingId("  test   001  "), "test 001");
  assert.equal(normalizeSourceUrl("javascript:alert(1)"), null);
});

test("Deal Finder image component delegates URL safety to the shared formatter", () => {
  const formatter = readProjectFile("src/lib/deal-finder/formatters.ts");
  const component = readProjectFile("src/components/deal-finder/DealFinderImage.astro");

  assert.match(formatter, /url\.protocol === "https:"/);
  assert.match(formatter, /\\\.svg\(\?:\$\|\\\?\)/);
  assert.match(component, /isSafeDealFinderImageUrl\(src\)/);
  assert.match(component, /referrerpolicy="no-referrer"/);
});

test("repeat imports preserve user flags while external details update", () => {
  const existing = dealFinderMockListings.find((listing) => listing.is_saved)!;
  const merged = mergeImportedDealFinderListing(existing, {
    title: "Updated title",
    description: "Updated source data",
    price: 4999,
    source_image_url: "https://images.example.invalid/updated.jpg",
    last_seen_at: "2026-07-16T10:00:00.000Z",
    content_hash: "df_updated",
  });

  assert.equal(merged.title, "Updated title");
  assert.equal(merged.is_saved, true);
  assert.equal(merged.is_hidden, existing.is_hidden);
  assert.equal(merged.is_viewed, existing.is_viewed);
  assert.equal(merged.user_status, existing.user_status);
});

test("test and ingest payload validation specify closed bounds", () => {
  const validation = readProjectFile("src/lib/deal-finder/validation.ts");

  assert.match(validation, /source_url must be a valid https URL/);
  assert.match(validation, /price", 0, 1_000_000/);
  assert.match(validation, /year", 1900/);
  assert.match(validation, /source_type is invalid/);
  assert.match(validation, /listings must contain 1 to/);
});

test("Deal Finder stays feature-flagged, noindexed and absent from sitemap", () => {
  const config = readProjectFile("src/lib/config.ts");
  const layout = readProjectFile("src/layouts/BaseLayout.astro");
  const sitemap = readProjectFile("src/pages/sitemap.xml.ts");

  assert.match(config, /PUBLIC_DEAL_FINDER_ENABLED === "true"/);
  assert.match(layout, /noindex, nofollow, noarchive/);
  assert.doesNotMatch(sitemap, /deal-finder/);
});

test("authorized users can reach Deal Finder from tablet navigation and workspaces", () => {
  const layout = readProjectFile("src/layouts/BaseLayout.astro");
  const header = readProjectFile("src/components/Header.astro");
  const dashboard = readProjectFile("src/pages/dashboard/index.astro");
  const moderation = readProjectFile("src/pages/admin/moderation.astro");

  assert.ok(layout.indexOf('href: "/dashboard/deal-finder"') < layout.indexOf('href: "/sell"'));
  [layout, header, dashboard, moderation].forEach((source) => {
    assert.match(source, /data-deal-finder-only/);
    assert.match(source, /\/dashboard\/deal-finder/);
  });
});

test("Deal Finder detail URL supports every positive Xano id without static paths", () => {
  assert.equal(detailUrl(6), "/dashboard/deal-finder/listing/?id=6");
  assert.equal(detailUrl(999999), "/dashboard/deal-finder/listing/?id=999999");
  assert.equal(normalizeDealFinderListingId("1"), "1");
  assert.equal(normalizeDealFinderListingId("0005"), "5");
  assert.equal(normalizeDealFinderListingId("999999"), "999999");
  assert.equal(normalizeDealFinderListingId(""), null);
  assert.equal(normalizeDealFinderListingId("abc"), null);
  assert.equal(normalizeDealFinderListingId("-1"), null);
  assert.equal(normalizeDealFinderListingId("0"), null);
});

test("universal Deal Finder detail route validates the query before mounting", () => {
  const detailPage = readProjectFile("src/pages/dashboard/deal-finder/listing/index.astro");
  const oldDynamicPage = new URL("src/pages/dashboard/deal-finder/listings/[id].astro", root);

  assert.equal(existsSync(oldDynamicPage), false);
  assert.match(detailPage, /new URLSearchParams\(window\.location\.search\)\.get\("id"\)/);
  assert.match(detailPage, /if \(root && id\)[\s\S]*mountDealFinderDetail\(root, id\)/);
  assert.match(detailPage, /Предложение не указано/);
  assert.doesNotMatch(detailPage, /getStaticPaths|connectedXanoListingIds/);
  assert.match(detailPage, /noindex/);
});

test("Deal Finder cards generate only the universal detail route", () => {
  const client = readProjectFile("src/lib/deal-finder/client.ts");
  const card = readProjectFile("src/components/deal-finder/DealFinderCard.astro");
  const sitemap = readProjectFile("src/pages/sitemap.xml.ts");

  assert.match(client, /detailUrl\(listing\.id\)/);
  assert.match(card, /detailUrl\(listing\.id\)/);
  assert.doesNotMatch(client, /dashboard\/deal-finder\/listings\//);
  assert.doesNotMatch(card, /dashboard\/deal-finder\/listings\//);
  assert.doesNotMatch(sitemap, /deal-finder/);
});

test("unknown valid Deal Finder ids reach the API and map 404 safely", () => {
  const client = readProjectFile("src/lib/deal-finder/client.ts");
  const api = readProjectFile("src/lib/deal-finder/api.ts");
  const states = readProjectFile("src/lib/accessState.ts");

  assert.match(client, /getDealFinderListing\(id\)/);
  assert.match(client, /getAccessStateForHttpError\(error\.status, error\.code\)/);
  assert.match(states, /status === 404[\s\S]*not_found/);
  assert.match(states, /Предложение не найдено/);
  assert.match(api, /API_ROUTES\.dealFinderListing\(id\)/);
});

test("Deal Finder frontend API reuses shared auth and normalizes pagination", () => {
  const api = readProjectFile("src/lib/deal-finder/api.ts");
  const normalized = normalizeDealFinderListResponse({
    listings: dealFinderMockListings.slice(0, 2),
    pagination: { page: "2", per_page: "2", total: "5", total_pages: "3", has_next: true, has_previous: true },
  });

  assert.match(api, /import \{ fetchCurrentUser, getAuthToken \} from "\.\.\/authClient"/);
  assert.match(api, /headers\.set\("Authorization", `Bearer \$\{token\}`\)/);
  assert.match(api, /AUTH_STATE_MISMATCH/);
  assert.doesNotMatch(api, /DEAL_FINDER_INTERNAL_SECRET|X-Deal-Finder-Secret/);
  assert.equal(normalized.data.length, 2);
  assert.deepEqual(normalized.pagination, {
    page: 2,
    per_page: 2,
    total: 5,
    total_pages: 3,
    has_next: true,
    has_previous: true,
  });
});

test("Deal Finder mock filters and allowed sorts remain deterministic", () => {
  const api = readProjectFile("src/lib/deal-finder/api.ts");
  const constants = readProjectFile("src/lib/deal-finder/constants.ts");
  const saved = dealFinderMockListings.filter((listing) => listing.is_saved && listing.source_status === "active" && !listing.is_hidden);

  assert.ok(saved.length > 0);
  assert.match(api, /filters\.is_saved !== undefined/);
  assert.match(api, /filters\.is_hidden !== undefined/);
  assert.match(api, /\.toLowerCase\(\)\.includes\(term\)/);
  ["newest", "oldest", "price_asc", "price_desc", "deal_score_desc", "deal_score_asc", "profit_desc", "last_checked_asc"].forEach((sort) => {
    assert.match(constants, new RegExp(`"${sort}"`));
  });
});

test("Deal Finder cards keep readable facts and actions in narrow workspaces", () => {
  const styles = readProjectFile("src/styles/global.css");

  assert.match(styles, /repeat\(auto-fit, minmax\(min\(100%, 340px\), 1fr\)\)/);
  assert.match(styles, /minmax\(64px, 0\.7fr\) minmax\(104px, 1fr\) minmax\(0, 1\.4fr\)/);
  assert.match(styles, /\.deal-finder-card dl > div:nth-child\(2\) dd[\s\S]*white-space: nowrap/);
  assert.match(styles, /\.deal-finder-card dl > div:nth-child\(3\) dd[\s\S]*word-break: normal/);
  assert.match(styles, /@media \(max-width: 420px\)[\s\S]*grid-column: 1 \/ -1/);
});

test("real Deal Finder score queries filter and sort the complete result set", () => {
  const listings = dealFinderMockListings.slice(0, 5);
  const expected = listings
    .filter((listing) => Number(listing.analysis?.deal_score || 0) >= 70)
    .sort((left, right) => Number(right.analysis?.deal_score || 0) - Number(left.analysis?.deal_score || 0));
  const actual = applyDealFinderScoreQuery(listings, { deal_score_min: 70, sort: "deal_score_desc" });

  assert.deepEqual(actual.map((listing) => listing.id), expected.map((listing) => listing.id));
  assert.ok(actual.every((listing) => Number(listing.analysis?.deal_score || 0) >= 70));

  const bounded = applyDealFinderScoreQuery(listings, { deal_score_min: 40, deal_score_max: 60, sort: "deal_score_asc" });
  const boundedScores = bounded.map((listing) => Number(listing.analysis?.deal_score || 0));
  assert.ok(boundedScores.every((score) => score >= 40 && score <= 60));
  assert.deepEqual(boundedScores, [...boundedScores].sort((left, right) => left - right));

  const api = readProjectFile("src/lib/deal-finder/api.ts");
  assert.match(api, /needsCompleteScoreSet/);
  assert.match(api, /per_page: 100/);
  assert.match(api, /page <= first\.pagination\.total_pages/);
  assert.match(api, /deal_score_min: undefined/);
  assert.match(api, /deal_score_max: undefined/);
  assert.match(api, /matched\.slice\(start, start \+ requestedPerPage\)/);
  assert.match(api, /total: matched\.length/);
  assert.match(api, /has_next: requestedPage < totalPages/);
  assert.match(api, /has_previous: requestedPage > 1/);

  const filters = readProjectFile("src/components/deal-finder/DealFinderFilters.astro");
  const client = readProjectFile("src/lib/deal-finder/client.ts");
  assert.match(filters, /name="deal_score_min"/);
  assert.match(filters, /name="deal_score_max"/);
  assert.match(client, /deal_score_max: numeric\("deal_score_max"\)/);
});

test("Deal Finder Xano frontend contracts are authenticated, role-gated and owner-scoped", () => {
  const files = [
    "stats",
    "listings",
    "detail",
    "searches",
    "view",
    "save",
    "unsave",
    "hide",
    "restore",
  ].map((name) => readProjectFile(`docs/xano/deal-finder-frontend-${name}.xs`));

  files.forEach((script) => {
    assert.match(script, /auth = "automarket_users"/);
    assert.match(script, /\$current_user\.role == "admin"/);
    assert.match(script, /\$current_user\.role == "deal_finder_admin"/);
    assert.match(script, /deal_finder_(?:listings|searches)\.user_id == \$current_user\.id/);
    assert.doesNotMatch(script, /\$input\.user_id/);
  });

  const list = files[1];
  const detail = files[2];
  assert.match(list, /per_page\?=100 filters=min:1\|max:100/);
  assert.match(list, /source_status\?="active"/);
  assert.match(list, /is_hidden\?="false"/);
  assert.match(list, /includes \$input\.search/);
  assert.doesNotMatch(list, /raw_data|input_snapshot|error_message/);
  assert.doesNotMatch(detail, /raw_data|input_snapshot|error_message|body_html/);
  assert.match(detail, /analysis_version: \$analysis\.analysis_version/);
  assert.doesNotMatch(detail, /provider_response_id|input_tokens|output_tokens|total_tokens|input_hash/);
});

test("Deal Finder tolerates a missing search profile and a failed stats request", () => {
  const stats = readProjectFile("docs/xano/deal-finder-frontend-stats.xs");
  const client = readProjectFile("src/lib/deal-finder/client.ts");

  assert.match(stats, /var \$last_sync_at \{[\s\S]*value = null/);
  assert.match(stats, /if \(\$latest_search != null\) \{[\s\S]*value = \$latest_search\.last_sync_at/);
  assert.match(stats, /last_sync_at\s*:\s*\$last_sync_at/);
  assert.doesNotMatch(stats, /last_sync_at\s*:\s*\$latest_search\.last_sync_at/);
  assert.match(client, /Promise\.allSettled\(\[/);
  assert.match(client, /if \(listingsResult\.status === "rejected"\) throw listingsResult\.reason/);
  assert.match(client, /renderStatsUnavailable/);
});

test("Deal Finder AI rendering and source links preserve the privacy boundary", () => {
  const analysisView = readProjectFile("src/lib/deal-finder/analysis-view.ts");
  const detailPage = readProjectFile("src/pages/dashboard/deal-finder/listing/index.astro");
  const client = readProjectFile("src/lib/deal-finder/client.ts");

  assert.doesNotMatch(analysisView + detailPage, /set:html/);
  assert.match(client, /target="_blank" rel="noopener noreferrer nofollow"/);
  assert.doesNotMatch(client, /input_snapshot|provider_response_id|raw OpenAI response/);
});

test("Deal Finder internal dedupe contracts derive tenant ownership from the search", () => {
  const existing = readProjectFile("docs/xano/deal-finder-internal-existing-ids.xs");
  const ingest = readProjectFile("docs/xano/deal-finder-internal-ingest.xs");
  const touch = readProjectFile("docs/xano/deal-finder-internal-touch-seen.xs");
  const schema = readProjectFile("docs/xano/deal-finder-schema.json");

  [existing, ingest, touch].forEach((script) => {
    assert.match(script, /deal_finder_listings\.user_id == \$search\.user_id/);
    assert.doesNotMatch(script, /\$input\.user_id/);
  });
  assert.match(schema, /"user_id"[\s\S]*"platform"[\s\S]*"external_id"/);
});

test("sync Worker uses server-only secrets and bounded production schedules", () => {
  const worker = readProjectFile("workers/deal-finder-sync/src/index.ts");
  const wrangler = readProjectFile("workers/deal-finder-sync/wrangler.toml");
  const agent = readProjectFile("workers/deal-finder-sync/src/kleinanzeigen-agent-client.ts");

  assert.match(worker, /X-Deal-Finder-Secret/);
  assert.match(worker, /CONFIGURATION_ERROR/);
  assert.match(agent, /klaz_key/);
  assert.match(wrangler, /^\[triggers\]/m);
  assert.match(wrangler, /crons = \["\*\/2 \* \* \* \*", "15 6 \* \* \*"\]/);
  assert.match(wrangler, /DEAL_FINDER_MANUAL_SYNC_ENABLED = "false"/);
  assert.match(wrangler, /DEAL_FINDER_MAX_SEARCHES_PER_RUN = "1"/);
  assert.match(wrangler, /DEAL_FINDER_MAX_SEARCH_RESULTS_PER_RUN = "100"/);
  assert.match(wrangler, /DEAL_FINDER_MAX_DETAILS_PER_RUN = "4"/);
  assert.match(wrangler, /DEAL_FINDER_MAX_AI_ANALYSES_PER_RUN = "1"/);
  assert.doesNotMatch(worker, /PUBLIC_KLEINANZEIGEN/);
});
