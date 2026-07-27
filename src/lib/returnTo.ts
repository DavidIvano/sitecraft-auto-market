export function normalizeInternalReturnTo(value: unknown, fallback = "/dashboard/") {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) return fallback;
  try {
    const url = new URL(candidate, "https://automarket.sitecraft.agency");
    return url.origin === "https://automarket.sitecraft.agency" ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
