import { getSessionUser } from "@/lib/auth/server";
import { listBriefs, saveBrief } from "@/lib/briefs/repo";
import { attachmentRef } from "@/lib/storage/attachment-ref";
import {
  objectPath,
  putAttachment,
  storageConfigured,
} from "@/lib/storage/attachments-store";
import { attachmentSchema, briefResultSchema, type Attachment } from "@/types/brief";

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
    await storeAttachments(user.id, id, (body as { attachments?: unknown }).attachments);

    return Response.json({ ok: true, id });
  } catch (err) {
    logFailure("save", err);
    return Response.json(
      { ok: false, error: "Couldn't save the brief." },
      { status: 500 },
    );
  }
}

/**
 * Retain the documents this brief was built from.
 *
 * Best-effort throughout: a brief whose attachments failed to upload is still
 * a saved brief, it just has sources that don't open. Losing the research
 * because a bucket call failed would be the worse trade.
 */
async function storeAttachments(
  userId: string,
  briefId: string,
  raw: unknown,
): Promise<void> {
  if (!storageConfigured || !Array.isArray(raw) || raw.length === 0) return;

  const attachments: Attachment[] = [];
  for (const item of raw) {
    const parsed = attachmentSchema.safeParse(item);
    if (parsed.success) attachments.push(parsed.data);
  }

  await Promise.all(
    attachments.map((a) =>
      putAttachment(
        // The ref is recomputed rather than trusted from the client: it's what
        // the evidence locator already points at, so a caller can't redirect a
        // source at a file of their choosing by sending a different one.
        objectPath(userId, briefId, attachmentRef(a)),
        Buffer.from(a.data, "base64"),
        a.mediaType,
      ),
    ),
  );
}
