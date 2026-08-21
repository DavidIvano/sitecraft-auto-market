export type PublicCacheProfile = "page" | "catalog" | "detail" | "sitemap";

const EDGE_TTL: Record<PublicCacheProfile, { maxAge: number; stale: number }> = {
  page: { maxAge: 300, stale: 1800 },
  catalog: { maxAge: 120, stale: 600 },
  detail: { maxAge: 300, stale: 3600 },
  sitemap: { maxAge: 900, stale: 3600 },
};

export function setPublicCacheHeaders(
  headers: Headers,
  profile: PublicCacheProfile,
  noindex = false,
  robots: "noindex, follow" | "noindex, nofollow" = "noindex, nofollow",
) {
  if (noindex) {
    setPublicNoStoreHeaders(headers, true, robots);
    return;
  }

  const ttl = EDGE_TTL[profile];
  // The zone-level Browser Cache TTL has a 4-hour minimum for public
  // responses. `private` makes Cloudflare preserve our zero browser TTL while
  // the separate Cloudflare-CDN-Cache-Control header still caches at the edge.
  headers.set("Cache-Control", "private, max-age=0, must-revalidate");
  headers.set("Cloudflare-CDN-Cache-Control", `public, max-age=${ttl.maxAge}, stale-while-revalidate=${ttl.stale}`);
  headers.set("X-Robots-Tag", "index, follow");
}

export function setPublicNoStoreHeaders(
  headers: Headers,
  noindex = false,
  robots: "noindex, follow" | "noindex, nofollow" = "noindex, nofollow",
) {
  headers.set("Cache-Control", "private, no-store");
  headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  headers.set("X-Robots-Tag", noindex ? robots : "index, follow");
}

export function setUnavailableHeaders(headers: Headers) {
  setPublicNoStoreHeaders(headers, true);
}
