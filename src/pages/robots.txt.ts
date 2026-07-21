import { SITE_URL } from "../lib/config";

const siteUrl = SITE_URL || "https://automarket.sitecraft.agency";

export function GET() {
  return new Response(
    `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /dashboard/
Disallow: /login
Disallow: /billing
Disallow: /payment/

Sitemap: ${new URL("/sitemap.xml", siteUrl).toString()}
`,
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    },
  );
}
