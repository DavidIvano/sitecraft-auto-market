import { SITE_URL } from "../lib/config";

const siteUrl = SITE_URL || "https://automarket.sitecraft.agency";
const privateRules = `Disallow: /admin/
Disallow: /dashboard/
Disallow: /login
Disallow: /register
Disallow: /auth/
Disallow: /billing
Disallow: /payment/`;

export function GET() {
  return new Response(
    `# Public search and answer-engine discovery is allowed. Private account,
# authentication and payment routes are intentionally excluded.
User-agent: OAI-SearchBot
Allow: /
${privateRules}

User-agent: *
Allow: /
${privateRules}

Sitemap: ${new URL("/sitemap.xml", siteUrl).toString()}
`,
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    },
  );
}
