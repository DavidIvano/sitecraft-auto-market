import { getIntlLocale } from "../../i18n/locale.ts";
import { getPublicPageMessages } from "../../i18n/publicRoutes.ts";
import type { PublicListingDto } from "../../i18n/publicListing.ts";
import { normalizeBackendValue } from "../../i18n/backendValues.ts";
import { getVehicleTaxonomyLabel, type VehicleTaxonomyName } from "../../domain/vehicleTaxonomy.ts";
import { getCarDetailImageUrls } from "../imageUrls.ts";
import { sanitizePublicDescription } from "../listingFields.ts";
import type { CarListing } from "../types.ts";
import { buildListingSeoTaxonomyLinks } from "./taxonomies.ts";

const DEFAULT_SITE_URL = "https://automarket.sitecraft.agency";
const DEFAULT_IMAGE = "/deal-finder-placeholder.svg";
const clean = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const VIN_PATTERN = /\b[A-HJ-NPR-Z0-9]{17}\b/gi;

const localizedTaxonomyValue = (taxonomy: VehicleTaxonomyName, value: unknown, locale: string) => {
  const normalized = normalizeBackendValue(taxonomy, value);
  return normalized ? getVehicleTaxonomyLabel(taxonomy, normalized, locale) : "";
};

const safePublicImageUrl = (value: unknown, origin: URL) => {
  try {
    const candidate = new URL(clean(value) || DEFAULT_IMAGE, origin);
    return candidate.protocol === "https:" ? candidate.toString() : new URL(DEFAULT_IMAGE, origin).toString();
  } catch {
    return new URL(DEFAULT_IMAGE, origin).toString();
  }
};

export function sanitizeVehicleSeoText(value: unknown) {
  return sanitizePublicDescription(String(value ?? "").replace(VIN_PATTERN, ""))
    .replace(/\s+/g, " ")
    .trim();
}

// Compatibility builder for the still-live unprefixed Russian route. New
// locale-prefixed routes use buildLocalizedVehicleSeo below.
export function buildVehicleSeo(car: CarListing, siteUrl = DEFAULT_SITE_URL) {
  const origin = new URL(siteUrl || DEFAULT_SITE_URL);
  const canonicalUrl = new URL(`/cars/${encodeURIComponent(car.slug)}`, origin).toString();
  const brand = clean(car.brand);
  const model = clean(car.model);
  const year = Number(car.year) > 0 ? Number(car.year) : null;
  const city = clean(car.city);
  const price = Number(car.price) > 0 ? Number(car.price) : null;
  const mileage = Number(car.mileage) > 0 ? Number(car.mileage) : null;
  const currency = /^[A-Z]{3}$/.test(clean(car.currency).toUpperCase()) ? clean(car.currency).toUpperCase() : "EUR";
  const heading = [brand, model, year].filter(Boolean).join(" ") || clean(car.title) || "Автомобиль";
  const title = [heading, "купить", city ? `в ${city}` : ""].filter(Boolean).join(" ");
  const priceLabel = price === null ? "" : new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 0 }).format(price);
  const facts = [
    heading,
    priceLabel ? `цена ${priceLabel}` : "",
    mileage === null ? "" : `пробег ${mileage.toLocaleString("ru-RU")} км`,
    clean(car.fuel_type) ? `топливо ${clean(car.fuel_type)}` : "",
    clean(car.transmission) ? `коробка ${clean(car.transmission)}` : "",
    city ? `город ${city}` : "",
  ].filter(Boolean);
  const sourceDescription = sanitizeVehicleSeoText(car.description);
  const description = `${facts.join(", ")}.${sourceDescription ? ` ${sourceDescription}` : ""}`.slice(0, 260).trim();
  const rawImage = getCarDetailImageUrls(car)[0] || DEFAULT_IMAGE;
  let imageUrl = new URL(DEFAULT_IMAGE, origin).toString();
  try {
    const candidate = new URL(rawImage, origin);
    if (candidate.protocol === "https:") imageUrl = candidate.toString();
  } catch {
    // Keep the public fallback image.
  }
  const imageAlt = [heading, city].filter(Boolean).join(", ");
  const sold = car.status === "sold" || car.moderation_status === "sold" || Boolean(car.sold_at);
  const offerId = `${canonicalUrl}#offer`;
  const offer: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Offer",
    "@id": offerId,
    url: canonicalUrl,
    ...(price === null ? {} : { price }),
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
    ...(brand ? { brand: { "@type": "Brand", name: brand } } : {}),
    ...(model ? { model } : {}),
    ...(year ? { vehicleModelDate: String(year) } : {}),
    ...(mileage === null ? {} : { mileageFromOdometer: { "@type": "QuantitativeValue", value: mileage, unitCode: "KMT" } }),
    ...(clean(car.fuel_type) ? { fuelType: clean(car.fuel_type) } : {}),
    ...(clean(car.transmission) ? { vehicleTransmission: clean(car.transmission) } : {}),
    ...(clean(car.body_type) ? { bodyType: clean(car.body_type) } : {}),
    ...(clean(car.color) ? { color: clean(car.color) } : {}),
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
  return { title, heading, description, canonicalUrl, imageUrl, imageAlt, vehicle, offer, breadcrumb };
}

