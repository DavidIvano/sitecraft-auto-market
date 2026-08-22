export type SearchConsoleEnv = {
  GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON?: string;
  GOOGLE_SEARCH_CONSOLE_SITE_URL?: string;
};

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type SearchAnalyticsRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

type SitemapResource = {
  path?: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  isPending?: boolean;
  warnings?: string | number;
  errors?: string | number;
  contents?: Array<{ type?: string; submitted?: string | number; indexed?: string | number }>;
};

const GOOGLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const DEFAULT_PROPERTY = "https://automarket.sitecraft.agency/";
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
const textEncoder = new TextEncoder();

function base64Url(input: string | Uint8Array) {
  const bytes = typeof input === "string" ? textEncoder.encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodePem(value: string) {
  const body = value
    .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----/gu, "")
    .replace(/\s+/gu, "");
  const binary = atob(body);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function parseServiceAccount(raw: string): ServiceAccount {
  const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
  if (!parsed.client_email || !parsed.private_key) throw new Error("GSC_SERVICE_ACCOUNT_INVALID");
  return { client_email: parsed.client_email, private_key: parsed.private_key, token_uri: parsed.token_uri };
}

async function signServiceAccountJwt(serviceAccount: ServiceAccount) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: GOOGLE_SCOPE,
    aud: serviceAccount.token_uri || DEFAULT_TOKEN_URI,
    iat: issuedAt,
    exp: issuedAt + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    decodePem(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, textEncoder.encode(unsigned));
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

async function getAccessToken(serviceAccount: ServiceAccount, timeoutMs: number) {
  const assertion = await signServiceAccountJwt(serviceAccount);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(serviceAccount.token_uri || DEFAULT_TOKEN_URI, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({})) as { access_token?: string; error?: string };
    if (!response.ok || !payload.access_token) throw new Error(payload.error || `GSC_TOKEN_HTTP_${response.status}`);
    return payload.access_token;
  } finally {
    clearTimeout(timeout);
  }
}

function isoDate(daysAgo: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function summarizeSearchAnalytics(rows: SearchAnalyticsRow[]) {
  const totals = rows.reduce<{ clicks: number; impressions: number; positionWeighted: number }>((summary, row) => {
    const impressions = numeric(row.impressions);
    const clicks = numeric(row.clicks);
    summary.clicks += clicks;
    summary.impressions += impressions;
    summary.positionWeighted += numeric(row.position) * impressions;
    return summary;
  }, { clicks: 0, impressions: 0, positionWeighted: 0 });
  return {
    clicks: totals.clicks,
    impressions: totals.impressions,
    ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
    average_position: totals.impressions > 0 ? totals.positionWeighted / totals.impressions : 0,
    days_with_data: rows.length,
  };
}

export function summarizeSitemaps(sitemaps: SitemapResource[], expectedUrl: string) {
  const expected = sitemaps.find((sitemap) => sitemap.path === expectedUrl) || null;
  const contents = expected?.contents || [];
  return {
    submitted: Boolean(expected),
    path: expected?.path || expectedUrl,
    pending: Boolean(expected?.isPending),
    last_submitted: expected?.lastSubmitted || null,
    last_downloaded: expected?.lastDownloaded || null,
    errors: numeric(expected?.errors),
    warnings: numeric(expected?.warnings),
    submitted_urls: contents.reduce((total, item) => total + numeric(item.submitted), 0),
    indexed_urls: contents.reduce((total, item) => total + numeric(item.indexed), 0),
  };
}

async function googleRequest<T>(url: string, token: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
    if (!response.ok) throw new Error(payload.error?.message || `GSC_HTTP_${response.status}`);
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadSearchConsoleSnapshot(env: SearchConsoleEnv, options: { sitemapUrl: string; timeoutMs?: number }) {
  const rawCredentials = String(env.GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON || "").trim();
  const property = String(env.GOOGLE_SEARCH_CONSOLE_SITE_URL || DEFAULT_PROPERTY).trim();
  if (!rawCredentials) return { configured: false, property, status: "not_configured" as const };

  const timeoutMs = options.timeoutMs || 12_000;
  try {
    const serviceAccount = parseServiceAccount(rawCredentials);
    const token = await getAccessToken(serviceAccount, timeoutMs);
    const encodedProperty = encodeURIComponent(property);
    const [sitemapsPayload, analyticsPayload] = await Promise.all([
      googleRequest<{ sitemap?: SitemapResource[] }>(
        `https://www.googleapis.com/webmasters/v3/sites/${encodedProperty}/sitemaps`,
        token,
        { method: "GET" },
        timeoutMs,
      ),
      googleRequest<{ rows?: SearchAnalyticsRow[] }>(
        `https://www.googleapis.com/webmasters/v3/sites/${encodedProperty}/searchAnalytics/query`,
        token,
        {
          method: "POST",
          body: JSON.stringify({
            startDate: isoDate(30),
            endDate: isoDate(3),
            dimensions: ["date"],
            type: "web",
            dataState: "final",
            rowLimit: 100,
          }),
        },
        timeoutMs,
      ),
    ]);
    return {
      configured: true,
      property,
      status: "connected" as const,
      sitemap: summarizeSitemaps(sitemapsPayload.sitemap || [], options.sitemapUrl),
      performance: summarizeSearchAnalytics(analyticsPayload.rows || []),
    };
  } catch (error) {
    return {
      configured: true,
      property,
      status: "error" as const,
      error: error instanceof Error ? error.message : "GSC_UNKNOWN_ERROR",
    };
  }
}
