import assert from "node:assert/strict";
import test from "node:test";
import {
  IMAGE_MASTER_MAX_BYTES,
  ImagePipelineError,
  detectImageType,
  processUploadedImage,
  readWebPDimensions,
} from "../functions/lib/imagePipeline.ts";
import { getCarCardImagePresentation, getCarDetailImagePresentations, getCarThumbnailImagePresentations } from "../src/lib/imageUrls.ts";
import type { CarListing } from "../src/lib/types.ts";

function webp(width = 800, height = 500, size = 30) {
  const bytes = new Uint8Array(Math.max(30, size));
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  bytes.set([0x56, 0x50, 0x38, 0x58], 12);
  const write24 = (offset: number, value: number) => bytes.set([value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff], offset);
  write24(24, width - 1);
  write24(27, height - 1);
  return bytes;
}

test("image pipeline verifies WebP signatures and dimensions", async () => {
  const bytes = webp(1600, 1000, IMAGE_MASTER_MAX_BYTES);
  assert.equal(detectImageType(bytes.buffer), "image/webp");
  assert.deepEqual(readWebPDimensions(bytes.buffer), { width: 1600, height: 1000 });
  const result = await processUploadedImage(new File([bytes], "car.webp", { type: "image/webp" }));
  assert.equal(result.bytes.byteLength, IMAGE_MASTER_MAX_BYTES);
  assert.equal(result.contentType, "image/webp");
});

test("oversized masters fail closed when the image optimizer is unavailable", async () => {
  const bytes = webp(2000, 1200, IMAGE_MASTER_MAX_BYTES + 1);
  await assert.rejects(
    () => processUploadedImage(new File([bytes], "large.webp", { type: "image/webp" })),
    (error) => error instanceof ImagePipelineError && error.code === "IMAGE_OPTIMIZER_MISSING",
  );
});

test("responsive R2 presentations expose bounded card and detail srcsets", () => {
  const url = "https://automarket.sitecraft.agency/api/r2-images/listing-images/1/car.webp";
  const car = {
    id: 1,
    slug: "test-car",
    title: "Test Car",
    images: [{
      id: 1,
      car_listing_id: 1,
      image_url: url,
      image_metadata: { width: 1600, height: 1000, optimized: { url, width: 1600, height: 1000 } },
      sort_order: 0,
      is_main: true,
    }],
  } as unknown as CarListing;
  const card = getCarCardImagePresentation(car);
  const detail = getCarDetailImagePresentations(car)[0];
  const thumb = getCarThumbnailImagePresentations(car)[0];
  assert.match(thumb.srcset, /width=320.*320w/);
  assert.match(thumb.srcset, /width=480.*480w/);
  assert.match(card.srcset, /width=480.*480w/);
  assert.match(card.srcset, /width=800.*800w/);
  assert.match(detail.srcset, /width=640.*640w/);
  assert.match(detail.srcset, /width=1600.*1600w/);
  assert.equal(card.width, 800);
  assert.equal(detail.width, 1600);
  assert.equal(thumb.width, 480);
});
