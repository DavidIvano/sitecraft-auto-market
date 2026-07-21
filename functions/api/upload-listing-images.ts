import type { R2Env } from "../../src/lib/server/r2";

type UploadEnv = R2Env & {
  XANO_API_URL?: string;
  PUBLIC_XANO_API_URL?: string;
  ALLOWED_UPLOAD_ORIGINS?: string;
  ENVIRONMENT?: string;
};

type PagesContext = {
  request: Request;
  env: UploadEnv;
};

type AuthResult =
  | { ok: true; userId: number }
  | { ok: false; status: 401 | 503; code: "UNAUTHORIZED" | "AUTH_CONFIGURATION_MISSING" | "AUTH_SERVICE_UNAVAILABLE" };

type XanoAuthPayload = {
  id?: unknown;
  user?: { id?: unknown } | null;
};

const MAX_IMAGES = 8;
const MAX_IMAGE_SIZE = 1024 * 1024;
const MAX_BATCH_SIZE = 8 * 1024 * 1024;
const AUTH_TIMEOUT_MS = 9000;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const DEVELOPMENT_ORIGINS = [
  "http://localhost:4321",
  "http://127.0.0.1:4321",
  "http://localhost:4322",
  "http://127.0.0.1:4322",
];

function parseOrigins(env: UploadEnv) {
  const configured = (env.ALLOWED_UPLOAD_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const isDevelopment = ["development", "dev", "local"].includes((env.ENVIRONMENT || "").toLowerCase());
  return new Set(isDevelopment ? [...configured, ...DEVELOPMENT_ORIGINS] : configured);
}

function requestOrigin(request: Request) {
  return request.headers.get("Origin")?.trim() || "";
}

function isOriginAllowed(request: Request, env: UploadEnv) {
  const origin = requestOrigin(request);
  return !origin || parseOrigins(env).has(origin);
}

function corsHeaders(request: Request, env: UploadEnv) {
  const origin = requestOrigin(request);
  const headers: Record<string, string> = { Vary: "Origin" };

  if (origin && parseOrigins(env).has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Max-Age"] = "86400";
  }

  return headers;
}

function json(request: Request, env: UploadEnv, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request, env),
    },
  });
}

function errorResponse(request: Request, env: UploadEnv, status: number, code: string, message: string) {
  return json(request, env, { success: false, code, message }, status);
}

