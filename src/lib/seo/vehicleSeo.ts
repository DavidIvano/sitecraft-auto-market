import { getCarDetailImageUrls } from "../imageUrls.ts";
import { sanitizePublicDescription } from "../listingFields.ts";
import type { CarListing } from "../types.ts";

const DEFAULT_SITE_URL = "https://automarket.sitecraft.agency";
const DEFAULT_IMAGE_PATH = "/deal-finder-placeholder.svg";
const VIN_PATTERN = /\b[A-HJ-NPR-Z0-9]{17}\b/gi;

const text = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const positiveNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
const optional = <T>(value: T | null | undefined, field: string) => (
  value === null || value === undefined || value === "" ? {} : { [field]: value }
);
const absolutePublicImage = (value: string, origin: URL) => {
  try {
    const url = new URL(value, origin);
    return url.protocol === "https:" ? url.toString() : new URL(DEFAULT_IMAGE_PATH, origin).toString();
  } catch {
    return new URL(DEFAULT_IMAGE_PATH, origin).toString();
  }
};

export function sanitizeVehicleSeoText(value: unknown) {
  return sanitizePublicDescription(String(value ?? "").replace(VIN_PATTERN, ""))
    .replace(/\s+/g, " ")
    .trim();
}

export function buildVehicleSeo(car: CarListing, siteUrl = DEFAULT_SITE_URL) {
  const origin = new URL(siteUrl || DEFAULT_SITE_URL);
  const canonicalUrl = new URL(`/cars/${encodeURIComponent(car.slug)}`, origin).toString();
  const brand = text(car.brand);
  const model = text(car.model);
  const year = positiveNumber(car.year);
  const city = text(car.city);
  const price = positiveNumber(car.price);
  const mileage = positiveNumber(car.mileage);
  const currency = /^[A-Z]{3}$/.test(text(car.currency).toUpperCase())
    ? text(car.currency).toUpperCase()
    : "EUR";
  const heading = [brand, model, year].filter(Boolean).join(" ") || text(car.title) || "Автомобиль";
  const title = [heading, "купить", city ? `в ${city}` : ""].filter(Boolean).join(" ");
  const priceLabel = price === null
    ? ""
    : new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(price);
  const facts = [
    heading,
    priceLabel ? `цена ${priceLabel}` : "",
    mileage === null ? "" : `пробег ${mileage.toLocaleString("ru-RU")} км`,
    text(car.fuel_type) ? `топливо ${text(car.fuel_type)}` : "",
    text(car.transmission) ? `коробка ${text(car.transmission)}` : "",
    city ? `город ${city}` : "",
  ].filter(Boolean);
  const sourceDescription = sanitizeVehicleSeoText(car.description);
  const description = `${facts.join(", ")}.${sourceDescription ? ` ${sourceDescription}` : ""}`.slice(0, 260).trim();
  const rawImage = getCarDetailImageUrls(car)[0] || DEFAULT_IMAGE_PATH;
  const imageUrl = absolutePublicImage(rawImage, origin);
  const imageAlt = [heading, city].filter(Boolean).join(", ");
  const sold = car.status === "sold" || car.moderation_status === "sold" || Boolean(car.sold_at);
  const offerId = `${canonicalUrl}#offer`;

  const offer: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Offer",
    "@id": offerId,
    url: canonicalUrl,
    ...optional(price, "price"),
    priceCurrency: currency,
    availability: sold ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
  };

  const vehicle = {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    "@id": `${canonicalUrl}#vehicle`,
    url: canonicalUrl,
    name: heading,
    description,
    image: [imageUrl],
    ...optional(brand ? { "@type": "Brand", name: brand } : null, "brand"),
    ...optional(model, "model"),
    ...optional(year ? String(year) : null, "vehicleModelDate"),
    ...optional(mileage === null ? null : {
      "@type": "QuantitativeValue",
      value: mileage,
      unitCode: "KMT",
    }, "mileageFromOdometer"),
    ...optional(text(car.fuel_type), "fuelType"),
    ...optional(text(car.transmission), "vehicleTransmission"),
    ...optional(text(car.body_type), "bodyType"),
    ...optional(text(car.color), "color"),
    offers: { "@id": offerId },
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Главная", item: new URL("/", origin).toString() },
      { "@type": "ListItem", position: 2, name: "Автомобили", item: new URL("/cars", origin).toString() },
      { "@type": "ListItem", position: 3, name: heading, item: canonicalUrl },
    ],
  };

  return {
    title,
    heading,
    description,
    canonicalUrl,
    imageUrl,
    imageAlt,
    vehicle,
    offer,
    breadcrumb,
  };
}
