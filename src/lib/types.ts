export type CarListingStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "archived"
  | "blocked"
  | "deleted"
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
  seller_name?: string;
  seller_phone?: string;
  seller_email?: string;
  description: string;
  status: CarListingStatus;
  main_image_url?: string;
  images?: CarListingImage[];
  created_at?: string | number;
  updated_at?: string | number;
};

export type XanoFileMetadata = {
  name?: string;
  path?: string;
  size?: number;
  type?: string;
  mime?: string;
  url?: string;
  meta?: {
    width?: number;
    height?: number;
  };
};

export type CarListingImage = {
  id: number;
  car_listing_id: number;
  image: XanoFileMetadata;
  image_url: string;
  sort_order: number;
  is_main: boolean;
  created_at?: string | number;
};
