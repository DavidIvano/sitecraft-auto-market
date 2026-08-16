export const IMAGE_MASTER_MAX_WIDTH = 1600;
export const IMAGE_MASTER_MAX_HEIGHT = 1600;
export const IMAGE_MASTER_MAX_BYTES = 150 * 1024;
const DEFAULT_WEBP_QUALITY = 0.82;
const RETRY_WEBP_QUALITY = 0.68;

const SUPPORTED_IMAGE_TYPES = new Set(["image/avif", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const HEIC_TYPES = new Set(["image/heic", "image/heif"]);

export type CompressImageOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  retryQuality?: number;
  outputType?: "image/webp";
  maxOutputSize?: number;
  suffix?: string;
};

export type CompressedImageResult = {
  file: File;
  originalName: string;
  originalSize: number;
  originalType: string;
  compressedSize: number;
  outputType: "image/webp";
  width: number;
  height: number;
  compressionRatio: number;
};

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

export function isHeicImage(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return HEIC_TYPES.has(file.type) || extension === "heic" || extension === "heif";
}

function assertSupportedImage(file: File) {
  if (!(file instanceof File) || (!file.type.startsWith("image/") && !isHeicImage(file))) {
    throw new Error("Выберите файл изображения.");
  }

  if (file.type && !SUPPORTED_IMAGE_TYPES.has(file.type) && !isHeicImage(file)) {
    throw new Error("Поддерживаются изображения HEIC, AVIF, JPG, PNG или WebP.");
  }
}

function buildSafeName(file: File, suffix: string) {
  const baseName = file.name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const safeSuffix = suffix.endsWith(".webp") ? suffix : `${suffix}.webp`;

  return `${baseName || "car-photo"}-${crypto.randomUUID()}${safeSuffix}`;
}

type LoadedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
};

async function loadHeicImage(file: File): Promise<LoadedImage> {
  try {
    // Keep the ~3 MB decoder out of ordinary page bundles. It is downloaded
    // only when a user selects an HEIC/HEIF file, and the CSP build avoids
    // eval-based WebAssembly initialization.
    const { heicTo } = await import("heic-to/csp");
    const bitmap = await heicTo({
      blob: file,
      type: "bitmap",
      options: { imageOrientation: "from-image" },
    });

    if (!bitmap.width || !bitmap.height) {
      bitmap.close();
      throw new Error("Decoded HEIC image has invalid dimensions.");
    }

    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  } catch {
    throw new Error("Не удалось прочитать HEIC-фотографию. Возможно, файл повреждён или использует неподдерживаемый вариант HEIF.");
  }
}

async function loadImage(file: File): Promise<LoadedImage> {
  if (isHeicImage(file)) {
    return loadHeicImage(file);
  }

  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(file);

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Не удалось прочитать изображение."));
    img.src = objectUrl;
  });

  return {
    source: image,
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
    close: () => URL.revokeObjectURL(objectUrl),
  };
}

function calculateSize(width: number, height: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(1, maxWidth / width, maxHeight / height);

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

let nativeWebPEncodingSupported: boolean | undefined;

async function canvasToNativeWebP(canvas: HTMLCanvasElement, quality: number) {
  if (nativeWebPEncodingSupported === false) return null;

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", quality);
  });

  // Some Safari/iOS versions silently fall back to PNG when WebP encoding is
  // unavailable. Treating that PNG as WebP makes the quality loop ineffective
  // and eventually produces the generic conversion error.
  nativeWebPEncodingSupported = blob?.type.toLowerCase() === "image/webp";
  return nativeWebPEncodingSupported ? blob : null;
}

async function canvasToWasmWebP(canvas: HTMLCanvasElement, quality: number, targetSize: number) {
  const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  if (!context) return null;

  // This fallback is downloaded only when the browser cannot encode WebP
  // natively. libwebp's target_size avoids repeatedly encoding the same large
  // iPhone photo at many quality levels on a mobile CPU.
  const { default: encode } = await import("@jsquash/webp/encode.js");
  const encoded = await encode(context.getImageData(0, 0, canvas.width, canvas.height), {
    quality: Math.round(quality * 100),
    target_size: targetSize,
    method: 4,
    pass: 2,
  });

  return new Blob([encoded], { type: "image/webp" });
}

