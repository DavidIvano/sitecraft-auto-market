export const FREE_AI_CREDITS_DAILY_GRANT = 5;
export const FREE_AI_CREDITS_CAP = 50;

export type CreditWalletType = "ai" | "provider" | "promotion";

export type CreditAction =
  | "page_view"
  | "filter_change"
  | "local_sort"
  | "save_listing"
  | "hide_listing"
  | "mark_viewed"
  | "ai_search_intent"
  | "ai_listing_draft"
  | "deal_finder_analysis"
  | "provider_search"
  | "provider_detail"
  | "apply_promotion";

export type CreditActionPolicy = {
  wallet: CreditWalletType | null;
  cost: number;
  chargeOnSuccess: boolean;
};

export type CreditWallets = {
  ai: {
    free: number;
    paid: number;
    unallocated: number;
    total: number;
    used: number;
    dailyGrant: number;
    freeCap: number;
  };
  provider: {
    balance: number | null;
    dailyLimit: number | null;
    usedToday: number | null;
  };
};

const ACTION_POLICIES: Record<CreditAction, CreditActionPolicy> = {
  page_view: { wallet: null, cost: 0, chargeOnSuccess: false },
  filter_change: { wallet: null, cost: 0, chargeOnSuccess: false },
  local_sort: { wallet: null, cost: 0, chargeOnSuccess: false },
  save_listing: { wallet: null, cost: 0, chargeOnSuccess: false },
  hide_listing: { wallet: null, cost: 0, chargeOnSuccess: false },
  mark_viewed: { wallet: null, cost: 0, chargeOnSuccess: false },
  ai_search_intent: { wallet: "ai", cost: 1, chargeOnSuccess: true },
  ai_listing_draft: { wallet: "ai", cost: 1, chargeOnSuccess: true },
  deal_finder_analysis: { wallet: "ai", cost: 1, chargeOnSuccess: true },
  provider_search: { wallet: "provider", cost: 1, chargeOnSuccess: true },
  provider_detail: { wallet: "provider", cost: 1, chargeOnSuccess: true },
  apply_promotion: { wallet: "promotion", cost: 1, chargeOnSuccess: true },
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function nonNegativeNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

function optionalNonNegativeNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  return nonNegativeNumber(value);
}

export function normalizeCreditWallets(payload: unknown): CreditWallets {
  const record = asRecord(payload);
  const free = nonNegativeNumber(record.free_ai_credits);
  const paid = nonNegativeNumber(record.paid_ai_credits);
  const declaredTotal = nonNegativeNumber(
    record.ai_credits_total ?? record.ai_credits ?? record.credits,
    free + paid,
  );
  const total = Math.max(declaredTotal, free + paid);

  return {
    ai: {
      free,
      paid,
      unallocated: Math.max(0, total - free - paid),
      total,
      used: nonNegativeNumber(record.ai_credits_used_total),
      dailyGrant: nonNegativeNumber(record.free_ai_credits_daily_grant, FREE_AI_CREDITS_DAILY_GRANT),
      freeCap: nonNegativeNumber(record.free_ai_credits_cap, FREE_AI_CREDITS_CAP),
    },
    provider: {
      balance: optionalNonNegativeNumber(record.provider_credits_balance),
      dailyLimit: optionalNonNegativeNumber(record.provider_credits_daily_limit),
      usedToday: optionalNonNegativeNumber(record.provider_credits_used_today),
    },
  };
}

export function getCreditActionPolicy(action: CreditAction): CreditActionPolicy {
  return { ...ACTION_POLICIES[action] };
}

export function canAffordAiAction(wallets: CreditWallets, action: CreditAction) {
  const policy = getCreditActionPolicy(action);
  return policy.wallet !== "ai" || wallets.ai.total >= policy.cost;
}