export function buildLocalizedVehicleSeo(car: PublicListingDto, locale: string, siteUrl = DEFAULT_SITE_URL) {
  const origin = new URL(siteUrl || DEFAULT_SITE_URL);
  const intlLocale = getIntlLocale(locale);
  const messages = getPublicPageMessages(locale);
  const canonicalUrl = new URL(`/${locale}/cars/${encodeURIComponent(car.slug)}/`, origin).toString();
  // The strict locale endpoint already resolves the public title for the
  // requested language. Prefer it over a generated brand/model/year label so
  // SSR, metadata and JSON-LD never discard a reviewed translation.
  const heading = clean(car.title) || [clean(car.brand), clean(car.model), car.year || ""].filter(Boolean).join(" ");
  const price = new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: car.currency || "EUR",
    maximumFractionDigits: 0,
  }).format(car.price);
  const mileage = new Intl.NumberFormat(intlLocale).format(car.mileage);
  const publicDescription = sanitizeVehicleSeoText(car.description);
  const description = `${heading}. ${price}, ${mileage} km${car.city ? `, ${clean(car.city)}` : ""}.${publicDescription ? ` ${publicDescription}` : ""}`.slice(0, 300).trim();
  const imageUrl = safePublicImageUrl(car.image_urls[0], origin);
  const offerId = `${canonicalUrl}#offer`;
  const vehicleId = `${canonicalUrl}#vehicle`;
  const fuelType = localizedTaxonomyValue("fuel_type", car.fuel_type, locale);
  const transmission = localizedTaxonomyValue("transmission", car.transmission, locale);
  const bodyType = localizedTaxonomyValue("body_type", car.body_type, locale);
  const color = localizedTaxonomyValue("color", car.color, locale);
  const taxonomyLinks = buildListingSeoTaxonomyLinks(car, locale);
  const brandLink = taxonomyLinks.find((link) => link.type === "brand");
  const modelLink = taxonomyLinks.find((link) => link.type === "model");
  const brandUrl = brandLink ? new URL(brandLink.href, origin).toString() : undefined;

  const offer = {
    "@context": "https://schema.org",
    "@type": "Offer",
    "@id": offerId,
    url: canonicalUrl,
    price: car.price,
    priceCurrency: car.currency || "EUR",
    availability: "https://schema.org/InStock",
    itemOffered: { "@id": vehicleId },
    ...(car.city || car.country ? {
      availableAtOrFrom: {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          ...(car.city ? { addressLocality: clean(car.city) } : {}),
          ...(car.country ? { addressCountry: clean(car.country) } : {}),
        },
      },
    } : {}),
  };
  const vehicle = {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    "@id": vehicleId,
    url: canonicalUrl,
    mainEntityOfPage: canonicalUrl,
    name: heading,
    description,
    inLanguage: locale,
    image: [imageUrl],
    brand: car.brand ? { "@type": "Brand", name: car.brand, ...(brandUrl ? { url: brandUrl } : {}) } : undefined,
    model: car.model || undefined,
    vehicleModelDate: car.year ? String(car.year) : undefined,
    mileageFromOdometer: car.mileage > 0 ? { "@type": "QuantitativeValue", value: car.mileage, unitCode: "KMT" } : undefined,
    fuelType: fuelType || undefined,
    vehicleTransmission: transmission || undefined,
    bodyType: bodyType || undefined,
    color: color || undefined,
    offers: { "@id": offerId },
  };
  const breadcrumbs = [
    { href: `/${locale}/`, label: messages.homeTitle },
    { href: `/${locale}/cars/`, label: messages.catalogTitle },
    ...(brandLink ? [{ href: brandLink.href, label: brandLink.label }] : []),
    ...(modelLink ? [{ href: modelLink.href, label: modelLink.label }] : []),
    { label: heading },
  ];
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    inLanguage: locale,
    itemListElement: breadcrumbs.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: new URL(item.href || canonicalUrl, origin).toString(),
    })),
  };

  return {
    title: `${heading}${car.city ? ` · ${clean(car.city)}` : ""}`,
    heading,
    description,
    canonicalUrl,
    imageUrl,
    imageAlt: `${heading}${car.city ? ` · ${clean(car.city)}` : ""}`,
    offer,
    vehicle,
    breadcrumb,
    breadcrumbs,
  };
}
