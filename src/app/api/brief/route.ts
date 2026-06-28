import { generateBrief } from "@/lib/agent/brief";
import { briefInputSchema, type BriefStreamMessage } from "@/types/brief";

/**
 * POST /api/brief — the end-to-end pipeline, streamed.
 * Body: { company, person, context }.
 * Response: newline-delimited JSON (`BriefStreamMessage`) — `stage` events as the
 * pipeline runs, then a terminal `result` or `error`. Validation failures still
 * return a plain JSON error with the appropriate 4xx status.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // fit the < 60s brief target on Vercel

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = briefInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: "Please provide a company, a person, and meeting context.",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (msg: BriefStreamMessage) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(msg)}\n`));
      try {
        const result = await generateBrief(parsed.data, {
          onProgress: (stage) => send({ type: "stage", stage }),
        });
        send({ type: "result", result });
      } catch (err) {
        // Log only name + message — never the raw error object, which can carry
        // the submitted prompt via the provider's error fields.
        const detail =
          err instanceof Error ? `${err.name}: ${err.message}` : "unknown error";
        console.error("brief error —", detail);
        send({ type: "error", error: "Couldn't generate the brief. Please try again." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
    },
  });
}
