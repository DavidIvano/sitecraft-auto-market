/**
 * Seed pages intentionally submitted for every indexable locale.
 *
 * Legal, support, sell and pricing pages remain crawlable through ordinary
 * navigation, but are not priority catalogue landing pages. Keeping them out
 * of the sitemap concentrates discovery on inventory and taxonomy URLs and
 * avoids submitting thin utility translations as if they were search targets.
 */
export const SEO_SITEMAP_SEED_PATHS = Object.freeze([
  "/",
  "/cars/",
] as const);
