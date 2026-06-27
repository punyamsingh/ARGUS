import { generateText } from "ai";
import { getModel, llmDefaults, llmModelId, llmProvider } from "@/lib/llm";

/**
 * Temporary connectivity probe for #2 — verifies the LLM layer end-to-end on a
 * deploy. Remove once the real /api/brief pipeline lands (#7).
 *
 * GET /api/ping-llm
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { text } = await generateText({
      model: getModel(),
      prompt:
        "In one short sentence, confirm you are reachable and name your model family.",
      maxRetries: llmDefaults.maxRetries,
    });

    return Response.json({
      ok: true,
      provider: llmProvider,
      model: llmModelId,
      text,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { ok: false, provider: llmProvider, model: llmModelId, error: message },
      { status: 500 },
    );
  }
}
