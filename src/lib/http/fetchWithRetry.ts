export const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429]);

type Sleep = (milliseconds: number) => Promise<void>;

export type FetchWithRetryOptions = {
  attempts?: number;
  timeoutMs?: number;
  delaysMs?: number[];
  jitterRatio?: number;
  dedupeKey?: string;
  fetchImpl?: typeof fetch;
  sleep?: Sleep;
  random?: () => number;
};

const inFlightRequests = new Map<string, Promise<Response>>();

export function isRetryableStatus(status: number) {
  return RETRYABLE_HTTP_STATUSES.has(status) || status >= 500;
}

export function parseRetryAfter(value: string | null, now = Date.now()) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

async function requestWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
  options: FetchWithRetryOptions,
) {
  const attempts = Math.max(1, Math.min(3, options.attempts ?? 3));
  const timeoutMs = Math.max(1, options.timeoutMs ?? 10_000);
  const delaysMs = options.delaysMs ?? [1_000, 3_000];
  const jitterRatio = Math.max(0, options.jitterRatio ?? 0.1);
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const random = options.random ?? Math.random;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const externalSignal = init.signal;
    const abortFromExternal = () => controller.abort(externalSignal?.reason);
    externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
    const timeout = setTimeout(() => controller.abort(new DOMException("Request timed out", "AbortError")), timeoutMs);

    try {
      const response = await fetchImpl(input, { ...init, signal: controller.signal });
      if (!isRetryableStatus(response.status) || attempt === attempts - 1) return response;

      const retryAfter = parseRetryAfter(response.headers.get("Retry-After"));
      const baseDelay = retryAfter ?? delaysMs[Math.min(attempt, delaysMs.length - 1)] ?? 0;
      const jitter = baseDelay * jitterRatio * ((random() * 2) - 1);
      await sleep(Math.max(0, Math.round(baseDelay + jitter)));
    } catch (error) {
      if (externalSignal?.aborted || attempt === attempts - 1) throw error;
      if (isAbortError(error) || error instanceof TypeError || error instanceof Error) {
        const baseDelay = delaysMs[Math.min(attempt, delaysMs.length - 1)] ?? 0;
        const jitter = baseDelay * jitterRatio * ((random() * 2) - 1);
        await sleep(Math.max(0, Math.round(baseDelay + jitter)));
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abortFromExternal);
    }
  }

  throw new Error("Request failed after retry attempts");
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: FetchWithRetryOptions = {},
) {
  const method = String(init.method || "GET").toUpperCase();
  const dedupeKey = method === "GET" ? options.dedupeKey : undefined;
  if (!dedupeKey) return requestWithRetry(input, init, options);

  let request = inFlightRequests.get(dedupeKey);
  if (!request) {
    request = requestWithRetry(input, init, options);
    inFlightRequests.set(dedupeKey, request);
    void request.finally(() => {
      if (inFlightRequests.get(dedupeKey) === request) inFlightRequests.delete(dedupeKey);
    }).catch(() => {});
  }

  return (await request).clone();
}
