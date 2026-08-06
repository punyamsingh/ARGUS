import { getSessionUser } from "@/lib/auth/server";
import { deleteBrief, getBrief } from "@/lib/briefs/repo";
import { removeAttachmentPrefix } from "@/lib/storage/attachments-store";

/**
 * A single saved brief — read it or delete it.
 *
 * Both verbs answer **404, not 403**, for a brief belonging to someone else. A
 * 403 would confirm the id exists; 404 makes another user's brief and a
 * nonexistent one indistinguishable to anyone probing. The repo enforces this by
 * construction — it scopes every query by `userId` — so this route can't leak by
 * forgetting a check.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UNAUTHORIZED = () =>
  Response.json({ ok: false, error: "Not signed in." }, { status: 401 });

const NOT_FOUND = () =>
  Response.json({ ok: false, error: "Brief not found." }, { status: 404 });

/** Log shape only — never the raw error, which can carry the stored brief. */
function logFailure(scope: string, err: unknown): void {
  const detail = err instanceof Error ? `${err.name}: ${err.message}` : "unknown error";
  console.error(`briefs ${scope} —`, detail);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser(req.headers);
  if (!user) return UNAUTHORIZED();

  const { id } = await params;
  try {
    const brief = await getBrief(user.id, id);
    // `null` also covers a row whose stored JSON no longer parses — from the
    // caller's side that's indistinguishable from a brief that isn't there,
    // which is the honest answer: we can't render it.
    return brief ? Response.json({ ok: true, brief }) : NOT_FOUND();
  } catch (err) {
    logFailure("get", err);
    return Response.json(
      { ok: false, error: "Couldn't load the brief." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser(req.headers);
  if (!user) return UNAUTHORIZED();

  const { id } = await params;
  try {
    if (!(await deleteBrief(user.id, id))) return NOT_FOUND();

    // Deleting the brief has to delete the documents it was built from —
    // otherwise "remove this brief" leaves a client's RFP in the bucket with
    // nothing left pointing at it. Objects go after the row so a failed sweep
    // can never leave a brief the user thinks they deleted; the cost of that
    // ordering is a possible orphan, which `removeAttachmentPrefix` logs.
    await removeAttachmentPrefix(`${user.id}/${id}`);

    return Response.json({ ok: true });
  } catch (err) {
    logFailure("delete", err);
    return Response.json(
      { ok: false, error: "Couldn't delete the brief." },
      { status: 500 },
    );
  }
}
