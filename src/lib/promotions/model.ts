import type { CarListing } from "../types.ts";

export const PROMOTION_PRODUCTS = {
  boost_7_days: {
    slug: "boost_7_days",
    name: "Поднять объявление",
    shortName: "Поднято",
    description: "Поднимает объявление выше обычных предложений в каталоге.",
    credits: 5,
    durationDays: 7,
    timestampField: "boosted_until",
    startedAtField: "boosted_at",
    cardClass: "is-boosted",
    priority: 1,
  },
  featured_14_days: {
    slug: "featured_14_days",
    name: "Выделить объявление",
    shortName: "Выделено",
    description: "Добавляет заметное оформление и приоритет в каталоге.",
    credits: 12,
    durationDays: 14,
    timestampField: "featured_until",
    startedAtField: "featured_at",
    cardClass: "is-featured",
    priority: 2,
  },
  homepage_premium_7_days: {
    slug: "homepage_premium_7_days",
    name: "Премиум на главной",
    shortName: "Премиум",
    description: "Показывает автомобиль в премиум-блоке главной страницы и первым в каталоге.",
    credits: 20,
    durationDays: 7,
    timestampField: "homepage_until",
    startedAtField: "homepage_at",
    cardClass: "is-homepage-premium",
    priority: 3,
  },
} as const;

export type PromotionProductSlug = keyof typeof PROMOTION_PRODUCTS;
export type PromotionTimestampField = (typeof PROMOTION_PRODUCTS)[PromotionProductSlug]["timestampField"];
export type PromotionStartedAtField = (typeof PROMOTION_PRODUCTS)[PromotionProductSlug]["startedAtField"];
export type PromotionState = Pick<
  Partial<CarListing>,
  | "boosted_at"
  | "boosted_until"
  | "featured_at"
  | "featured_until"
  | "homepage_at"
  | "homepage_until"
  | "last_promoted_at"
>;

export interface ListingPromotion {
  id?: number;
  plan_code?: string;
  promotion_type?: string;
  placement?: string;
  status?: string;
  priority?: number;
  starts_at?: string | number;
  ends_at?: string | number;
}

export interface DashboardSummary {
  credits: { balance: number };
  listings: {
    total: number;
    draft: number;
    pending_review: number;
    published: number;
    promoted: number;
  };
  active_promotions: {
    boosted: number;
    featured: number;
    homepage: number;
  };
}

export interface PromoteListingResponse {
  success: true;
  listing_id: number;
  product_slug: PromotionProductSlug;
  credits_spent: number;
  balance_before: number;
  balance_after: number;
  active_until: string | number;
  promotion: PromotionState;
}

export interface PromotionApiError {
  success?: false;
  code?: string;
  message?: string;
  required_credits?: number;
  current_balance?: number;
}

export type CreditTransactionRecord = {
  id: number;
  created_at?: string | number;
  transaction_type?: string;
  type?: string;
  amount: number;
  balance_before?: number;
  balance_after: number;
  listing_id?: number;
  related_car_id?: number;
  product_slug?: PromotionProductSlug | string;
  description?: string;
  notes?: string;
  status?: string;
  idempotency_key?: string;
  metadata?: Record<string, unknown>;
};

export interface CreditTransactionsResponse {
  items: CreditTransactionRecord[];
  page: number;
  per_page: number;
  total: number;
  page_total?: number;
}

export function parseApiDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  let normalized: string | number = typeof value === "number" ? value : String(value).trim();
  if (normalized === "") return null;
  if (typeof normalized === "number" || /^-?\d+(?:\.\d+)?$/.test(normalized)) {
    const numeric = Number(normalized);
    if (!Number.isFinite(numeric)) return null;
    normalized = Math.abs(numeric) < 100_000_000_000 ? numeric * 1000 : numeric;
  }
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getPromotionProduct(value: unknown) {
  const slug = String(value || "").trim() as PromotionProductSlug;
  return PROMOTION_PRODUCTS[slug] || null;
}

