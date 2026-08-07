import { GERMAN_PUBLIC_ROUTES_ENABLED, SITE_URL } from "../lib/config";
import { getApprovedCars } from "../lib/xano";
import type { CarListing } from "../lib/types";
import { isPublicListing } from "../lib/listingStatus";
import { isValidPublicCarSlug } from "../lib/publicCar";
import { buildVehicleTaxonomy } from "../lib/seo/vehicleTaxonomy";
import { projectGermanCatalog, type GermanPublicListingDto } from "../i18n/publicListing";

export const prerender = false;

const siteUrl = SITE_URL || "https://automarket.sitecraft.agency";

const toIsoDate = (value?: string | number) => {
  if (!value) return null;

  const date =
    typeof value === "number" || /^\d+$/.test(String(value))
      ? new Date(Number(value))
      : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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
    { path: "/pricing", priority: "0.8", changefreq: "weekly" },
    { path: "/sell", priority: "0.7", changefreq: "weekly" },
    { path: "/support", priority: "0.3", changefreq: "monthly" },
    { path: "/privacy", priority: "0.2", changefreq: "yearly" },
    { path: "/impressum", priority: "0.2", changefreq: "yearly" },
  ];

  let cars: CarListing[] = [];
  let germanCars: GermanPublicListingDto[] = [];

  try {
    cars = (await getApprovedCars({ requireConfigured: true })).filter(isPublicListing);
    if (GERMAN_PUBLIC_ROUTES_ENABLED) {
      germanCars = projectGermanCatalog(await getApprovedCars("de", { requireConfigured: true }));
    }
  } catch {
    return new Response("Sitemap source temporarily unavailable", {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "Retry-After": "300",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  const taxonomy = buildVehicleTaxonomy(cars);
  const taxonomyUrls = taxonomy.flatMap((brand) => [
    {
      loc: new URL(`/cars/brand/${brand.slug}`, siteUrl).toString(),
      lastmod: brand.lastmod,
      changefreq: "daily",
      priority: "0.8",
    },
    ...brand.models.map((model) => ({
      loc: new URL(`/cars/brand/${brand.slug}/${model.slug}`, siteUrl).toString(),
      lastmod: model.lastmod,
      changefreq: "daily",
      priority: "0.7",
    })),
  ]);

  const urls = [
    ...staticPages.map((page) => ({
      loc: new URL(page.path, siteUrl).toString(),
      lastmod: null,
      changefreq: page.changefreq,
      priority: page.priority,
    })),
    ...taxonomyUrls,
    ...cars
      .filter((car, index, list) => (
        isValidPublicCarSlug(car.slug)
        && isPublicListing(car)
        && list.findIndex((candidate) => candidate.slug === car.slug) === index
      ))
      .map((car) => ({
        loc: new URL(`/cars/${car.slug}`, siteUrl).toString(),
        lastmod: toIsoDate(car.updated_at ?? car.created_at),
        changefreq: "weekly",
        priority: "0.8",
      })),
    ...(GERMAN_PUBLIC_ROUTES_ENABLED ? [
      { loc: new URL("/de/", siteUrl).toString(), lastmod: null, changefreq: "daily", priority: "0.9" },
      { loc: new URL("/de/cars/", siteUrl).toString(), lastmod: null, changefreq: "daily", priority: "0.8" },
      ...germanCars
        .filter((car, index, list) => isValidPublicCarSlug(car.slug) && list.findIndex((candidate) => candidate.slug === car.slug) === index)
        .map((car) => ({
          loc: new URL(`/de/cars/${car.slug}/`, siteUrl).toString(),
          lastmod: toIsoDate(car.updated_at ?? car.created_at),
          changefreq: "weekly",
          priority: "0.8",
        })),
    ] : []),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${xmlEscape(url.loc)}</loc>
    ${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ""}
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
      "X-Robots-Tag": "index, follow",
    },
  });
}
