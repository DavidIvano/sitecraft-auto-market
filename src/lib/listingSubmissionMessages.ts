import type { ListingFieldIssue } from "./aiDraftSubmission.ts";

function cleanReason(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "");
}

export function summarizeListingIssues(issues: ListingFieldIssue[], limit = 4) {
  return Array.from(new Set(issues.map((issue) => cleanReason(issue.message)).filter(Boolean)))
    .slice(0, limit)
    .join(". ");
}

export function buildListingSubmissionFailureMessage(
  reason: unknown,
  options: { saved?: boolean } = {},
) {
  const summary = cleanReason(reason) || "Сервер не сообщил дополнительную информацию";
  const status = options.saved
    ? "Объявление сохранено, но не отправлено на модерацию."
    : "Объявление не отправлено на модерацию.";

  return `${status} Причина: ${summary}. Исправьте указанную причину и повторите отправку.`;
}
