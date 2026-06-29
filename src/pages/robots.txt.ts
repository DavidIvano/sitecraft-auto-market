import { SITE_URL } from "../lib/config";

const siteUrl = SITE_URL || "https://sitecraft-auto-market.pages.dev";

export function GET() {
  return new Response(
    `User-agent: *
Allow: /

Sitemap: ${new URL("/sitemap.xml", siteUrl).toString()}
`,
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    },
  );
}
