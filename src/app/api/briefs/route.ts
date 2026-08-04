import { getSessionUser } from "@/lib/auth/server";
import { listBriefs, saveBrief } from "@/lib/briefs/repo";
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
    return Response.json({ ok: true, id: await saveBrief(user.id, parsed.data) });
  } catch (err) {
    logFailure("save", err);
    return Response.json(
      { ok: false, error: "Couldn't save the brief." },
      { status: 500 },
    );
  }
}
