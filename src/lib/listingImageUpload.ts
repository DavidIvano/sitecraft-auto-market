import {
  IMAGE_MASTER_MAX_BYTES,
  compressImageToWebP,
  formatBytes,
  isHeicImage,
  type CompressedImageResult,
} from "./imageCompression";
import { getAuthToken } from "./authClient";

export type UploadedListingImage = {
  url: string;
  key: string;
  contentType: "image/webp";
  size: number;
  image_url?: string;
  mime_type?: "image/webp";
  original_filename?: string;
  size_bytes?: number;
  width?: number;
  height?: number;
  sort_order?: number;
  is_primary?: boolean;
  image_metadata?: Record<string, unknown>;
};

export type ListingImageUploadOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxOutputSize?: number;
  onProgress?: (message: string, info?: CompressedImageResult & { index: number }) => void;
};

const DEFAULT_UPLOAD_URL = import.meta.env.PUBLIC_IMAGE_UPLOAD_URL || "/api/upload-listing-images";
const MAX_SERVER_CONVERSION_BYTES = 10 * 1024 * 1024;

export function buildUploadRequestHeaders(authToken: string) {
  return new Headers({ Authorization: `Bearer ${authToken}` });
}

function buildMetadata(result: CompressedImageResult, imageUrl = "") {
  return {
    original: {
      name: result.originalName,
      size: result.originalSize,
      type: result.originalType,
    },
    optimized: {
      url: imageUrl,
      width: result.width,
      height: result.height,
      size: result.compressedSize,
      type: result.outputType,
    },
    variants: {
      thumb: {
        url: imageUrl,
        width: Math.min(480, result.width),
        height: Math.min(360, result.height),
      },
      card: {
        url: imageUrl,
        width: Math.min(800, result.width),
        height: Math.min(720, result.height),
      },
      detail: {
        url: imageUrl,
        width: result.width,
        height: result.height,
      },
    },
    original_size: result.originalSize,
    compressed_size: result.compressedSize,
    compression_ratio: result.compressionRatio,
    width: result.width,
    height: result.height,
    is_optimized: true,
    format: "webp",
  };
}

function normalizePayload(payload: unknown): UploadedListingImage[] {
  if (Array.isArray(payload)) {
    return payload as UploadedListingImage[];
  }

  if (payload && typeof payload === "object" && "images" in payload) {
    const images = (payload as { images?: unknown }).images;
    return Array.isArray(images) ? (images as UploadedListingImage[]) : [];
  }

  return [];
}

function isPublicUploadedUrl(value: unknown) {
  const url = String(value || "").trim();

  return /^https?:\/\//i.test(url) && !/^(blob|data|file):/i.test(url);
}

