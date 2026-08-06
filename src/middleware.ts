import { defineMiddleware } from "astro:middleware";

import { LOCALE_COOKIE, resolveRequestLocale } from "./i18n/locales.ts";
import { translateUiHtml } from "./i18n/uiTranslator.ts";

export const onRequest = defineMiddleware(async (context, next) => {
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
