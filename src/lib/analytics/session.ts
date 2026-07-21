const SESSION_STORAGE_KEY = "sitecraft_session_id";

function createFallbackSessionId() {
  return `session_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateSessionId() {
  if (typeof window === "undefined") {
    return createFallbackSessionId();
  }

  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);

  if (existing) {
    return existing;
  }

  const sessionId = typeof window.crypto?.randomUUID === "function"
    ? window.crypto.randomUUID()
    : createFallbackSessionId();

  window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  return sessionId;
}
