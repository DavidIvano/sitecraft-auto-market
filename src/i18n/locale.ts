import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  localeRegistry,
  type LocaleCode,
  type LocaleDefinition,
} from "./config.ts";

const safelyCanonicalize = (value: string) => {
  try {
    return Intl.getCanonicalLocales(value)[0] || "";
  } catch {
    return "";
  }
};

export function normalizeLocale(value: unknown, options: { activeOnly?: boolean } = {}): LocaleCode | null {
  const raw = String(value ?? "").trim().replaceAll("_", "-");
  if (!raw) return null;

  const canonical = safelyCanonicalize(raw);
  if (!canonical) return null;

  const exact = localeRegistry.get(canonical);
  if (exact) return !options.activeOnly || exact.isActive ? exact.code : null;

  const caseInsensitive = [...localeRegistry.values()].find((definition) => (
    definition.code.toLowerCase() === canonical.toLowerCase()
    && (!options.activeOnly || definition.isActive)
  ));
  return caseInsensitive?.code || null;
}

export function getLocaleDefinition(value: unknown): LocaleDefinition {
  const locale = normalizeLocale(value, { activeOnly: true }) || DEFAULT_LOCALE;
  return localeRegistry.get(locale) || localeRegistry.get(DEFAULT_LOCALE)!;
}

export function getLocaleFallbackChain(value: unknown): LocaleCode[] {
  const requested = normalizeLocale(value, { activeOnly: true }) || DEFAULT_LOCALE;
  const chain: LocaleCode[] = [];
  const visited = new Set<string>();

  const push = (locale: string | undefined) => {
    const normalized = normalizeLocale(locale, { activeOnly: true });
    if (!normalized || visited.has(normalized)) return false;
    visited.add(normalized);
    chain.push(normalized);
    return true;
  };

  push(requested);
  const definition = getLocaleDefinition(requested);
  if (definition.baseLanguage !== requested) push(definition.baseLanguage);

  let fallback = definition.fallbackLocale;
  while (fallback) {
    const normalized = normalizeLocale(fallback, { activeOnly: true });
    if (!normalized || !push(normalized)) break;
    fallback = getLocaleDefinition(normalized).fallbackLocale;
  }

  push(DEFAULT_LOCALE);
  return chain;
}

export function getIntlLocale(value: unknown): string {
  const definition = getLocaleDefinition(value);
  try {
    new Intl.NumberFormat(definition.code);
    return definition.code;
  } catch {
    return definition.baseLanguage || DEFAULT_LOCALE;
  }
}

export function getLocaleFromPath(pathname: string): LocaleCode | null {
  const firstSegment = pathname.split("?")[0].split("/").filter(Boolean)[0];
  return normalizeLocale(firstSegment, { activeOnly: true });
}

export function getLocaleFromCookie(cookieHeader: string | null | undefined): LocaleCode | null {
  if (!cookieHeader) return null;
  const value = cookieHeader
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === LOCALE_COOKIE_NAME)?.slice(1).join("=");
  return normalizeLocale(value ? decodeURIComponent(value) : null, { activeOnly: true });
}

export function getLocaleFromUser(user: unknown): LocaleCode | null {
  if (!user || typeof user !== "object") return null;
  return normalizeLocale((user as Record<string, unknown>).preferred_locale, { activeOnly: true });
}

export function getLocaleFromAcceptLanguage(header: string | null | undefined): LocaleCode | null {
  if (!header) return null;
  const candidates = header
    .split(",")
    .map((part) => {
      const [code, ...parameters] = part.trim().split(";");
      const quality = Number(parameters.find((parameter) => parameter.trim().startsWith("q="))?.split("=")[1] ?? 1);
      return { code, quality: Number.isFinite(quality) ? quality : 0 };
    })
    .sort((left, right) => right.quality - left.quality);

  for (const candidate of candidates) {
    const exact = normalizeLocale(candidate.code, { activeOnly: true });
    if (exact) return exact;
    const base = candidate.code.split("-")[0];
    const baseMatch = [...localeRegistry.values()].find((definition) => definition.isActive && definition.baseLanguage === base);
    if (baseMatch) return baseMatch.code;
  }
  return null;
}

export function resolveLocale(input: {
  pathname?: string;
  user?: unknown;
  cookieHeader?: string | null;
  acceptLanguage?: string | null;
}): LocaleCode {
  return (
    (input.pathname ? getLocaleFromPath(input.pathname) : null)
    || getLocaleFromUser(input.user)
    || getLocaleFromCookie(input.cookieHeader)
    || getLocaleFromAcceptLanguage(input.acceptLanguage)
    || DEFAULT_LOCALE
  );
}
