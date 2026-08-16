import type { ImagesBinding } from "../../lib/imagePipeline.ts";

interface Env {
  R2_BUCKET: R2Bucket;
  IMAGES?: ImagesBinding;
}

const CACHE_SECONDS = 60 * 60 * 24 * 365;
const ALLOWED_WIDTHS = new Set([320, 480, 640, 800, 1280, 1600]);
const ALLOWED_QUALITIES = new Set([60, 68, 72, 78]);

function getKey(param: string | string[] | undefined): string {
  if (!param) return "";
  return Array.isArray(param) ? param.join("/") : param;
}

type R2ImageMetadata = {
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
};

function imageHeaders(object: R2ImageMetadata) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", `public, max-age=${CACHE_SECONDS}, immutable`);
  headers.set("access-control-allow-origin", "*");
  return headers;
}

function buildVariantKey(key: string, width: number, quality: number) {
  return `responsive/${width}w-q${quality}/${key}`;
}

function variantHeaders(object: R2ImageMetadata, label: string) {
  const headers = imageHeaders(object);
  headers.set("content-type", "image/webp");
  headers.set("vary", "Accept-Encoding");
  headers.set("x-sitecraft-image-variant", label);
  return headers;
}

function readVariant(request?: Request) {
  if (!request) return null;
  const url = new URL(request.url);
  if (!url.searchParams.has("width")) return null;
  const width = Number(url.searchParams.get("width"));
  const requestedQuality = Number(url.searchParams.get("quality") || 72);
  if (!ALLOWED_WIDTHS.has(width)) return { error: "Unsupported image width" } as const;
  const quality = ALLOWED_QUALITIES.has(requestedQuality) ? requestedQuality : 72;
  return { width, quality } as const;
}

async function readEdgeCache(request: Request) {
  try {
    const edgeCache = (caches as unknown as CacheStorage & { default: Cache }).default;
    return await edgeCache.match(request);
  } catch {
    return undefined;
  }
}

function writeEdgeCache(request: Request, response: Response, waitUntil?: (promise: Promise<unknown>) => void) {
  if (!waitUntil || !response.ok) return;
  const edgeCache = (caches as unknown as CacheStorage & { default: Cache }).default;
  waitUntil(edgeCache.put(request, response.clone()).catch(() => undefined));
}

export const onRequestGet: PagesFunction<Env> = async ({ env, params, request, waitUntil }) => {
  const key = getKey(params.key);

  if (!key || key.includes("..")) {
    return new Response("Image not found", { status: 404 });
  }

  const cached = await readEdgeCache(request);
  if (cached) return cached;

  const variant = readVariant(request);
  if (variant && "error" in variant) return new Response(variant.error, { status: 400 });
  if (variant) {
    const prebuilt = await env.R2_BUCKET.get(buildVariantKey(key, variant.width, variant.quality));
    if (prebuilt) {
      const response = new Response(prebuilt.body, {
        headers: variantHeaders(prebuilt, `${variant.width}w-q${variant.quality}-prebuilt`),
      });
      writeEdgeCache(request, response, waitUntil);
      return response;
    }
  }

  const object = await env.R2_BUCKET.get(key);

  if (!object) {
    return new Response("Image not found", { status: 404 });
  }

  if (variant && env.IMAGES) {
    const masterBytes = await new Response(object.body).arrayBuffer();
    try {
      const output = await env.IMAGES
        .input(new Blob([masterBytes]).stream())
        .transform({ width: variant.width, fit: "scale-down" })
        .output({ format: "image/webp", quality: variant.quality, anim: false });
      const transformed = output.response();
      if (transformed.ok && transformed.body) {
        const headers = new Headers(transformed.headers);
        headers.set("content-type", "image/webp");
        headers.set("cache-control", `public, max-age=${CACHE_SECONDS}, immutable`);
        headers.set("access-control-allow-origin", "*");
        headers.set("vary", "Accept-Encoding");
        headers.set("x-sitecraft-image-variant", `${variant.width}w-q${variant.quality}`);
        const response = new Response(transformed.body, { status: transformed.status, headers });
        writeEdgeCache(request, response, waitUntil);
        return response;
      }
    } catch {
      // The 150 KB WebP master remains a safe fallback during a transient
      // transformation failure, so public pages never show a broken image.
    }
    const headers = imageHeaders(object);
    headers.set("x-sitecraft-image-variant", "master-fallback");
    return new Response(masterBytes, { headers });
  }

  const headers = imageHeaders(object);
  if (variant) headers.set("x-sitecraft-image-variant", "master-fallback");
  const response = new Response(object.body, { headers });
  if (!variant) writeEdgeCache(request, response, waitUntil);
  return response;
};

export const onRequestHead: PagesFunction<Env> = async ({ env, params }) => {
  const key = getKey(params.key);

  if (!key || key.includes("..")) {
    return new Response(null, { status: 404 });
  }

  // `get` exposes the metadata without consuming the returned body stream.
  // The HEAD response deliberately omits that stream.
  const object = await env.R2_BUCKET.get(key);
  if (!object) return new Response(null, { status: 404 });

  return new Response(null, { headers: imageHeaders(object) });
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, HEAD, OPTIONS",
      "access-control-max-age": "86400",
    },
  });

export const __test = { getKey, readVariant, buildVariantKey, readEdgeCache, writeEdgeCache };
