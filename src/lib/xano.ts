import type { CarListing } from "./types";

const API_URL = import.meta.env.PUBLIC_XANO_API_URL;
const PLACEHOLDER_API_URL = "https://your-xano-api-url.com/api:YOUR_GROUP";

function isApiConfigured() {
  return Boolean(API_URL && API_URL !== PLACEHOLDER_API_URL);
}

export async function getApprovedCars(): Promise<CarListing[]> {
  if (!isApiConfigured()) {
    console.warn("PUBLIC_XANO_API_URL is not configured");
    return [];
  }

  const response = await fetch(`${API_URL}/cars`);

  if (!response.ok) {
    throw new Error("Failed to fetch cars");
  }

  return response.json();
}

export async function getCarBySlug(slug: string): Promise<CarListing | null> {
  if (!isApiConfigured()) {
    console.warn("PUBLIC_XANO_API_URL is not configured");
    return null;
  }

  const response = await fetch(`${API_URL}/cars/${slug}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to fetch car");
  }

  return response.json();
}

export async function createCarListing(formData: FormData): Promise<CarListing> {
  if (!isApiConfigured()) {
    throw new Error("PUBLIC_XANO_API_URL is not configured");
  }

  const response = await fetch(`${API_URL}/cars`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to create car listing");
  }

  return response.json();
}

export async function submitCarForReview(id: number): Promise<CarListing> {
  if (!isApiConfigured()) {
    throw new Error("PUBLIC_XANO_API_URL is not configured");
  }

  const response = await fetch(`${API_URL}/cars/${id}/submit`, {
    method: "PATCH",
  });

  if (!response.ok) {
    throw new Error("Failed to submit car listing");
  }

  return response.json();
}