export async function uploadListingImages(
  files: File[],
  options: ListingImageUploadOptions = {},
  uploadUrl = DEFAULT_UPLOAD_URL,
): Promise<UploadedListingImage[]> {
  if (files.length === 0) {
    return [];
  }

  const authToken = String(getAuthToken() || "").trim();
  if (!authToken) {
    throw new Error("Сессия истекла. Войдите снова.");
  }

  const formData = new FormData();
  const compressedImages: CompressedImageResult[] = [];

  for (const [index, file] of files.entries()) {
    options.onProgress?.(`Сжимаем фото ${index + 1}...`);
    let result: CompressedImageResult;

    try {
      result = await compressImageToWebP(file, {
        maxWidth: options.maxWidth,
        maxHeight: options.maxHeight,
        quality: options.quality,
        maxOutputSize: options.maxOutputSize ?? IMAGE_MASTER_MAX_BYTES,
        suffix: "-master.webp",
      });
      formData.append("files", result.file);
    } catch (error) {
      const needsServerConversion = isHeicImage(file) && error instanceof Error && error.message === "HEIC_REQUIRES_SERVER_CONVERSION";
      if (!needsServerConversion) throw error;
      if (file.size > MAX_SERVER_CONVERSION_BYTES) {
        throw new Error("Фото HEIC больше 10 МБ. Уменьшите его или выберите совместимый формат камеры iPhone.");
      }

      // HEIC is the only source that may reach the server uncompressed. The
      // upload Function must convert it with Cloudflare Images before R2.put.
      result = {
        file,
        originalName: file.name || "iphone-photo.heic",
        originalSize: file.size,
        originalType: file.type || "image/heic",
        compressedSize: file.size,
        outputType: "image/webp",
        width: 0,
        height: 0,
        compressionRatio: 1,
      };
      formData.append("files", file);
      formData.append(`server_conversion_${index}`, "heic");
      options.onProgress?.(`Фото ${index + 1}: конвертируем HEIC на защищённом сервере...`);
    }

    compressedImages.push(result);
    formData.append(`metadata_${index}`, JSON.stringify(buildMetadata(result)));
    formData.append(`original_filename_${index}`, result.originalName);
    formData.append(`original_size_${index}`, String(result.originalSize));
    formData.append(`original_type_${index}`, result.originalType);
    formData.append(`compressed_size_${index}`, String(result.compressedSize));
    formData.append(`compression_ratio_${index}`, String(result.compressionRatio));
    formData.append(`width_${index}`, String(result.width));
    formData.append(`height_${index}`, String(result.height));
    options.onProgress?.(
      `Фото ${index + 1}: ${formatBytes(result.originalSize)} -> ${formatBytes(result.compressedSize)}, WebP`,
      { ...result, index },
    );
  }

  options.onProgress?.("Загружаем оптимизированные изображения...");

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildUploadRequestHeaders(authToken),
    body: formData,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const code = payload && typeof payload === "object" && "code" in payload ? String(payload.code) : "";
    const message =
      response.status === 401
        ? "Сессия истекла. Войдите снова."
        : code === "ORIGIN_NOT_ALLOWED"
          ? "Загрузка изображений недоступна с этого адреса сайта."
            : code === "FILE_TOO_LARGE" || code === "BATCH_TOO_LARGE"
              ? "Одно или несколько изображений слишком большие. Попробуйте загрузить фотографии меньшего размера."
            : code === "INVALID_IMAGE_SIGNATURE" || code === "IMAGE_TYPE_MISMATCH" || code === "INVALID_IMAGE_DIMENSIONS"
              ? "Файл не является корректной фотографией или имеет повреждённый формат."
            : code === "IMAGE_OPTIMIZER_MISSING"
              ? "HEIC пока не может быть преобразован на сервере. Подключите Cloudflare Images или выберите JPG/WebP."
            : code === "IMAGE_OPTIMIZATION_FAILED"
              ? "Фото не удалось уменьшить до безопасного размера. Выберите другое изображение."
            : code === "AUTH_CONFIGURATION_MISSING"
              ? "Авторизация загрузки временно недоступна."
              : code === "AUTH_SERVICE_UNAVAILABLE"
                ? "Не удалось проверить сессию. Попробуйте ещё раз."
                : code === "R2_BINDING_MISSING" || code === "R2_PUBLIC_URL_MISSING"
                  ? "Хранилище изображений временно недоступно."
                : response.status === 404
                  ? "Загрузка фото временно не подключена."
                  : "Не удалось загрузить фото.";
    throw new Error(message);
  }

  const uploads = normalizePayload(payload);

  if (uploads.length === 0) {
    throw new Error("Фото не загружено в хранилище. Нужна публичная ссылка изображения.");
  }

  return uploads.map((item, index) => {
    const result = compressedImages[index];
    const upload = item as UploadedListingImage;
    const imageUrl = upload.image_url || upload.url || "";

    if (!isPublicUploadedUrl(imageUrl)) {
      throw new Error("Фото не загружено в хранилище. Нужна публичная ссылка изображения.");
    }

    const metadata = buildMetadata(result, imageUrl);
    const serverMetadata = upload.image_metadata || {};
    const serverOptimized = serverMetadata.optimized && typeof serverMetadata.optimized === "object"
      ? serverMetadata.optimized
      : metadata.optimized;

    return {
      ...upload,
      url: imageUrl,
      image_url: imageUrl,
      contentType: "image/webp",
      mime_type: "image/webp",
      size: upload.size || result.compressedSize,
      size_bytes: upload.size_bytes || upload.size || result.compressedSize,
      width: upload.width || result.width,
      height: upload.height || result.height,
      original_filename: upload.original_filename || result.originalName,
      sort_order: upload.sort_order ?? index,
      is_primary: upload.is_primary ?? index === 0,
      image_metadata: {
        ...metadata,
        ...serverMetadata,
        optimized: serverOptimized,
        is_optimized: true,
        format: "webp",
      },
    };
  });
}
