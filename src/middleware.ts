import { defineMiddleware } from "astro:middleware";

import { LOCALE_COOKIE, resolveRequestLocale } from "./i18n/locales.ts";
import { DEFAULT_LOCALE, getLocaleDefinition } from "./i18n/config.ts";
import { getLocaleFromAcceptLanguage, getLocaleFromCookie, getLocaleFromPath, normalizeLocale } from "./i18n/locale.ts";
import { getLocalizedPath } from "./i18n/routes.ts";
import { isPublicLocaleRouteEnabled } from "./i18n/release4.ts";
import { translateUiHtml } from "./i18n/uiTranslator.ts";
import { RELEASE4_FLAGS } from "./lib/config.ts";

// Catalog/detail redirects remain disabled until every affected legacy URL has
// a ready target. Redirecting an untranslated listing would create 302 -> 404.
const SAFE_LEGACY_REDIRECT_PATH = /^\/(?:pricing|sell|support|privacy|impressum)\/?$/u;

const preferredPublicLocale = (context: Parameters<Parameters<typeof defineMiddleware>[0]>[0]) => {
  const explicit = normalizeLocale(context.url.searchParams.get("lang") || context.url.searchParams.get("locale"), { activeOnly: true });
  const cookie = getLocaleFromCookie(context.request.headers.get("cookie"));
  const accepted = getLocaleFromAcceptLanguage(context.request.headers.get("accept-language"));
  for (const candidate of [explicit, cookie, accepted, "en", DEFAULT_LOCALE]) {
    if (candidate && getLocaleDefinition(candidate)?.isPublic && isPublicLocaleRouteEnabled(candidate, RELEASE4_FLAGS)) return candidate;
  }
  return DEFAULT_LOCALE;
};

export const onRequest = defineMiddleware(async (context, next) => {
  // Locale-prefixed public pages render their final language on the server and
  // must never be buffered or rewritten after render.
  if (getLocaleFromPath(context.url.pathname)) return next();

  if (RELEASE4_FLAGS.I18N_PUBLIC_ROUTES_ENABLED && RELEASE4_FLAGS.I18N_ENABLED && RELEASE4_FLAGS.I18N_API_READ_ENABLED) {
    if (context.url.pathname === "/" || SAFE_LEGACY_REDIRECT_PATH.test(context.url.pathname)) {
      const locale = preferredPublicLocale(context);
      if (isPublicLocaleRouteEnabled(locale, RELEASE4_FLAGS)) {
        const target = getLocalizedPath(context.url.pathname, locale);
        // Temporary redirect during validation. Promote to 308 only after the
        // redirect matrix and Search Console checks pass.
        return context.redirect(target, 302);
      }
    }
  }

  const response = await next();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("text/html")) return response;

  const locale = resolveRequestLocale(context.url, context.cookies.get(LOCALE_COOKIE)?.value);
  if (locale === "ru") return response;

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(translateUiHtml(await response.text(), locale), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});
