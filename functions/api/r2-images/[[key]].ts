interface Env {
  R2_BUCKET: R2Bucket;
}

const CACHE_SECONDS = 60 * 60 * 24 * 30;

function getKey(param: string | string[] | undefined): string {
  if (!param) return "";
  return Array.isArray(param) ? param.join("/") : param;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const key = getKey(params.key);

  if (!key || key.includes("..")) {
    return new Response("Image not found", { status: 404 });
  }

  const object = await env.R2_BUCKET.get(key);

  if (!object) {
    return new Response("Image not found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", `public, max-age=${CACHE_SECONDS}, immutable`);
  headers.set("access-control-allow-origin", "*");

  return new Response(object.body, { headers });
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-max-age": "86400",
    },
  });
