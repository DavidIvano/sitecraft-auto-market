import type { Release3Flags } from "./release3.ts";

type LocaleCacheKeyInput = {
  route: string;
  listingIdentity?: string | number;
  requestedLocale: string;
  resolvedLocale: string | null;
  translationVersion: number;
  actorScope: "public" | "admin-test";
  flags: Pick<Release3Flags,
    | "I18N_ENABLED"
    | "I18N_API_READ_ENABLED"
    | "I18N_ADMIN_TEST_LOCALE_AWARE_READ_ENABLED"
    | "I18N_PUBLIC_ROUTES_ENABLED"
    | "I18N_LOCALE_DE_ENABLED">;
};

const part = (value: unknown) => encodeURIComponent(String(value ?? "none").trim().toLowerCase());

export function createLocaleCacheKey(input: LocaleCacheKeyInput) {
  const flagState = Object.entries(input.flags)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}:${value ? 1 : 0}`)
    .join(",");

  return [
    "sitecraft-r3",
    input.actorScope,
    input.route,
    input.listingIdentity ?? "collection",
    input.requestedLocale,
    input.resolvedLocale ?? "unavailable",
    `v${Math.max(0, Number(input.translationVersion) || 0)}`,
    flagState,
  ].map(part).join(":");
}