function buildQualitySteps(primaryQuality: number, retryQuality: number) {
  return [primaryQuality, 0.76, retryQuality, 0.6, 0.52, 0.45, 0.38]
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 1)
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort((left, right) => right - left);
}

export async function compressImageToWebP(
  file: File,
  options: CompressImageOptions = {},
): Promise<CompressedImageResult> {
  assertSupportedImage(file);

  const maxWidth = options.maxWidth ?? IMAGE_MASTER_MAX_WIDTH;
  const maxHeight = options.maxHeight ?? IMAGE_MASTER_MAX_HEIGHT;
  const quality = options.quality ?? DEFAULT_WEBP_QUALITY;
  const retryQuality = options.retryQuality ?? RETRY_WEBP_QUALITY;
  const maxOutputSize = options.maxOutputSize ?? IMAGE_MASTER_MAX_BYTES;
  const suffix = options.suffix ?? "-optimized.webp";

  let image: LoadedImage;

  try {
    image = await loadImage(file);
  } catch {
    if (isHeicImage(file)) throw new Error("Не удалось конвертировать HEIC в WebP. Выберите другую фотографию.");
    throw new Error("Не удалось прочитать фотографию. Выберите другое изображение.");
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });

  if (!context) {
    image.close();
    throw new Error("Браузер не смог подготовить изображение к загрузке.");
  }

  const qualitySteps = buildQualitySteps(quality, retryQuality);
  let scale = 1;
  let size = calculateSize(image.width, image.height, maxWidth, maxHeight);
  let blob: Blob | null = null;
  let bestBlob: Blob | null = null;
  let bestSize = size;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  // First reduce encoding quality, then dimensions. The browser never uploads
  // the multi-megabyte camera original when it can decode the source itself.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    size = calculateSize(image.width, image.height, Math.round(maxWidth * scale), Math.round(maxHeight * scale));
    canvas.width = size.width;
    canvas.height = size.height;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.clearRect(0, 0, size.width, size.height);
    context.drawImage(image.source, 0, 0, size.width, size.height);

    for (const qualityStep of qualitySteps) {
      const candidate = await canvasToNativeWebP(canvas, qualityStep);

      if (!candidate) {
        if (nativeWebPEncodingSupported === false) break;
        continue;
      }

      if (!bestBlob || candidate.size < bestBlob.size) {
        bestBlob = candidate;
        bestSize = size;
      }

      if (candidate.size <= maxOutputSize) {
        blob = candidate;
        break;
      }
    }

    if (!blob && nativeWebPEncodingSupported === false) {
      const candidate = await canvasToWasmWebP(canvas, retryQuality, maxOutputSize);

      if (candidate && (!bestBlob || candidate.size < bestBlob.size)) {
        bestBlob = candidate;
        bestSize = size;
      }

      if (candidate && candidate.size <= maxOutputSize) {
        blob = candidate;
      }
    }

    if (blob) {
      break;
    }

    scale *= 0.86;
  }

  image.close();

  if (!blob && bestBlob && bestBlob.size <= maxOutputSize) {
    blob = bestBlob;
    size = bestSize;
  }

  if (!blob) {
    throw new Error("Не удалось конвертировать изображение в WebP.");
  }

  if (blob.size > maxOutputSize) {
    throw new Error("Фото осталось слишком большим после сжатия. Выберите другое фото или уменьшите его размер.");
  }

  const webpFile = new File([blob], buildSafeName(file, suffix), {
    type: options.outputType ?? "image/webp",
    lastModified: Date.now(),
  });
  const compressionRatio = file.size > 0 ? Number((blob.size / file.size).toFixed(4)) : 1;

  return {
    file: webpFile,
    originalName: file.name || "car-photo",
    originalSize: file.size,
    originalType: file.type,
    compressedSize: blob.size,
    outputType: "image/webp",
    width: size.width,
    height: size.height,
    compressionRatio,
  };
}

export async function compressAndConvertToWebP(file: File): Promise<File> {
  const result = await compressImageToWebP(file);
  return result.file;
}