export function isValidIdempotencyKey(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

export function isPromotionDateActive(value: unknown, now = Date.now()) {
  const date = parseApiDate(value);
  return Boolean(date && date.getTime() > now);
}

export function getActivePromotionProducts(car: Partial<CarListing>, now = Date.now()) {
  return (Object.values(PROMOTION_PRODUCTS) as Array<(typeof PROMOTION_PRODUCTS)[PromotionProductSlug]>)
    .filter((product) => isPromotionDateActive(car[product.timestampField], now));
}

export function getHighestActivePromotion(car: Partial<CarListing>, now = Date.now()) {
  const timestampPromotion = getActivePromotionProducts(car, now).sort((left, right) => right.priority - left.priority)[0];
  if (timestampPromotion) return timestampPromotion;

  const legacyPromotion = car.promotion as ListingPromotion | undefined;
  const startsAt = parseApiDate(legacyPromotion?.starts_at)?.getTime() || 0;
  const endsAt = parseApiDate(legacyPromotion?.ends_at)?.getTime() || 0;
  if (String(legacyPromotion?.status || "").toLowerCase() !== "active" || startsAt > now || endsAt <= now) return null;

  const type = String(legacyPromotion?.promotion_type || "").toLowerCase();
  const placement = String(legacyPromotion?.placement || "").toLowerCase();
  if (type === "premium" || placement.includes("homepage")) return PROMOTION_PRODUCTS.homepage_premium_7_days;
  if (type === "featured") return PROMOTION_PRODUCTS.featured_14_days;
  if (type === "boost") return PROMOTION_PRODUCTS.boost_7_days;
  return null;
}

export function getActiveListingPromotion(car: Partial<CarListing>, now = Date.now()) {
  const product = getHighestActivePromotion(car, now);
  if (!product) return null;
  return {
    promotion_type: product.slug === "homepage_premium_7_days" ? "premium" : product.slug === "featured_14_days" ? "featured" : "boost",
    placement: product.slug === "homepage_premium_7_days" ? "catalog_and_homepage" : "catalog",
    priority: product.priority,
    starts_at: car[product.startedAtField] || car.last_promoted_at || 0,
    ends_at: car[product.timestampField] || 0,
  };
}

function timestamp(value: unknown) {
  return parseApiDate(value)?.getTime() || 0;
}

function promotionGroup(car: Partial<CarListing>, now: number) {
  const product = getHighestActivePromotion(car, now);
  return {
    rank: product?.priority || 0,
    promotedAt: product ? timestamp(car.last_promoted_at || car[product.startedAtField]) : 0,
  };
}

export function sortCarsByActivePromotion(
  cars: CarListing[],
  options: { now?: number; ordinaryCompare?: (left: CarListing, right: CarListing) => number } = {},
) {
  const now = options.now ?? Date.now();
  const ordinaryCompare = options.ordinaryCompare ?? ((left, right) => timestamp(right.created_at) - timestamp(left.created_at));
  return [...cars].sort((left, right) => {
    const leftGroup = promotionGroup(left, now);
    const rightGroup = promotionGroup(right, now);
    return rightGroup.rank - leftGroup.rank
      || rightGroup.promotedAt - leftGroup.promotedAt
      || ordinaryCompare(left, right);
  });
}

export function getHomepagePromotedCars(cars: CarListing[], now = Date.now(), limit = 6) {
  return sortCarsByActivePromotion(cars, { now })
    .filter((car) => isPromotionDateActive(car.homepage_until, now))
    .slice(0, Math.max(0, Math.min(12, limit)));
}

export function getPromotionEligibilityMessage(statusValue: unknown) {
  const status = String(statusValue || "").trim().toLowerCase();
  if (["approved", "published"].includes(status)) return "";
  if (["draft", "ai_draft"].includes(status)) return "Продвижение доступно после публикации";
  if (["pending_review", "ready_for_review"].includes(status)) return "Продвижение доступно после одобрения";
  if (["rejected", "needs_fix"].includes(status)) return "Исправьте объявление перед продвижением";
  return "Продвижение недоступно";
}

export function calculatePromotionEndDate(
  currentUntil: unknown,
  durationDays: number,
  now = Date.now(),
) {
  const current = parseApiDate(currentUntil)?.getTime() || 0;
  return new Date(Math.max(now, current) + durationDays * 86_400_000);
}
