export type PublicCacheProfile = "page" | "catalog" | "detail" | "sitemap";

const EDGE_TTL: Record<PublicCacheProfile, { maxAge: number; stale: number }> = {
  page: { maxAge: 300, stale: 1800 },
  catalog: { maxAge: 120, stale: 600 },
  detail: { maxAge: 300, stale: 3600 },
  sitemap: { maxAge: 900, stale: 3600 },
};

export function setPublicCacheHeaders(headers: Headers, profile: PublicCacheProfile, noindex = false) {
  if (noindex) {
    headers.set("Cache-Control", "private, no-store");
    headers.set("Cloudflare-CDN-Cache-Control", "no-store");
    headers.set("X-Robots-Tag", "noindex, nofollow");
    return;
  }

  const ttl = EDGE_TTL[profile];
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  headers.set("Cloudflare-CDN-Cache-Control", `public, max-age=${ttl.maxAge}, stale-while-revalidate=${ttl.stale}`);
  headers.set("X-Robots-Tag", "index, follow");
}

export function setUnavailableHeaders(headers: Headers) {
  headers.set("Cache-Control", "private, no-store");
  headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  headers.set("X-Robots-Tag", "noindex, nofollow");
}
