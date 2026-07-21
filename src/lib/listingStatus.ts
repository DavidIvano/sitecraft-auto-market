import type {
  CarListing,
  CarListingStatus,
  ListingLifecycleStatus as StrictListingLifecycleStatus,
  ModerationQueueGroup,
  ModerationStatus,
} from "./types";

export type ListingLifecycleStatus =
  | CarListingStatus
  | "ai_draft"
  | "published"
  | "ready_for_review"
  | "needs_fix";

export type ListingStatusInput = {
  status?: string | null;
  moderation_status?: string | null;
};

export type ModerationAction = "approve" | "reject" | "archive" | "block" | "delete" | "sold" | "restore";

export type StatusConflict = {
  type: "status_conflict";
  lifecycle_status: StrictListingLifecycleStatus;
  moderation_status: ModerationStatus;
  message: string;
};

const LIFECYCLE_STATUSES = new Set<StrictListingLifecycleStatus>([
  "ai_draft", "draft", "pending_review", "approved", "published", "sold", "archived", "blocked", "deleted", "rejected", "needs_fix",
]);
const MODERATION_STATUSES = new Set<Exclude<ModerationStatus, null>>([
  "pending_review", "needs_fix", "approved", "rejected", "blocked", "unknown",
]);
const LIFECYCLE_MODERATION_FALLBACK: Partial<Record<StrictListingLifecycleStatus, Exclude<ModerationStatus, "unknown">>> = {
  pending_review: "pending_review",
  approved: "approved",
  published: "approved",
  rejected: "rejected",
  needs_fix: "needs_fix",
  blocked: "blocked",
};

export function getLifecycleStatus(listing: ListingStatusInput): StrictListingLifecycleStatus {
  const raw = String(listing.status || "").trim().toLowerCase();
  if (raw === "pending") return "pending_review";
  if (raw === "active") return "published";
  return LIFECYCLE_STATUSES.has(raw as StrictListingLifecycleStatus) ? raw as StrictListingLifecycleStatus : "unknown";
}

export function getModerationStatus(listing: ListingStatusInput): ModerationStatus {
  if (listing.moderation_status === null || listing.moderation_status === undefined || String(listing.moderation_status).trim() === "") {
    return null;
  }
  const raw = String(listing.moderation_status).trim().toLowerCase();
  if (raw === "pending") return "pending_review";
  return MODERATION_STATUSES.has(raw as Exclude<ModerationStatus, null>) ? raw as Exclude<ModerationStatus, null> : "unknown";
}

export function getEffectiveModerationStatus(listing: ListingStatusInput): ModerationStatus {
  const explicit = getModerationStatus(listing);
  if (explicit !== null) return explicit;
  return LIFECYCLE_MODERATION_FALLBACK[getLifecycleStatus(listing)] ?? null;
}

export function getStatusConflict(listing: ListingStatusInput): StatusConflict | null {
  const lifecycle = getLifecycleStatus(listing);
  const explicit = getModerationStatus(listing);
  const conflict = (message = "Статус объявления не совпадает со статусом модерации."): StatusConflict => ({
    type: "status_conflict",
    lifecycle_status: lifecycle,
    moderation_status: explicit,
    message,
  });

  if (lifecycle === "unknown" || explicit === "unknown") return conflict("Объявление содержит неизвестное значение статуса и требует ручной проверки.");
  if (lifecycle === "deleted") return conflict("Удалённое объявление требует ручной проверки статуса модерации.");
  if (lifecycle === "archived" && explicit !== null) return conflict();
  if (lifecycle === "blocked" && explicit !== null && explicit !== "blocked") return conflict();
  if (lifecycle === "sold" && explicit !== null && explicit !== "approved") return conflict();

  const expected = LIFECYCLE_MODERATION_FALLBACK[lifecycle];
  if (explicit !== null && expected && explicit !== expected) return conflict();
  if ((lifecycle === "draft" || lifecycle === "ai_draft") && explicit !== null && !["pending_review", "needs_fix"].includes(explicit)) return conflict();
  return null;
}

export function getModerationQueueGroup(listing: ListingStatusInput): Exclude<ModerationQueueGroup, "all"> | null {
  const lifecycle = getLifecycleStatus(listing);
  if (getStatusConflict(listing)) return "conflict";
  if (lifecycle === "archived") return "archived";
  if (lifecycle === "sold") return "sold";
  if (lifecycle === "blocked") return "blocked";

  switch (getEffectiveModerationStatus(listing)) {
    case "pending_review": return "pending";
    case "needs_fix": return "needs_fix";
    case "approved": return "approved";
    case "rejected": return "rejected";
    case "blocked": return "blocked";
    default: return null;
  }
}

export const isPendingModeration = (listing: ListingStatusInput) => getEffectiveModerationStatus(listing) === "pending_review" && !getStatusConflict(listing);
export const isNeedsFix = (listing: ListingStatusInput) => getEffectiveModerationStatus(listing) === "needs_fix" && !getStatusConflict(listing);
export const isModerationApproved = (listing: ListingStatusInput) => getEffectiveModerationStatus(listing) === "approved" && !getStatusConflict(listing);
export const isModerationRejected = (listing: ListingStatusInput) => getEffectiveModerationStatus(listing) === "rejected" && !getStatusConflict(listing);
export const isModerationBlocked = (listing: ListingStatusInput) => getLifecycleStatus(listing) === "blocked" || getEffectiveModerationStatus(listing) === "blocked";

