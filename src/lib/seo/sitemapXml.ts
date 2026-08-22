import { toSitemapIsoDate } from "./sitemapApi.ts";

export const xmlEscape = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const renderLastmod = (value?: string | null) => {
  const normalized = toSitemapIsoDate(value);
  return normalized ? `<lastmod>${xmlEscape(normalized)}</lastmod>` : "";
};

export function renderSitemapIndex(entries: Array<{ loc: string; lastmod?: string | null }>) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((entry) => `  <sitemap><loc>${xmlEscape(entry.loc)}</loc>${renderLastmod(entry.lastmod)}</sitemap>`).join("\n")}
</sitemapindex>`;
}

export function renderUrlSet(entries: Array<{ loc: string; lastmod?: string | null }>) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((entry) => `  <url><loc>${xmlEscape(entry.loc)}</loc>${renderLastmod(entry.lastmod)}</url>`).join("\n")}
</urlset>`;
}
