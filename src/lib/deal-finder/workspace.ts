import type { DealFinderListing, DealFinderSearch } from "./types";

export const DEAL_FINDER_PROVIDER_DAILY_LIMIT = 5;
export const DEAL_FINDER_DEFAULT_DETAIL_BUDGET = 4;

export type DealFinderDecision = "undecided" | "contact" | "watch" | "skip";
export type DealFinderContactStatus = "not_contacted" | "planned" | "contacted" | "waiting" | "closed";
export type DealFinderContactChannel = "none" | "phone" | "email" | "message";
export type DealFinderWorkspaceStorage = "server" | "local";

export type DealFinderWorkspaceRecord = {
  listing_id: number;
  decision: DealFinderDecision;
  contact_status: DealFinderContactStatus;
  contact_channel: DealFinderContactChannel;
  next_action_at: string | null;
  note: string;
  updated_at: string | null;
  storage: DealFinderWorkspaceStorage;
};

export type DealFinderTodayOverview = {
  newCount: number;
  hotCount: number;
  savedCount: number;
  analysisPendingCount: number;
  dueContactCount: number;
  priorityListingIds: number[];
};

export type DealFinderSearchOperations = {
  scheduleLabel: string;
  nextRunAt: string | null;
  searchCredits: number;
  detailCredits: number;
  maximumCredits: number;
  dailyLimit: number;
  budgetState: "within_limit" | "over_limit" | "paused";
};

