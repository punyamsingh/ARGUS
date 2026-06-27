import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/**
 * The LLM layer. One thin seam over the Vercel AI SDK so the whole pipeline is
 * provider-agnostic. Switching providers is a single env change (LLM_PROVIDER) —
 * no code changes elsewhere.
 *
 * Default: free Google Gemini. Anthropic is the documented swap target.
 */

export type LlmProvider = "gemini" | "anthropic";

export const llmProvider: LlmProvider =
  process.env.LLM_PROVIDER === "anthropic" ? "anthropic" : "gemini";

const DEFAULT_MODEL: Record<LlmProvider, string> = {
  gemini: "gemini-2.5-flash",
  anthropic: "claude-opus-4-8",
};

export const llmModelId: string =
  process.env.LLM_MODEL || DEFAULT_MODEL[llmProvider];

/** Shared call defaults — retry/backoff matters on the free tier's rate limits. */
export const llmDefaults = {
  maxRetries: 3,
} as const;

let cached: LanguageModel | null = null;

/** The configured default model. */
export function getModel(): LanguageModel {
  if (cached) return cached;

  if (llmProvider === "anthropic") {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    cached = anthropic(llmModelId);
  } else {
    const google = createGoogleGenerativeAI({
      apiKey:
        process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    });
    cached = google(llmModelId);
  }

  return cached;
}
