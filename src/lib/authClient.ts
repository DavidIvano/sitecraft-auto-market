import { AUTH_TOKEN_KEY, AUTH_USER_KEY, type AuthUser } from "./auth";
import { API_ROUTES, buildApiUrl } from "./apiRoutes";

export const AUTH_DEBUG_KEY = "sitecraft_auto_market_auth_debug";
export const AUTH_NEXT_KEY = "sitecraft_auto_market_auth_next";
export const COOKIE_NOTICE_KEY = "sitecraft_auto_market_cookie_notice";
export const AUTH_USER_VALIDATED_AT_KEY = "sitecraft_auto_market_auth_validated_at";

const AUTH_MAX_AGE_SECONDS = 60 * 60 * 24 * 60;
const AUTH_USER_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
const AUTH_UNAUTHORIZED_RETRY_DELAY_MS = 350;
const AUTH_UNAUTHORIZED_RETRY_COUNT = 1;
const NOTICE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
let currentUserRequest: Promise<AuthUser | null> | null = null;
let currentUserRequestKey = "";

type FetchCurrentUserOptions = {
  force?: boolean;
};

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function getCookie(name: string) {
  const match = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${encodeURIComponent(name)}=`));

  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

function setCookie(name: string, value: string, maxAge: number) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

function deleteCookie(name: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
}

export function getAuthToken() {
  const storedToken = window.localStorage.getItem(AUTH_TOKEN_KEY);
  const cookieToken = getCookie(AUTH_TOKEN_KEY);

  if (!storedToken && cookieToken) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, cookieToken);
  }

  return storedToken || cookieToken;
}

export function setAuthToken(token: string) {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  window.localStorage.removeItem(AUTH_USER_VALIDATED_AT_KEY);
  setCookie(AUTH_TOKEN_KEY, token, AUTH_MAX_AGE_SECONDS);
}

export function getAuthUser(): AuthUser | null {
  const storedUser = window.localStorage.getItem(AUTH_USER_KEY) || getCookie(AUTH_USER_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser) as AuthUser;
  } catch {
    return null;
  }
}

export function setAuthUser(user: unknown) {
  const value = JSON.stringify(user);
  window.localStorage.setItem(AUTH_USER_KEY, value);
  window.localStorage.setItem(AUTH_USER_VALIDATED_AT_KEY, String(Date.now()));
  setCookie(AUTH_USER_KEY, value, AUTH_MAX_AGE_SECONDS);
}

export function clearAuth() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
  window.localStorage.removeItem(AUTH_DEBUG_KEY);
  window.localStorage.removeItem(AUTH_USER_VALIDATED_AT_KEY);
  deleteCookie(AUTH_TOKEN_KEY);
  deleteCookie(AUTH_USER_KEY);
}

export function isAdminUser(user?: { role?: unknown } | null) {
  const role = String(user?.role || "").trim().toLowerCase();

  return role === "admin";
}

export function isDealFinderUser(user?: { email?: unknown; role?: unknown } | null) {
  return isAdminUser(user) || String(user?.role || "").trim().toLowerCase() === "deal_finder_admin";
}

export async function fetchCurrentUser(
  apiUrl?: string,
  token = getAuthToken(),
  options: FetchCurrentUserOptions = {},
) {
  if (!token) {
    return null;
  }

  const cachedUser = getAuthUser();
  const validatedAt = Number(window.localStorage.getItem(AUTH_USER_VALIDATED_AT_KEY) || 0);
  if (!options.force && cachedUser && validatedAt > 0 && Date.now() - validatedAt < AUTH_USER_CACHE_MAX_AGE_MS) {
    return cachedUser;
  }

  const requestKey = `${buildApiUrl(API_ROUTES.authMe, apiUrl)}:${token}:${options.force ? "force" : "cached"}`;
  if (currentUserRequest && currentUserRequestKey === requestKey) {
    return currentUserRequest;
  }

  currentUserRequestKey = requestKey;
  currentUserRequest = (async () => {
    try {
      let response: Response | null = null;
      for (let attempt = 0; attempt <= AUTH_UNAUTHORIZED_RETRY_COUNT; attempt += 1) {
        response = await fetch(buildApiUrl(API_ROUTES.authMe, apiUrl), {
          cache: "no-store",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status !== 401 || attempt === AUTH_UNAUTHORIZED_RETRY_COUNT) break;
        await wait(AUTH_UNAUTHORIZED_RETRY_DELAY_MS);
      }

      if (!response) {
        if (cachedUser) return cachedUser;
        throw new Error("auth check returned no response");
      }

      if (response.status === 401) {
        if (getAuthToken() === token) {
          clearAuth();
        }
        return null;
      }

      if (!response.ok) {
        if (cachedUser) return cachedUser;
        throw new Error(`auth check failed ${response.status}`);
      }

      const payload = await response.json();
      const user = (payload?.user || payload) as AuthUser;
      if (!user || typeof user !== "object") {
        if (cachedUser) return cachedUser;
        throw new Error("auth check returned an invalid user");
      }

      if (getAuthToken() === token) {
        setAuthUser(user);
      }
      return user;
    } catch (error) {
      if (cachedUser) return cachedUser;
      throw error;
    }
  })();

  try {
    return await currentUserRequest;
  } finally {
    if (currentUserRequestKey === requestKey) {
      currentUserRequest = null;
      currentUserRequestKey = "";
    }
  }
}

export function redirectToLogin(nextPath = window.location.pathname + window.location.search) {
  rememberNext(nextPath);
  window.location.href = `/login?next=${encodeURIComponent(nextPath)}`;
}

export async function requireUserClient(apiUrl?: string) {
  const user = await fetchCurrentUser(apiUrl);

  if (!user?.id) {
    redirectToLogin();
    return null;
  }

  return user;
}

export async function requireAdminClient(apiUrl?: string) {
  const user = await requireUserClient(apiUrl);

  if (!user) {
    return null;
  }

  if (!isAdminUser(user)) {
    window.location.href = "/support";
    return null;
  }

  return user;
}

export async function isSessionConfirmedExpired(
  apiUrl?: string,
  token = getAuthToken(),
) {
  if (!token) return true;

  try {
    const user = await fetchCurrentUser(apiUrl, token, { force: true });
    return !user?.id && !getAuthToken();
  } catch {
    return false;
  }
}

export function rememberNext(path: string) {
  window.localStorage.setItem(AUTH_NEXT_KEY, path);
}

export function consumeNext(fallback = "/dashboard") {
  const next = window.localStorage.getItem(AUTH_NEXT_KEY) || fallback;
  window.localStorage.removeItem(AUTH_NEXT_KEY);

  return next;
}

export function acceptCookieNotice() {
  setCookie(COOKIE_NOTICE_KEY, "accepted", NOTICE_MAX_AGE_SECONDS);
}

export function hasCookieNotice() {
  return getCookie(COOKIE_NOTICE_KEY) === "accepted";
}
