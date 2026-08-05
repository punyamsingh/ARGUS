import { getSessionUser } from "@/lib/auth/server";
import { getBrief } from "@/lib/briefs/repo";
import { ATTACHMENT_SCHEME } from "@/lib/evidence-source";
import {
  objectPath,
  signedAttachmentUrl,
  storageConfigured,
} from "@/lib/storage/attachments-store";

/**
 * Open a document a brief was built from (#99).
 *
 * The evidence locator stored in a brief is `attachment://<ref>` — deliberately
 * not a URL. A signed URL has a lifetime, and a saved brief does not, so baking
 * one into the stored JSON would mean every brief's sources quietly stopped
 * working after a few minutes. Instead the locator stays stable and this route
 * mints a fresh link per click.
 *
 * Two checks stand between a `ref` and a file, and both matter because a `ref`
 * is only a content hash — guessable in principle, and shared by anyone who
 * attached the same document:
 *
 *  1. The caller must own `briefId`. `getBrief` scopes by user id, so a brief
 *     belonging to someone else is indistinguishable from one that doesn't
 *     exist.
 *  2. That brief must actually cite this `ref`. Without it, owning any single
 *     brief would be enough to read any object under your own prefix — which is
 *     narrow, but wider than "the documents this brief was built from".
 *
 * Answers 404 for every failure, so a probe can't tell an unowned brief from a
 * missing one from an unconfigured bucket.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_FOUND = () =>
  Response.json({ ok: false, error: "Attachment not found." }, { status: 404 });

export async function GET(
  req: Request,
  { params }: { params: Promise<{ briefId: string; ref: string }> },
) {
  if (!storageConfigured) return NOT_FOUND();

  const user = await getSessionUser(req.headers);
  if (!user) return NOT_FOUND();

  const { briefId, ref } = await params;
  // A ref is a hex slice of a digest. Rejecting anything else here keeps
  // traversal sequences out of the object path before it's ever built.
  if (!/^[a-f0-9]{6,64}$/.test(ref)) return NOT_FOUND();

  try {
    const brief = await getBrief(user.id, briefId);
    if (!brief) return NOT_FOUND();
    if (!citesRef(brief.evidence, ref)) return NOT_FOUND();

    const url = await signedAttachmentUrl(objectPath(user.id, briefId, ref));
    if (!url) return NOT_FOUND();

    // 302, not 307: this is a short-lived pointer to a different resource, and
    // it must never be cached — the URL it hands out expires in a minute.
    return new Response(null, {
      status: 302,
      headers: { Location: url, "Cache-Control": "no-store" },
    });
  } catch (err) {
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : "unknown";
    console.error("attachment resolve —", detail);
    return NOT_FOUND();
  }
}

/** Does this brief actually cite the document being asked for? */
function citesRef(
  evidence: { sourceUrl: string }[],
  ref: string,
): boolean {
  const prefix = `${ATTACHMENT_SCHEME}//${ref}`;
  return evidence.some(
    (e) => e.sourceUrl === prefix || e.sourceUrl.startsWith(`${prefix}#`),
  );
}
