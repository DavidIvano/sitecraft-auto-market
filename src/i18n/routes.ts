import { getLocaleFromPath, normalizeLocale } from "./locale.ts";

export function withLocale(path: string, locale: string) {
  const normalized = normalizeLocale(locale, { activeOnly: true });
  if (!normalized) return path;
  const url = new URL(path, "https://local.invalid");
  url.searchParams.set("locale", normalized);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function stripLocalePrefix(pathname: string) {
  const locale = getLocaleFromPath(pathname);
  if (!locale) return pathname;
  const stripped = pathname.replace(new RegExp(`^/${locale}(?=/|$)`, "i"), "");
  return stripped || "/";
}

export function getLocalizedPath(pathname: string, locale: string) {
  const normalized = normalizeLocale(locale, { activeOnly: true });
  if (!normalized) return pathname;
  const unprefixed = stripLocalePrefix(pathname);
  return `/${normalized}${unprefixed === "/" ? "/" : unprefixed}`;
}
