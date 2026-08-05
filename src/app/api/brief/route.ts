import { after } from "next/server";
import { generateBrief } from "@/lib/agent/brief";
import { langfuseSpanProcessor } from "@/instrumentation";
import {
  ATTACHMENT_LIMITS,
  attachmentSchema,
  briefInputSchema,
  type Attachment,
  type BriefStreamMessage,
} from "@/types/brief";

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

  // Optional client session id, used only to group briefs in Langfuse. Capped
  // and sanitised — it's untrusted input that ends up as a span attribute.

  const sessionId = req.headers
    .get("x-argus-session-id")
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

/**
 * Validate the optional `attachments` sibling.
 *
 * Enforces the caps here rather than in the schema because the meaningful limit
 * is decoded size, not the base64 string's length, and because the count and
 * total are properties of the batch rather than of any one file. Errors name the
 * offending file so the rep can fix it — and never quote its contents.
 */
function parseAttachments(
  raw: unknown,
): { value: Attachment[] } | { error: string } {
  if (raw === undefined || raw === null) return { value: [] };
  if (!Array.isArray(raw)) return { error: "Attachments must be a list." };
  if (raw.length === 0) return { value: [] };

  if (raw.length > ATTACHMENT_LIMITS.maxCount) {
    return {
      error: `Please attach at most ${ATTACHMENT_LIMITS.maxCount} files.`,
    };
  }

  const value: Attachment[] = [];
  let total = 0;

  for (const item of raw) {
    const parsed = attachmentSchema.safeParse(item);
    if (!parsed.success) {
      return { error: "That file type isn't supported. Use a PDF, image or text file." };
    }

    // Base64 decodes at 3 bytes per 4 characters, less any padding — cheaper to
    // compute than decoding, and exact enough to enforce a byte cap on.
    const bytes = decodedSize(parsed.data.data);
    if (bytes === null) {
      return { error: `Couldn't read "${parsed.data.name}".` };
    }
    if (bytes > ATTACHMENT_LIMITS.maxBytes) {
      return {
        error: `"${parsed.data.name}" is too large — ${mb(ATTACHMENT_LIMITS.maxBytes)} max per file.`,
      };
    }

    total += bytes;
    if (total > ATTACHMENT_LIMITS.maxTotalBytes) {
      return {
        error: `Attachments come to more than ${mb(ATTACHMENT_LIMITS.maxTotalBytes)} in total.`,
      };
    }

    value.push(parsed.data);
  }

  return { value };
}

/** Decoded byte length of a base64 payload, or null if it isn't valid base64. */
function decodedSize(data: string): number | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length % 4 !== 0) return null;
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  return (data.length / 4) * 3 - padding;
}

function mb(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)}MB`;
}