function sanitizeFilename(value: string) {
  return value
    .replace(/^.*[\\/]/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "listing-photo";
}

function extensionFor(contentType: string) {
  return ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" } as Record<string, string>)[contentType] || "bin";
}

function buildKey(userId: number, contentType: string, now = new Date()) {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `listing-images/${userId}/${year}/${month}/${crypto.randomUUID()}.${extensionFor(contentType)}`;
}

function readNumber(formData: FormData, key: string, fallback = 0) {
  const value = Number(formData.get(key));
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function positiveInteger(value: unknown) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function getAuthenticatedUserId(payload: unknown) {
  const authPayload = payload as XanoAuthPayload | null;
  return positiveInteger(authPayload?.id) ?? positiveInteger(authPayload?.user?.id);
}

function logAuthDiagnostic(details: {
  authorizationHeaderPresent: boolean;
  tokenLength?: number;
  xanoStatus?: number;
  authResponseShape?: "root_id" | "nested_user_id" | "missing_user_id" | "invalid_json";
  detectedUserId?: number | null;
  code?: string;
}) {
  // Never log the token, profile, request body, or image metadata.
  console.info("listing_image_upload_auth", details);
}

async function validateAuth(request: Request, env: UploadEnv): Promise<AuthResult> {
  const authorization = request.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(\S+)$/i);

  if (!match?.[1]) {
    logAuthDiagnostic({ authorizationHeaderPresent: false, code: "UNAUTHORIZED" });
    return { ok: false, status: 401, code: "UNAUTHORIZED" };
  }

  const xanoUrl = (env.XANO_API_URL || env.PUBLIC_XANO_API_URL || "").replace(/\/+$/, "");
  if (!xanoUrl) {
    console.warn("Upload auth configuration is missing; request denied.");
    logAuthDiagnostic({ authorizationHeaderPresent: true, tokenLength: match[1].length, code: "AUTH_CONFIGURATION_MISSING" });
    return { ok: false, status: 503, code: "AUTH_CONFIGURATION_MISSING" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

  try {
    const response = await fetch(`${xanoUrl}/auth/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${match[1]}` },
      signal: controller.signal,
    });

    if (response.status >= 500) {
      logAuthDiagnostic({ authorizationHeaderPresent: true, tokenLength: match[1].length, xanoStatus: response.status, code: "AUTH_SERVICE_UNAVAILABLE" });
      return { ok: false, status: 503, code: "AUTH_SERVICE_UNAVAILABLE" };
    }
    if (!response.ok) {
      logAuthDiagnostic({ authorizationHeaderPresent: true, tokenLength: match[1].length, xanoStatus: response.status, code: "UNAUTHORIZED" });
      return { ok: false, status: 401, code: "UNAUTHORIZED" };
    }

    let user: unknown;
    try {
      user = await response.json();
    } catch {
      logAuthDiagnostic({ authorizationHeaderPresent: true, tokenLength: match[1].length, xanoStatus: response.status, authResponseShape: "invalid_json", code: "AUTH_SERVICE_UNAVAILABLE" });
      return { ok: false, status: 503, code: "AUTH_SERVICE_UNAVAILABLE" };
    }

    const payload = user as XanoAuthPayload | null;
    const userId = getAuthenticatedUserId(payload);
    const authResponseShape = positiveInteger(payload?.id)
      ? "root_id"
      : positiveInteger(payload?.user?.id)
        ? "nested_user_id"
        : "missing_user_id";

    if (!userId) {
      logAuthDiagnostic({ authorizationHeaderPresent: true, tokenLength: match[1].length, xanoStatus: response.status, authResponseShape, detectedUserId: null, code: "UNAUTHORIZED" });
      return { ok: false, status: 401, code: "UNAUTHORIZED" };
    }

    logAuthDiagnostic({ authorizationHeaderPresent: true, tokenLength: match[1].length, xanoStatus: response.status, authResponseShape, detectedUserId: userId });
    return { ok: true, userId };
  } catch {
    logAuthDiagnostic({ authorizationHeaderPresent: true, tokenLength: match[1].length, code: "AUTH_SERVICE_UNAVAILABLE" });
    return { ok: false, status: 503, code: "AUTH_SERVICE_UNAVAILABLE" };
  } finally {
    clearTimeout(timeout);
  }
}

function authError(request: Request, env: UploadEnv, result: Exclude<AuthResult, { ok: true }>) {
  if (result.code === "UNAUTHORIZED") {
    return errorResponse(request, env, 401, result.code, "Authentication required.");
  }
  return errorResponse(request, env, 503, result.code, "Upload authentication is temporarily unavailable.");
}

function validateFiles(files: File[]) {
  if (files.length === 0) {
    return { status: 400, code: "FILES_REQUIRED", message: "Select at least one image." };
  }
  if (files.length > MAX_IMAGES) {
    return { status: 400, code: "TOO_MANY_FILES", message: "You can upload no more than 8 images." };
  }
  if (files.some((file) => file.size === 0)) {
    return { status: 400, code: "EMPTY_FILE", message: "Empty image files are not allowed." };
  }
  if (files.some((file) => !ALLOWED_IMAGE_TYPES.has(file.type.toLowerCase()))) {
    return { status: 400, code: "UNSUPPORTED_FILE_TYPE", message: "Only JPEG, PNG, WebP, or AVIF images are allowed." };
  }
  if (files.some((file) => file.size > MAX_IMAGE_SIZE)) {
    return { status: 413, code: "FILE_TOO_LARGE", message: "Each image must be no larger than 1 MB." };
  }
  if (files.reduce((total, file) => total + file.size, 0) > MAX_BATCH_SIZE) {
    return { status: 413, code: "BATCH_TOO_LARGE", message: "The image batch must be no larger than 8 MB." };
  }
  return null;
}

export async function onRequestOptions({ request, env }: PagesContext) {
  if (!isOriginAllowed(request, env)) {
    return errorResponse(request, env, 403, "ORIGIN_NOT_ALLOWED", "This origin is not allowed to upload files.");
  }
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestPost({ request, env }: PagesContext) {
  if (!isOriginAllowed(request, env)) {
    return errorResponse(request, env, 403, "ORIGIN_NOT_ALLOWED", "This origin is not allowed to upload files.");
  }

  if (!env.R2_BUCKET) {
    return errorResponse(request, env, 503, "R2_BINDING_MISSING", "Image storage is temporarily unavailable.");
  }
  const publicBaseUrl = env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (!publicBaseUrl || !publicBaseUrl.startsWith("https://")) {
    return errorResponse(request, env, 503, "R2_PUBLIC_URL_MISSING", "Image storage is temporarily unavailable.");
  }

  const auth = await validateAuth(request, env);
  if (!auth.ok) {
    return authError(request, env, auth);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(request, env, 400, "INVALID_FORM_DATA", "The upload request is invalid.");
  }

  const rawFiles = formData.getAll("files");
  if (rawFiles.some((item) => typeof item === "string")) {
    return errorResponse(request, env, 400, "INVALID_FILE", "Every upload item must be an image file.");
  }
  const files = rawFiles as File[];
  const validationError = validateFiles(files);
  if (validationError) {
    return errorResponse(request, env, validationError.status, validationError.code, validationError.message);
  }

  const createdKeys: string[] = [];
  const uploads: Array<Record<string, unknown>> = [];

  try {
    for (const [index, file] of files.entries()) {
      const contentType = file.type.toLowerCase();
      const key = buildKey(auth.userId, contentType);
      const originalFilename = sanitizeFilename(file.name || `listing-photo-${index + 1}`);
      const width = readNumber(formData, `width_${index}`);
      const height = readNumber(formData, `height_${index}`);

      await env.R2_BUCKET.put(key, file.stream(), {
        httpMetadata: { contentType, cacheControl: "public, max-age=31536000, immutable" },
        customMetadata: {
          user_id: String(auth.userId),
          content_type: contentType,
          original_filename: originalFilename,
          uploaded_at: new Date().toISOString(),
          ...(width ? { width: String(width) } : {}),
          ...(height ? { height: String(height) } : {}),
        },
      });
      createdKeys.push(key);

      const url = `${publicBaseUrl}/${key}`;
      uploads.push({
        url,
        key,
        contentType,
        size: file.size,
        width,
        height,
        sort_order: index,
        is_primary: index === 0,
        image_url: url,
        mime_type: contentType,
        original_filename: originalFilename,
        size_bytes: file.size,
        image_metadata: { provider: "cloudflare_r2", key, url, contentType, size: file.size, width, height },
      });
    }

    return json(request, env, { success: true, images: uploads });
  } catch (error) {
    try {
      await Promise.all(createdKeys.map((key) => env.R2_BUCKET!.delete(key)));
    } catch (cleanupError) {
      console.warn("R2 partial upload cleanup failed", { keys: createdKeys, error: String(cleanupError) });
    }
    console.error("R2 image upload failed", { createdKeys, error: String(error) });
    return errorResponse(request, env, 500, "UPLOAD_FAILED", "The images could not be uploaded. Please try again.");
  }
}

export async function onRequest({ request, env }: PagesContext) {
  return errorResponse(request, env, 405, "METHOD_NOT_ALLOWED", "Method not allowed.");
}

export const __test = { parseOrigins, isOriginAllowed, validateAuth, validateFiles, buildKey, sanitizeFilename, getAuthenticatedUserId };
