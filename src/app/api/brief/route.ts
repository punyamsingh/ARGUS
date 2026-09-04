import { after } from "next/server";
import { generateBrief } from "@/lib/agent/brief";
import { langfuseSpanProcessor } from "@/instrumentation";
import { parseAttachments } from "@/lib/attachments-payload";
import { briefInputSchema, type BriefStreamMessage } from "@/types/brief";

/**
 * POST /api/brief — the end-to-end pipeline, streamed.
 * Body: { company, person, context } plus the optional `demo` and `attachments`
 * siblings, which are read here rather than being part of `BriefInput`.
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

  // Demo mode (#demo) — a sibling flag on the body, not part of the brief input.
  // When set, the pipeline runs against the scripted evidence store instead of
  // resolving and gathering live; synthesis is still a real model call.
  const demo = (body as { demo?: unknown }).demo === true;

  // Attachments (#99) — likewise a sibling, and for a stronger reason than
  // tidiness: keeping them out of `BriefInput` is what guarantees a file payload
  // can't be inlined into the saved brief or replayed on every follow-up.
  //
  // Generation itself retains nothing. The copy that outlives the request is
  // written by the save path (`POST /api/briefs`), where there's an account row
  // to own it — so an anonymous or unsaved brief leaves no file behind.
  const attachments = parseAttachments((body as { attachments?: unknown }).attachments);
  if ("error" in attachments) {
    return Response.json({ ok: false, error: attachments.error }, { status: 400 });
  }

  // Optional conversation id, used only as the Langfuse session key (#15): one
  // conversation — this brief and the follow-ups asked about it — is one
  // session. Capped and sanitised; it's untrusted input that ends up as a span
  // attribute.
  const sessionId = req.headers
    .get("x-argus-conversation-id")
    ?.replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 200) || undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (msg: BriefStreamMessage) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(msg)}\n`));
      try {
        const result = await generateBrief(parsed.data, {
          onProgress: (stage) => send({ type: "stage", stage }),
          sessionId,
          demo,
          attachments: attachments.value,
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

  // Flush any buffered Langfuse spans once the response has finished streaming,
  // so traces aren't lost when the serverless function freezes. No-op when
  // tracing isn't configured.
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
