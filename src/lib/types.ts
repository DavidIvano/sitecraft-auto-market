export type CarListingStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "archived"
  | "sold";

export type CarListing = {
  id: number;
  slug: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  mileage: number;
  fuel_type: string;
  transmission: string;
  price: number;
  currency: string;
  city: string;
  country: string;
  description: string;
  status: CarListingStatus;
  main_image_url?: string;
  created_at?: string;
  updated_at?: string;
};
