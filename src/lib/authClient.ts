import { AUTH_TOKEN_KEY, AUTH_USER_KEY, type AuthUser } from "./auth";

export const AUTH_DEBUG_KEY = "sitecraft_auto_market_auth_debug";
export const AUTH_NEXT_KEY = "sitecraft_auto_market_auth_next";
export const COOKIE_NOTICE_KEY = "sitecraft_auto_market_cookie_notice";

const AUTH_MAX_AGE_SECONDS = 60 * 60 * 24 * 60;
const NOTICE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

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
  setCookie(AUTH_USER_KEY, value, AUTH_MAX_AGE_SECONDS);
}

export function clearAuth() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
  window.localStorage.removeItem(AUTH_DEBUG_KEY);
  deleteCookie(AUTH_TOKEN_KEY);
  deleteCookie(AUTH_USER_KEY);
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