const decisions = new Set<DealFinderDecision>(["undecided", "contact", "watch", "skip"]);
const contactStatuses = new Set<DealFinderContactStatus>(["not_contacted", "planned", "contacted", "waiting", "closed"]);
const contactChannels = new Set<DealFinderContactChannel>(["none", "phone", "email", "message"]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function validIso(value: unknown) {
  if (typeof value !== "string" || !value.trim() || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

export function createEmptyWorkspaceRecord(listingId: number): DealFinderWorkspaceRecord {
  return {
    listing_id: listingId,
    decision: "undecided",
    contact_status: "not_contacted",
    contact_channel: "none",
    next_action_at: null,
    note: "",
    updated_at: null,
    storage: "local",
  };
}

export function normalizeWorkspaceRecord(value: unknown, listingId: number): DealFinderWorkspaceRecord {
  const record = asRecord(value);
  const decision = decisions.has(record.decision as DealFinderDecision) ? record.decision as DealFinderDecision : "undecided";
  const contactStatus = contactStatuses.has(record.contact_status as DealFinderContactStatus)
    ? record.contact_status as DealFinderContactStatus
    : "not_contacted";
  const contactChannel = contactChannels.has(record.contact_channel as DealFinderContactChannel)
    ? record.contact_channel as DealFinderContactChannel
    : "none";
  return {
    listing_id: listingId,
    decision,
    contact_status: contactStatus,
    contact_channel: contactChannel,
    next_action_at: validIso(record.next_action_at),
    note: typeof record.note === "string" ? record.note.trim().slice(0, 2000) : "",
    updated_at: validIso(record.updated_at),
    storage: record.storage === "server" ? "server" : "local",
  };
}

export function getWorkspaceStorageKey(listingId: number) {
  return `sitecraft_deal_finder_workspace:${listingId}`;
}

export function readWorkspaceRecord(storage: Pick<Storage, "getItem"> | null, listingId: number) {
  if (!storage) return createEmptyWorkspaceRecord(listingId);
  try {
    return normalizeWorkspaceRecord(JSON.parse(storage.getItem(getWorkspaceStorageKey(listingId)) || "null"), listingId);
  } catch {
    return createEmptyWorkspaceRecord(listingId);
  }
}

export function writeWorkspaceRecord(
  storage: Pick<Storage, "setItem"> | null,
  value: DealFinderWorkspaceRecord,
  now = new Date(),
) {
  const record = normalizeWorkspaceRecord({ ...value, updated_at: now.toISOString(), storage: "local" }, value.listing_id);
  storage?.setItem(getWorkspaceStorageKey(value.listing_id), JSON.stringify(record));
  return record;
}

export function isNextActionDue(record: DealFinderWorkspaceRecord, now = new Date()) {
  return Boolean(record.next_action_at && Date.parse(record.next_action_at) <= now.getTime() && record.contact_status !== "closed");
}

function priorityScore(listing: DealFinderListing, workspace: DealFinderWorkspaceRecord, now: Date) {
  if (listing.is_hidden || listing.source_status !== "active" || workspace.decision === "skip") return -1;
  let score = 0;
  if (isNextActionDue(workspace, now)) score += 1000;
  if (listing.analysis?.recommendation === "CONTACT_NOW") score += 500;
  if (listing.analysis?.recommendation === "HOT_DEAL" || Number(listing.analysis?.deal_score || 0) >= 80) score += 400;
  if (listing.is_saved) score += 200;
  if (listing.is_new) score += 100;
  if (!listing.analysis || ["pending", "processing"].includes(listing.analysis.status)) score += 50;
  return score;
}

export function buildTodayOverview(
  listings: DealFinderListing[],
  workspaceRecords: DealFinderWorkspaceRecord[] = [],
  now = new Date(),
): DealFinderTodayOverview {
  const records = new Map(workspaceRecords.map((record) => [record.listing_id, record]));
  const workspaceFor = (listing: DealFinderListing) => records.get(listing.id) || createEmptyWorkspaceRecord(listing.id);
  const active = listings.filter((listing) => listing.source_status === "active" && !listing.is_hidden);
  return {
    newCount: active.filter((listing) => listing.is_new).length,
    hotCount: active.filter((listing) => listing.analysis?.recommendation === "HOT_DEAL" || Number(listing.analysis?.deal_score || 0) >= 80).length,
    savedCount: active.filter((listing) => listing.is_saved).length,
    analysisPendingCount: active.filter((listing) => !listing.analysis || ["pending", "processing"].includes(listing.analysis.status)).length,
    dueContactCount: active.filter((listing) => isNextActionDue(workspaceFor(listing), now)).length,
    priorityListingIds: active
      .map((listing) => ({ id: listing.id, score: priorityScore(listing, workspaceFor(listing), now) }))
      .filter((item) => item.score >= 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 6)
      .map((item) => item.id),
  };
}

function nextDailyRun(now: Date, hour = 6, minute = 15) {
  const next = new Date(now);
  next.setUTCHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

export function getSearchOperations(search: DealFinderSearch, now = new Date()): DealFinderSearchOperations {
  const config = asRecord(search.source_config);
  const detailCredits = boundedInteger(
    config.max_details_per_run ?? config.maxDetailsPerRun,
    DEAL_FINDER_DEFAULT_DETAIL_BUDGET,
    0,
    DEAL_FINDER_DEFAULT_DETAIL_BUDGET,
  );
  const searchCredits = search.sync_enabled === false || search.is_active === false ? 0 : 1;
  const maximumCredits = searchCredits + detailCredits;
  const nextRunAt = search.sync_enabled === false || search.is_active === false
    ? null
    : validIso(search.next_sync_at) || nextDailyRun(now);
  return {
    scheduleLabel: search.sync_enabled === false || search.is_active === false
      ? "Остановлен"
      : search.sync_interval_minutes && search.sync_interval_minutes < 1440
        ? `Каждые ${search.sync_interval_minutes} мин.`
        : "Ежедневно, 06:15 UTC",
    nextRunAt,
    searchCredits,
    detailCredits,
    maximumCredits,
    dailyLimit: DEAL_FINDER_PROVIDER_DAILY_LIMIT,
    budgetState: search.sync_enabled === false || search.is_active === false
      ? "paused"
      : maximumCredits > DEAL_FINDER_PROVIDER_DAILY_LIMIT
        ? "over_limit"
        : "within_limit",
  };
}