export function canRunModerationAction(listing: ListingStatusInput, action: ModerationAction) {
  const lifecycle = getLifecycleStatus(listing);
  const moderation = getEffectiveModerationStatus(listing);
  if (getStatusConflict(listing) || ["deleted", "blocked", "archived", "sold"].includes(lifecycle)) return false;
  if (action === "approve") return ["pending_review", "needs_fix", "rejected"].includes(String(moderation));
  if (action === "reject") return ["pending_review", "needs_fix"].includes(String(moderation));
  if (action === "archive" || action === "sold") return moderation === "approved" || lifecycle === "published";
  if (action === "block" || action === "delete") return moderation !== null;
  return false;
}

export function getStatusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    all: "Все", pending: "Ожидают проверки", pending_review: "Ожидает проверки", needs_fix: "Нужно исправить",
    approved: "Одобрено", published: "Опубликовано", rejected: "Отклонено", blocked: "Заблокировано",
    conflict: "Конфликт статусов", archived: "Архив", sold: "Продано", deleted: "Удалено",
    draft: "Черновик", ai_draft: "AI-черновик", unknown: "Требует проверки",
  };
  return labels[String(status || "unknown")] || "Требует проверки";
}

export function getStatusTone(status: string | null | undefined): "neutral" | "info" | "success" | "warning" | "danger" | "muted" {
  const value = String(status || "unknown");
  if (["approved", "published"].includes(value)) return "success";
  if (["rejected", "blocked", "deleted", "conflict", "unknown"].includes(value)) return "danger";
  if (["pending", "pending_review", "needs_fix", "sold"].includes(value)) return "warning";
  if (value === "archived") return "muted";
  return "neutral";
}

export function getModerationQueueCounts(listings: ListingStatusInput[]) {
  const groups: Array<Exclude<ModerationQueueGroup, "all">> = ["pending", "needs_fix", "approved", "rejected", "blocked", "conflict", "archived", "sold"];
  return Object.fromEntries([
    ["all", listings.length],
    ...groups.map((group) => [group, listings.filter((listing) => getModerationQueueGroup(listing) === group).length]),
  ]) as Record<ModerationQueueGroup, number>;
}

export const PUBLIC_LISTING_STATUSES = new Set<ListingLifecycleStatus>([
  "approved",
  "published",
  "sold",
]);

export const PRIVATE_LISTING_STATUSES = new Set<ListingLifecycleStatus>([
  "draft",
  "ai_draft",
  "pending_review",
  "needs_fix",
  "rejected",
  "blocked",
  "deleted",
  "archived",
]);

export const EDITABLE_LISTING_STATUSES = new Set<ListingLifecycleStatus>([
  "draft",
  "ai_draft",
  "rejected",
  "needs_fix",
]);

export const LISTING_STATUS_META: Record<
  ListingLifecycleStatus,
  { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" | "muted" }
> = {
  draft: { label: "Черновик", tone: "neutral" },
  ai_draft: { label: "AI-черновик", tone: "info" },
  ready_for_review: { label: "Готово к проверке", tone: "info" },
  pending_review: { label: "На модерации", tone: "warning" },
  approved: { label: "Опубликовано", tone: "success" },
  published: { label: "Опубликовано", tone: "success" },
  rejected: { label: "Нужно исправить", tone: "danger" },
  needs_fix: { label: "Нужно исправить", tone: "danger" },
  archived: { label: "В архиве", tone: "muted" },
  blocked: { label: "Заблокировано", tone: "danger" },
  deleted: { label: "Удалено", tone: "muted" },
  sold: { label: "Продано", tone: "warning" },
};

export function normalizeListingStatus(status?: string | null): ListingLifecycleStatus {
  if (!status) {
    return "draft";
  }

  if (status === "pending") {
    return "pending_review";
  }

  if (status === "active") {
    return "published";
  }

  return (status in LISTING_STATUS_META ? status : "draft") as ListingLifecycleStatus;
}

export function getListingLifecycleStatus(car: Partial<CarListing>) {
  return normalizeListingStatus(car.moderation_status || car.status);
}

export function isPublicListing(car: { status?: string | null; moderation_status?: string | null }) {
  const normalizePublicStatus = (status?: string | null) => {
    if (!status) return null;
    if (status === "pending") return "pending_review" as const;
    if (status === "active") return "published" as const;
    return status as ListingLifecycleStatus;
  };
  const status = normalizePublicStatus(car.status);
  const moderationStatus = normalizePublicStatus(car.moderation_status);
  const hasPublicStatus =
    (status !== null && PUBLIC_LISTING_STATUSES.has(status)) ||
    (moderationStatus !== null && PUBLIC_LISTING_STATUSES.has(moderationStatus));
  const hasPrivateStatus =
    (status !== null && PRIVATE_LISTING_STATUSES.has(status)) ||
    (moderationStatus !== null && PRIVATE_LISTING_STATUSES.has(moderationStatus));

  return hasPublicStatus && !hasPrivateStatus;
}

export function isSoldListing(car: Partial<CarListing>) {
  return getListingLifecycleStatus(car) === "sold" || Boolean(car.sold_at);
}

export function isEditableListing(car: Partial<CarListing>) {
  return EDITABLE_LISTING_STATUSES.has(getListingLifecycleStatus(car));
}
