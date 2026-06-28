import { after } from "next/server";
import { answerFollowUp } from "@/lib/agent/ask";
import { langfuseSpanProcessor } from "@/instrumentation";
import { askInputSchema, type AskStreamMessage } from "@/types/brief";

/**
 * POST /api/brief/ask — a grounded follow-up to an existing brief, streamed.
 * Body: { question, input, entity, evidence } (the client sends the brief's
 * evidence store). Response: newline-delimited JSON (`AskStreamMessage`) — `stage`
 * events, then a terminal `result` or `error`. Mirrors /api/brief's contract.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = askInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: "Ask a question about the brief you just generated.",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  // Optional client session id — groups follow-ups with their brief in Langfuse.
  const sessionId = req.headers
    .get("x-argus-session-id")
    ?.replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 200) || undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (msg: AskStreamMessage) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(msg)}\n`));
      try {
        const result = await answerFollowUp(parsed.data, {
          onProgress: (stage) => send({ type: "stage", stage }),
          sessionId,
        });
        send({ type: "result", result });
      } catch (err) {
        // Log only name + message — never the raw error, which can carry the prompt.
        const detail =
          err instanceof Error ? `${err.name}: ${err.message}` : "unknown error";
        console.error("ask error —", detail);
        send({ type: "error", error: "Couldn't answer that. Please try again." });
      } finally {
        controller.close();
      }
    },
  });

  after(async () => {
    await langfuseSpanProcessor?.forceFlush();
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
    },
  });
}
