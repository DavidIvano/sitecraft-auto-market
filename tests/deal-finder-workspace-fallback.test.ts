import assert from "node:assert/strict";
import test from "node:test";
import { getAccessStateForHttpError } from "../src/lib/accessState.ts";
import {
  loadWorkspaceRecordFromServerOrLocal,
  saveWorkspaceRecordToServerOrLocal,
} from "../src/lib/deal-finder/workspace-fallback.ts";
import { loadDealFinderDetailData } from "../src/lib/deal-finder/detail-loader.ts";
import { renderDealFinderDetailView } from "../src/lib/deal-finder/detail-view.ts";
import { dealFinderMockListings } from "../src/lib/deal-finder/mock-data.ts";
import { DealFinderApiError, type DealFinderListingDetails } from "../src/lib/deal-finder/types.ts";
import { createEmptyWorkspaceRecord, getWorkspaceStorageKey } from "../src/lib/deal-finder/workspace.ts";

const listing = dealFinderMockListings[0];
const details: DealFinderListingDetails = {
  listing,
  analysis: listing.analysis || null,
  search: null,
  email: null,
  allowed_actions: { view: true, save: true, hide: true, reanalyze: true },
};

function workspaceError(status: number) {
  return new DealFinderApiError("workspace unavailable", status, "WORKSPACE_UNAVAILABLE");
}

test("listing 200 and workspace 404 render the vehicle with a local workspace", async () => {
  let listingResolved = false;
  const result = await loadDealFinderDetailData(String(listing.id), {
    listing: async () => {
      listingResolved = true;
      return details;
    },
    workspace: async () => {
      assert.equal(listingResolved, true);
      throw workspaceError(404);
    },
    localWorkspace: () => createEmptyWorkspaceRecord(listing.id),
  });

  const html = renderDealFinderDetailView({
    details: result.details,
    workspaceHtml: `<p>${result.workspace.storage}</p>`,
    returnHref: "/dashboard/deal-finder/",
  });
  assert.ok(html.includes(listing.title));
  assert.match(html, />local</);
});

test("listing 404 remains fatal and does not start the optional workspace request", async () => {
  let workspaceCalled = false;
  await assert.rejects(
    loadDealFinderDetailData("68", {
      listing: async () => { throw new DealFinderApiError("listing missing", 404, "NOT_FOUND"); },
      workspace: async () => {
        workspaceCalled = true;
        return createEmptyWorkspaceRecord(68);
      },
      localWorkspace: () => createEmptyWorkspaceRecord(68),
    }),
    (error: unknown) => error instanceof DealFinderApiError && error.status === 404,
  );
  assert.equal(workspaceCalled, false);
  assert.equal(getAccessStateForHttpError(404).title, "Предложение не найдено");
});

test("workspace GET 404 uses the existing local record", async () => {
  const local = JSON.stringify({ listing_id: 68, decision: "watch", note: "Проверить позже", storage: "local" });
  const record = await loadWorkspaceRecordFromServerOrLocal(
    68,
    async () => { throw workspaceError(404); },
    { getItem: (key) => key === getWorkspaceStorageKey(68) ? local : null },
  );
  assert.equal(record.storage, "local");
  assert.equal(record.decision, "watch");
  assert.equal(record.note, "Проверить позже");
});

test("workspace save 404 or 501 persists a local browser draft", async () => {
  for (const status of [404, 501]) {
    let stored = "";
    const record = await saveWorkspaceRecordToServerOrLocal(
      68,
      { decision: "contact", contact_status: "planned", contact_channel: "phone", next_action_at: null, note: `fallback ${status}` },
      async () => { throw workspaceError(status); },
      { setItem: (_key, value) => { stored = value; } },
    );
    assert.equal(record.storage, "local");
    assert.equal(record.note, `fallback ${status}`);
    assert.equal(JSON.parse(stored).storage, "local");
  }
});

test("workspace server success keeps the server record", async () => {
  const loaded = await loadWorkspaceRecordFromServerOrLocal(
    68,
    async () => ({ decision: "watch", note: "server copy" }),
    null,
  );
  assert.equal(loaded.storage, "server");
  assert.equal(loaded.note, "server copy");
});

test("listing authentication and service errors have distinct messages", () => {
  assert.equal(getAccessStateForHttpError(401).message, "Сессия истекла. Войдите снова.");
  assert.equal(getAccessStateForHttpError(403).title, "Недостаточно прав");
  assert.equal(getAccessStateForHttpError(500).message, "Не удалось загрузить внутренние данные.");
});
