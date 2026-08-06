import { getSessionUser } from "@/lib/auth/server";
import { listBriefs, saveBrief } from "@/lib/briefs/repo";
import { parseAttachments } from "@/lib/attachments-payload";
import { attachmentRefOf } from "@/lib/evidence-source";
import { attachmentRef } from "@/lib/storage/attachment-ref";
import {
  objectPath,
  putAttachment,
  storageConfigured,
} from "@/lib/storage/attachments-store";
import { briefResultSchema } from "@/types/brief";

/**
 * The brief library — `GET` lists the signed-in user's briefs, `POST` saves one.
 *
 * Storage is an upgrade, not a requirement: a signed-out visitor still generates
 * briefs, they just live in localStorage. So "signed out" is an ordinary 401
 * the client is expected to shrug at, not an error worth surfacing.
 *
 * Each route resolves the session itself — there is no middleware — so the
 * ownership check sits next to the data access, which is the only place it's
 * actually enforceable.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UNAUTHORIZED = () =>
  Response.json({ ok: false, error: "Not signed in." }, { status: 401 });

/** Log shape only — never the raw error, which can carry the submitted brief. */
function logFailure(scope: string, err: unknown): void {
  const detail = err instanceof Error ? `${err.name}: ${err.message}` : "unknown error";
  console.error(`briefs ${scope} —`, detail);
}

export async function GET(req: Request) {
  const user = await getSessionUser(req.headers);
  if (!user) return UNAUTHORIZED();

  try {
    return Response.json({ ok: true, briefs: await listBriefs(user.id) });
  } catch (err) {
    logFailure("list", err);
    return Response.json(
      { ok: false, error: "Couldn't load your briefs." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const user = await getSessionUser(req.headers);
  if (!user) return UNAUTHORIZED();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = briefResultSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Not a valid brief." }, { status: 400 });
  }

  // Demo briefs are generated from a scripted evidence store. They're real
  // synthesis over fixed sources, but they aren't the user's research — keeping
  // them out of the library is what stops a walkthrough polluting an account.
  if (parsed.data.meta.demo) {
    return Response.json({ ok: true, id: null, skipped: "demo" });
  }

  try {
    const id = await saveBrief(user.id, parsed.data);

    // Attachments ride alongside the result, the same way `demo` rides
    // alongside a brief input — `briefResultSchema` strips them, so the stored
    // row still holds only the brief. They are uploaded *after* the row exists
    // so every object has an owner from the moment it's written: no row, no
    // file, and nothing to orphan if the save fails.
    await storeAttachments(
      user.id,
      id,
      (body as { attachments?: unknown }).attachments,
      parsed.data.evidence,
    );

    return Response.json({ ok: true, id });
  } catch (err) {
    logFailure("save", err);
    return Response.json(
      { ok: false, error: "Couldn't save the brief." },
      { status: 500 },
    );
  }
}

/** Uploads in flight at once. Storage is an external service and a brief can
 *  carry several files; a small window keeps one save from opening a connection
 *  per attachment. */
const UPLOAD_CONCURRENCY = 2;

/**
 * Retain the documents this brief was built from.
 *
 * Two things are enforced here rather than assumed:
 *
 *  - **The same limits the generate route applies.** This is its own HTTP
 *    boundary, reachable directly, so the client's caps mean nothing. Sharing
 *    `parseAttachments` is what stops a direct POST decoding an unbounded array
 *    of unvalidated base64.
 *  - **Only what the brief actually cites.** Extraction is what decides a
 *    document became evidence, so the evidence is the list of documents worth
 *    keeping. Without this a caller could park arbitrary files under their
 *    prefix — unreachable, since the resolver serves cited refs only, but
 *    retained all the same. Storing exactly the set that can be served keeps
 *    upload and retrieval from disagreeing about what exists.
 *
 * Best-effort once past validation: a brief whose attachments failed to upload
 * is still a saved brief, it just has sources that don't open. Losing the
 * research because a bucket call failed would be the worse trade.
 */
async function storeAttachments(
  userId: string,
  briefId: string,
  raw: unknown,
  evidence: { sourceUrl: string }[],
): Promise<void> {
  if (!storageConfigured || raw === undefined || raw === null) return;

  const parsed = parseAttachments(raw);
  if ("error" in parsed || parsed.value.length === 0) return;

  const cited = new Set(
    evidence
      .map((e) => attachmentRefOf(e.sourceUrl))
      .filter((ref): ref is string => ref !== null),
  );
  if (cited.size === 0) return;

  // The ref is recomputed rather than trusted from the client: it's what the
  // evidence locator already points at, so a caller can't redirect a source at
  // a file of their choosing by sending a different one.
  const queue = parsed.value
    .map((a) => ({ a, ref: attachmentRef(a) }))
    .filter(({ ref }) => cited.has(ref));

  let next = 0;
  const worker = async (): Promise<void> => {
    for (let i = next++; i < queue.length; i = next++) {
      const { a, ref } = queue[i];
      await putAttachment(
        objectPath(userId, briefId, ref),
        Buffer.from(a.data, "base64"),
        a.mediaType,
      );
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(UPLOAD_CONCURRENCY, queue.length) }, worker),
  );
}
