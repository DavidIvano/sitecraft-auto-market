import type { CarListing, PaidProduct } from "./types";

export const paidProducts: PaidProduct[] = [
  {
    slug: "boost_7_days",
    name: "Поднять объявление",
    description: "7 дней выше обычных объявлений в каталоге.",
    price_cents: 499,
    currency: "EUR",
    type: "one_time",
    duration_days: 7,
    sort_order: 10,
    is_active: true,
  },
  {
    slug: "featured_14_days",
    name: "Выделенное объявление",
    description: "14 дней с бейджем Featured и приоритетом в каталоге.",
    price_cents: 999,
    currency: "EUR",
    type: "one_time",
    duration_days: 14,
    sort_order: 20,
    is_active: true,
  },
  {
    slug: "homepage_premium_7_days",
    name: "Премиум на главной",
    description: "7 дней в блоке Premium cars на главной странице.",
    price_cents: 1499,
    currency: "EUR",
    type: "one_time",
    duration_days: 7,
    sort_order: 30,
    is_active: true,
  },
  {
    slug: "ai_credits_10",
    name: "10 AI-генераций",
    description: "10 кредитов для создания черновиков объявлений по фото.",
    price_cents: 499,
    currency: "EUR",
    type: "credits",
    credits_amount: 10,
    sort_order: 40,
    is_active: true,
  },
  {
    slug: "dealer_basic_monthly",
    name: "Dealer Basic",
    description: "До 10 активных объявлений и 5 AI-кредитов в месяц.",
    price_cents: 1900,
    currency: "EUR",
    type: "subscription",
    credits_amount: 5,
    active_listing_limit: 10,
    monthly_ai_credits: 5,
    dealer_priority: 10,
    sort_order: 50,
    is_active: true,
  },
  {
    slug: "dealer_pro_monthly",
    name: "Dealer Pro",
    description: "До 50 объявлений, 25 AI-кредитов и бейдж Dealer.",
    price_cents: 4900,
    currency: "EUR",
    type: "subscription",
    credits_amount: 25,
    active_listing_limit: 50,
    monthly_ai_credits: 25,
    dealer_priority: 20,
    sort_order: 60,
    is_active: true,
  },
  {
    slug: "dealer_business_monthly",
    name: "Dealer Business",
    description: "До 200 объявлений, 100 AI-кредитов и бейдж Verified Dealer.",
    price_cents: 9900,
    currency: "EUR",
    type: "subscription",
    credits_amount: 100,
    active_listing_limit: 200,
    monthly_ai_credits: 100,
    dealer_priority: 30,
    sort_order: 70,
    is_active: true,
  },
];

const toDate = (value?: string | number) => {
  if (!value) {
    return null;
  }

  const date =
    typeof value === "number" || /^\d+$/.test(String(value))
      ? new Date(Number(value))
      : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

export const isFutureDate = (value?: string | number, now = Date.now()) => {
  const date = toDate(value);
  return Boolean(date && date.getTime() > now);
};

export const getPaidFlags = (car: Pick<CarListing, "boosted_until" | "featured_until" | "homepage_until" | "dealer_plan" | "dealer_verified" | "is_ai_generated">) => ({
  isBoosted: isFutureDate(car.boosted_until),
  isFeatured: isFutureDate(car.featured_until),
  isHomepagePremium: isFutureDate(car.homepage_until),
  isDealer: car.dealer_plan === "pro" || car.dealer_plan === "business",
  isVerifiedDealer: Boolean(car.dealer_verified) || car.dealer_plan === "business",
  isAiGenerated: Boolean(car.is_ai_generated),
});

export const getCarPromotionScore = (car: CarListing) => {
  const flags = getPaidFlags(car);
  const dealerScore =
    car.dealer_plan === "business" ? 25 : car.dealer_plan === "pro" ? 20 : car.dealer_plan === "basic" ? 10 : 0;

  return (
    (flags.isHomepagePremium ? 1000 : 0) +
    (flags.isFeatured ? 700 : 0) +
    (flags.isBoosted ? 400 : 0) +
    dealerScore
  );
};

const toTimestamp = (value?: string | number) => {
  const date = toDate(value);
  return date?.getTime() ?? 0;
};

export const sortPromotedCars = (cars: CarListing[]) =>
  [...cars].sort((left, right) => {
    const promotionDiff = getCarPromotionScore(right) - getCarPromotionScore(left);

    if (promotionDiff !== 0) {
      return promotionDiff;
    }

    return toTimestamp(right.updated_at ?? right.created_at) - toTimestamp(left.updated_at ?? left.created_at);
  });

export const formatPaidPrice = (product: Pick<PaidProduct, "price_cents" | "currency">) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: product.currency || "EUR",
    maximumFractionDigits: product.price_cents % 100 === 0 ? 0 : 2,
  }).format((product.price_cents || 0) / 100);
