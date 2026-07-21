import type { DealFinderSyncEnv } from "./env.ts";
import {
  buildOpenAiRequest,
  enforceNoComparablesPolicy,
  extractResponseOutputText,
  safeUsage,
  sanitizeAnalysisSnapshot,
  validateStructuredAnalysis,
  type AnalysisUsage,
  type StructuredAnalysis,
} from "./analysis.ts";

export type OpenAiAnalysisResult = { result: StructuredAnalysis; responseId: string | null; usage: AnalysisUsage };
export type OpenAiAnalysisErrorCode = "OPENAI_TIMEOUT" | "OPENAI_RATE_LIMIT" | "OPENAI_AUTH_ERROR" | "OPENAI_INVALID_OUTPUT" | "OPENAI_UPSTREAM_ERROR" | "ANALYSIS_CONFIGURATION_ERROR";

export class OpenAiAnalysisError extends Error {
  readonly code: OpenAiAnalysisErrorCode;

  constructor(code: OpenAiAnalysisErrorCode) {
    super(code);
    this.code = code;
  }
}

export async function analyzeDealFinderSnapshot(env: DealFinderSyncEnv, snapshotValue: unknown, model: string, timeoutMs: number): Promise<OpenAiAnalysisResult> {
  if (!env.OPENAI_API_KEY) throw new OpenAiAnalysisError("ANALYSIS_CONFIGURATION_ERROR");
  const snapshot = sanitizeAnalysisSnapshot(snapshotValue);
  if (!snapshot) throw new OpenAiAnalysisError("OPENAI_INVALID_OUTPUT");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildOpenAiRequest(model, snapshot)),
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new OpenAiAnalysisError("OPENAI_AUTH_ERROR");
      if (response.status === 429) throw new OpenAiAnalysisError("OPENAI_RATE_LIMIT");
      throw new OpenAiAnalysisError("OPENAI_UPSTREAM_ERROR");
    }
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    const outputText = extractResponseOutputText(payload);
    const parsed = outputText ? JSON.parse(outputText) : null;
    if (!validateStructuredAnalysis(parsed)) throw new OpenAiAnalysisError("OPENAI_INVALID_OUTPUT");
    return {
      result: enforceNoComparablesPolicy(parsed),
      responseId: typeof payload?.id === "string" ? payload.id : null,
      usage: safeUsage(payload?.usage),
    };
  } catch (error) {
    if (error instanceof OpenAiAnalysisError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw new OpenAiAnalysisError("OPENAI_TIMEOUT");
    if (error instanceof SyntaxError) throw new OpenAiAnalysisError("OPENAI_INVALID_OUTPUT");
    throw new OpenAiAnalysisError("OPENAI_UPSTREAM_ERROR");
  } finally {
    clearTimeout(timeout);
  }
}
