import { SITE_URL } from "../lib/config";
import { getApprovedCars } from "../lib/xano";
import type { CarListing } from "../lib/types";

const siteUrl = SITE_URL || "https://sitecraft-auto-market.pages.dev";

const toIsoDate = (value?: string | number) => {
  if (!value) {
    return new Date().toISOString();
  }

  const date =
    typeof value === "number" || /^\d+$/.test(String(value))
      ? new Date(Number(value))
      : new Date(value);

  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const xmlEscape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export async function GET() {
  const staticPages = [
    { path: "/", priority: "1.0", changefreq: "daily" },
    { path: "/cars", priority: "0.9", changefreq: "daily" },
    { path: "/sell", priority: "0.7", changefreq: "weekly" },
    { path: "/login", priority: "0.3", changefreq: "monthly" },
    { path: "/register", priority: "0.3", changefreq: "monthly" },
    { path: "/privacy", priority: "0.2", changefreq: "yearly" },
  ];

  let cars: CarListing[] = [];

  try {
    cars = await getApprovedCars();
  } catch (error) {
    console.warn(error);
  }

  const urls = [
    ...staticPages.map((page) => ({
      loc: new URL(page.path, siteUrl).toString(),
      lastmod: new Date().toISOString(),
      changefreq: page.changefreq,
      priority: page.priority,
    })),
    ...cars.map((car) => ({
      loc: new URL(`/cars/${car.slug}`, siteUrl).toString(),
      lastmod: toIsoDate(car.updated_at ?? car.created_at),
      changefreq: "weekly",
      priority: "0.8",
    })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${xmlEscape(url.loc)}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
