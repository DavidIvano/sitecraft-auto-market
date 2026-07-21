import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildTodayOverview,
  createEmptyWorkspaceRecord,
  getSearchOperations,
  normalizeWorkspaceRecord,
  readWorkspaceRecord,
  writeWorkspaceRecord,
} from "../src/lib/deal-finder/workspace.ts";
import type { DealFinderListing, DealFinderSearch } from "../src/lib/deal-finder/types.ts";

const readProjectFile = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function listing(overrides: Partial<DealFinderListing>): DealFinderListing {
  return {
    id: 1,
    platform: "kleinanzeigen",
    external_id: "stage-two",
    source_url: "https://www.kleinanzeigen.de/s-anzeige/stage-two",
    title: "Test listing",
    currency: "EUR",
    image_status: "unknown",
    first_seen_at: "2026-07-19T06:00:00.000Z",
    last_seen_at: "2026-07-19T06:00:00.000Z",
    source_status: "active",
    user_status: "new",
    unavailable_checks: 0,
    is_new: true,
    is_saved: false,
    is_viewed: false,
    is_hidden: false,
    ...overrides,
  };
}

test("workspace records are bounded, normalized and recover from invalid storage", () => {
  const normalized = normalizeWorkspaceRecord({
    decision: "contact",
    contact_status: "planned",
    contact_channel: "phone",
    next_action_at: "2026-07-19T08:00:00.000Z",
    note: ` ${"a".repeat(2200)} `,
  }, 17);
  assert.equal(normalized.listing_id, 17);
  assert.equal(normalized.note.length, 2000);
  assert.equal(normalized.next_action_at, "2026-07-19T08:00:00.000Z");

  const broken = { getItem: () => "{broken" };
  assert.deepEqual(readWorkspaceRecord(broken, 17), createEmptyWorkspaceRecord(17));

  let stored = "";
  const saved = writeWorkspaceRecord({ setItem: (_key, value) => { stored = value; } }, normalized, new Date("2026-07-19T09:00:00.000Z"));
  assert.equal(saved.storage, "device");
  assert.equal(JSON.parse(stored).updated_at, "2026-07-19T09:00:00.000Z");
});

test("today overview prioritizes due contacts, hot deals and new listings", () => {
  const hot = listing({ id: 1, analysis: { id: 1, listing_id: 1, status: "completed", positive_signals: [], negative_signals: [], missing_information: [], known_defects: [], recommended_questions: [], deal_score: 87, recommendation: "HOT_DEAL" } });
  const due = listing({ id: 2, is_new: false, user_status: "saved", is_saved: true });
  const hidden = listing({ id: 3, is_hidden: true, source_status: "active" });
  const dueRecord = normalizeWorkspaceRecord({ decision: "contact", contact_status: "planned", next_action_at: "2026-07-19T07:00:00.000Z" }, 2);
  const result = buildTodayOverview([hot, due, hidden], [dueRecord], new Date("2026-07-19T10:00:00.000Z"));
  assert.equal(result.hotCount, 1);
  assert.equal(result.dueContactCount, 1);
  assert.equal(result.newCount, 1);
  assert.equal(result.priorityListingIds[0], 2);
  assert.ok(!result.priorityListingIds.includes(3));
});

test("search operations fit the Kleinanzeigen Agent free daily budget", () => {
  const search: DealFinderSearch = {
    id: 1,
    name: "Volkswagen до 10 000",
    platform: "kleinanzeigen",
    source_type: "kleinanzeigen_agent",
    source_config: { max_details_per_run: 4 },
    fuel_types: [],
    transmissions: [],
    required_keywords: [],
    excluded_keywords: [],
    minimum_deal_score: 0,
    sync_enabled: true,
    is_active: true,
  };
  const operations = getSearchOperations(search, new Date("2026-07-19T07:00:00.000Z"));
  assert.equal(operations.maximumCredits, 5);
  assert.equal(operations.dailyLimit, 5);
  assert.equal(operations.budgetState, "within_limit");
  assert.equal(operations.nextRunAt, "2026-07-20T06:15:00.000Z");
});

test("completed Deal Finder analysis is idempotent from the detail UI", () => {
  const analysisView = readProjectFile("src/lib/deal-finder/analysis-view.ts");
  const xano = readProjectFile("docs/xano/deal-finder-frontend-analyze.xs");
  assert.match(analysisView, /Если данные объявления не менялись/);
  assert.doesNotMatch(analysisView, /runButton\("Запустить повторно", true\)/);
  assert.match(xano, /\$completed_analysis != null\) && \(\$input\.force != true\)/);
});

test("stage two exposes Today, operational search budgets and decision dossier", () => {
  const feed = readProjectFile("src/pages/dashboard/deal-finder/index.astro");
  const client = readProjectFile("src/lib/deal-finder/client.ts");
  const css = readProjectFile("src/styles/global.css");
  assert.match(feed, /id="deal-finder-today"/);
  assert.match(client, /Что требует внимания/);
  assert.match(client, /До \$\{operations\.maximumCredits\} из \$\{operations\.dailyLimit\}/);
  assert.match(client, /Решение и следующий шаг/);
  assert.match(client, /if \(DEAL_FINDER_USE_MOCK_DATA\) return true/);
  assert.match(css, /@media \(max-width: 980px\)[\s\S]*\.deal-finder-grid \{ grid-template-columns: repeat\(2/);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.deal-finder-grid \{ grid-template-columns: minmax\(0, 1fr\)/);
});
