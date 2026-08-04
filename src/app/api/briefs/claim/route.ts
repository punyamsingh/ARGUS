import { z } from "zod";
import { getSessionUser } from "@/lib/auth/server";
import { claimBriefs } from "@/lib/briefs/repo";
import { briefResultSchema } from "@/types/brief";

/**
 * Adopt a browser's local history into the account that just signed in.
 *
 * Without this, signing in looks like data loss: the briefs someone generated
 * before making an account would silently stop appearing. The client fires this
 * once per user; the unique index on `(user_id, generated_at)` means a
 * double-fire, a re-signin, or two tabs racing all collapse to the same rows.
 *
 * Demo briefs are dropped here as well as in `POST /api/briefs` — local history
 * doesn't separate them, so the filter has to live on the server side of both
 * doors.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bounded well above localStorage's cap of 6 — this is a backstop against a
 *  hand-rolled request, not a real limit anyone reaches. */
const claimBodySchema = z.object({
  briefs: z.array(briefResultSchema).max(50),
});

export async function POST(req: Request) {
  const user = await getSessionUser(req.headers);
  if (!user) {
    return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = claimBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "Expected a list of briefs." },
      { status: 400 },
    );
  }

  const real = parsed.data.briefs.filter((b) => !b.meta.demo);

  try {
    return Response.json({ ok: true, claimed: await claimBriefs(user.id, real) });
  } catch (err) {
    const detail =
      err instanceof Error ? `${err.name}: ${err.message}` : "unknown error";
    console.error("briefs claim —", detail);
    return Response.json(
      { ok: false, error: "Couldn't move your briefs across." },
      { status: 500 },
    );
  }
}
