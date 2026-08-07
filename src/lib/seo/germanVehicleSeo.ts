import type { GermanPublicListingDto } from "../../i18n/publicListing.ts";

const DEFAULT_SITE_URL = "https://automarket.sitecraft.agency";
const DEFAULT_IMAGE = "/deal-finder-placeholder.svg";
const clean = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

export function buildGermanVehicleSeo(car: GermanPublicListingDto, siteUrl = DEFAULT_SITE_URL) {
  const origin = new URL(siteUrl || DEFAULT_SITE_URL);
  const canonicalUrl = new URL(`/de/cars/${encodeURIComponent(car.slug)}/`, origin).toString();
  const heading = [clean(car.brand), clean(car.model), car.year || ""].filter(Boolean).join(" ") || clean(car.title);
  const price = new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: car.currency || "EUR",
    maximumFractionDigits: 0,
  }).format(car.price);
  const description = `${heading} kaufen${car.city ? ` in ${clean(car.city)}` : ""}. ${price}, ${car.mileage.toLocaleString("de-DE")} km. ${clean(car.description)}`.slice(0, 260).trim();
  const imageUrl = new URL(car.image_urls[0] || DEFAULT_IMAGE, origin).toString();
  const offerId = `${canonicalUrl}#offer`;

  const offer = {
    "@context": "https://schema.org",
    "@type": "Offer",
    "@id": offerId,
    url: canonicalUrl,
    price: car.price,
    priceCurrency: car.currency || "EUR",
    availability: "https://schema.org/InStock",
  };
  const vehicle = {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    "@id": `${canonicalUrl}#vehicle`,
    url: canonicalUrl,
    name: heading,
    description,
    image: [imageUrl],
    brand: car.brand ? { "@type": "Brand", name: car.brand } : undefined,
    model: car.model || undefined,
    vehicleModelDate: car.year ? String(car.year) : undefined,
    mileageFromOdometer: car.mileage > 0 ? { "@type": "QuantitativeValue", value: car.mileage, unitCode: "KMT" } : undefined,
    fuelType: car.fuel_type || undefined,
    vehicleTransmission: car.transmission || undefined,
    bodyType: car.body_type || undefined,
    color: car.color || undefined,
    offers: { "@id": offerId },
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Startseite", item: new URL("/de/", origin).toString() },
      { "@type": "ListItem", position: 2, name: "Fahrzeuge", item: new URL("/de/cars/", origin).toString() },
      { "@type": "ListItem", position: 3, name: heading, item: canonicalUrl },
    ],
  };

  return {
    title: `${heading} kaufen${car.city ? ` in ${clean(car.city)}` : ""}`,
    heading,
    description,
    canonicalUrl,
    imageUrl,
    imageAlt: `${heading}${car.city ? ` in ${clean(car.city)}` : ""}`,
    offer,
    vehicle,
    breadcrumb,
  };
}
