export const IMAGE_MASTER_MAX_BYTES = 150 * 1024;
export const IMAGE_MASTER_MAX_DIMENSION = 1600;
export const IMAGE_SOURCE_MAX_BYTES = 10 * 1024 * 1024;
export const IMAGE_SOURCE_MAX_DIMENSION = 12_000;
export const IMAGE_SOURCE_MAX_PIXELS = 100_000_000;

export type ImageInfo = {
  format?: string;
  fileSize?: number;
  width?: number;
  height?: number;
};

type ImageTransformer = {
  transform(options: Record<string, unknown>): ImageTransformer;
  output(options: Record<string, unknown>): Promise<{ response(): Response }>;
};

export type ImagesBinding = {
  info(input: ReadableStream): Promise<ImageInfo>;
  input(input: ReadableStream): ImageTransformer;
};

export type ProcessedImage = {
  bytes: ArrayBuffer;
  width: number;
  height: number;
  sourceType: string;
  contentType: "image/webp";
};

export class ImagePipelineError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.slice(start, start + length));

export function detectImageType(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "image/webp";
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 3) === "PNG" && bytes[4] === 0x0d && bytes[5] === 0x0a) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4).toLowerCase();
    if (["avif", "avis"].includes(brand)) return "image/avif";
    if (["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(brand)) return "image/heic";
  }
  return "";
}

function readUint24LE(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

export function readWebPDimensions(buffer: ArrayBuffer): { width: number; height: number } | null {
  const bytes = new Uint8Array(buffer);
  if (detectImageType(buffer) !== "image/webp" || bytes.length < 30) return null;
  const chunk = ascii(bytes, 12, 4);

  if (chunk === "VP8X") {
    return { width: readUint24LE(bytes, 24) + 1, height: readUint24LE(bytes, 27) + 1 };
  }
  if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8 " && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return {
      width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
      height: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
    };
  }
  return null;
}

function normalizeDeclaredType(file: File) {
  const declared = file.type.toLowerCase();
  if (declared) return declared === "image/heif" ? "image/heic" : declared;
  const extension = file.name.split(".").pop()?.toLowerCase();
  return ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif", heic: "image/heic", heif: "image/heic" } as Record<string, string>)[extension || ""] || "";
}

function validateDimensions(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new ImagePipelineError("INVALID_IMAGE_DIMENSIONS", "The image dimensions could not be verified.");
  }
  if (width > IMAGE_SOURCE_MAX_DIMENSION || height > IMAGE_SOURCE_MAX_DIMENSION || width * height > IMAGE_SOURCE_MAX_PIXELS) {
    throw new ImagePipelineError("INVALID_IMAGE_DIMENSIONS", "The image dimensions exceed the supported limits.", 413);
  }
}

const streamFor = (bytes: ArrayBuffer) => new Blob([bytes]).stream();

const conversionSteps = [
  { width: 1600, quality: 78 },
  { width: 1600, quality: 66 },
  { width: 1440, quality: 62 },
  { width: 1280, quality: 60 },
  { width: 1120, quality: 56 },
  { width: 960, quality: 52 },
  { width: 800, quality: 50 },
];

export async function processUploadedImage(file: File, images?: ImagesBinding): Promise<ProcessedImage> {
  const bytes = await file.arrayBuffer();
  const sourceType = detectImageType(bytes);
  const declaredType = normalizeDeclaredType(file);

  if (!sourceType) throw new ImagePipelineError("INVALID_IMAGE_SIGNATURE", "The file signature is not a supported image.");
  if (!declaredType || sourceType !== declaredType) {
    throw new ImagePipelineError("IMAGE_TYPE_MISMATCH", "The declared image type does not match its file signature.");
  }

  if (sourceType === "image/webp") {
    const dimensions = readWebPDimensions(bytes);
    if (dimensions) {
      validateDimensions(dimensions.width, dimensions.height);
      if (bytes.byteLength <= IMAGE_MASTER_MAX_BYTES && Math.max(dimensions.width, dimensions.height) <= IMAGE_MASTER_MAX_DIMENSION) {
        return { bytes, ...dimensions, sourceType, contentType: "image/webp" };
      }
    }
  }

  if (!images) {
    throw new ImagePipelineError(
      "IMAGE_OPTIMIZER_MISSING",
      "Cloudflare Images is required to convert this source before storage.",
      503,
    );
  }

  let info: ImageInfo;
  try {
    info = await images.info(streamFor(bytes));
  } catch {
    throw new ImagePipelineError("INVALID_IMAGE_DIMENSIONS", "Cloudflare could not inspect this image.");
  }
  validateDimensions(Number(info.width), Number(info.height));

  for (const step of conversionSteps) {
    const targetWidth = Math.min(step.width, Number(info.width));
    try {
      const result = await images
        .input(streamFor(bytes))
        .transform({ width: targetWidth, fit: "scale-down" })
        .output({ format: "image/webp", quality: step.quality, anim: false });
      const response = result.response();
      if (!response.ok) continue;
      const candidate = await response.arrayBuffer();
      const dimensions = readWebPDimensions(candidate);
      if (!dimensions) continue;
      validateDimensions(dimensions.width, dimensions.height);
      if (candidate.byteLength <= IMAGE_MASTER_MAX_BYTES && Math.max(dimensions.width, dimensions.height) <= IMAGE_MASTER_MAX_DIMENSION) {
        return { bytes: candidate, ...dimensions, sourceType, contentType: "image/webp" };
      }
    } catch {
      // Continue with the next bounded quality/dimension step.
    }
  }

  throw new ImagePipelineError("IMAGE_OPTIMIZATION_FAILED", "The image could not be reduced to the storage budget.", 422);
}

export function buildVariantUrl(url: string, width: number, quality: number) {
  const variantUrl = new URL(url);
  variantUrl.searchParams.set("width", String(width));
  variantUrl.searchParams.set("quality", String(quality));
  return variantUrl.toString();
}
