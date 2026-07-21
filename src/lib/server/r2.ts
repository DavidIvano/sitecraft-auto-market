type R2BucketLike = {
  put: (
    key: string,
    value: ReadableStream | ArrayBuffer | Blob,
    options?: {
      httpMetadata?: { contentType?: string; cacheControl?: string };
      customMetadata?: Record<string, string>;
    },
  ) => Promise<unknown>;
  delete: (key: string) => Promise<void>;
};

export type R2Env = {
  R2_BUCKET?: R2BucketLike;
  R2_PUBLIC_BASE_URL?: string;
};

export type R2UploadResult = {
  url: string;
  key: string;
  contentType: "image/webp";
  size: number;
  image_url?: string;
  mime_type?: "image/webp";
  size_bytes?: number;
  image_metadata?: Record<string, unknown>;
};

export function buildPublicUrl(env: R2Env, key: string) {
  const baseUrl = env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, "");

  if (!baseUrl) {
    throw new Error("R2 public URL is not configured");
  }

  return `${baseUrl}/${key}`;
}

export async function uploadImageToR2(
  env: R2Env,
  file: File,
  key: string,
  contentType = "image/webp",
): Promise<R2UploadResult> {
  if (!env.R2_BUCKET) {
    throw new Error("R2 bucket binding is not configured");
  }

  await env.R2_BUCKET.put(key, file.stream(), {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      uploadedBy: "sitecraft-auto-market",
      originalSize: String(file.size),
    },
  });

  const publicUrl = buildPublicUrl(env, key);

  return {
    url: publicUrl,
    key,
    contentType: "image/webp",
    size: file.size,
    image_url: publicUrl,
    mime_type: "image/webp",
    size_bytes: file.size,
    image_metadata: {
      provider: "cloudflare_r2",
      key,
      url: publicUrl,
      contentType: "image/webp",
      size: file.size,
    },
  };
}

export async function deleteImageFromR2(env: R2Env, key: string) {
  if (!env.R2_BUCKET) {
    throw new Error("R2 bucket binding is not configured");
  }

  await env.R2_BUCKET.delete(key);
}

export async function deleteImagesFromR2(env: R2Env, keys: string[]) {
  await Promise.all(keys.filter(Boolean).map((key) => deleteImageFromR2(env, key)));
}
