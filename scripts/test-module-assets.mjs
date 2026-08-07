const args = process.argv.slice(2);
const baseIndex = args.indexOf("--base-url");
const baseUrl = (baseIndex >= 0 ? args[baseIndex + 1] : process.env.BASE_URL)
  || "https://automarket.sitecraft.agency";
const routes = [
  "/",
  "/cars/",
  "/login/",
  "/register/",
  "/dashboard/",
  "/dashboard/listings/",
  "/dashboard/new/",
  "/dashboard/favorites/",
];
const modules = new Set();

for (const route of routes) {
  const response = await fetch(new URL(route, baseUrl), { redirect: "follow" });
  if (!response.ok) throw new Error(`${route} returned ${response.status}`);
  const html = await response.text();
  for (const match of html.matchAll(/<script\b[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*>/gi)) {
    modules.add(new URL(match[1], response.url).toString());
  }
}

if (!modules.size) throw new Error("No module scripts found in tested HTML routes");

for (const url of modules) {
  const response = await fetch(url, { redirect: "manual" });
  const contentType = response.headers.get("content-type") || "";
  const body = await response.text();
  if (response.status !== 200) throw new Error(`${url} returned ${response.status}`);
  if (!/(?:javascript|ecmascript)/i.test(contentType)) throw new Error(`${url} returned ${contentType || "no MIME"}`);
  if (!body.trim() || /^\s*<!doctype html/i.test(body)) throw new Error(`${url} returned an empty or HTML body`);
}

console.log(`Verified ${modules.size} JavaScript modules from ${routes.length} routes at ${baseUrl}.`);
