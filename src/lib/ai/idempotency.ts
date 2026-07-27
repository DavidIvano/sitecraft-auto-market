const MAX_KEY_LENGTH = 64;

function randomId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function createAiIdempotencyKey(action: string) {
  const scope = action.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "ai";
  return `${scope}-${randomId()}`.slice(0, MAX_KEY_LENGTH);
}
