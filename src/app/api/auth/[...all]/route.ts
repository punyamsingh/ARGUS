import { getAuth, isAuthConfigured } from "@/lib/auth/server";

/**
 * Better Auth's catch-all handler — sign-in, the Google callback, session reads,
 * sign-out. Mounted rather than generated so the unconfigured case (no database
 * or no Google credentials) answers 503 instead of throwing on module load.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UNAVAILABLE = () =>
  Response.json(
    { ok: false, error: "Sign-in isn't configured on this deployment." },
    { status: 503 },
  );

function handler(req: Request): Promise<Response> {
  if (!isAuthConfigured()) return Promise.resolve(UNAVAILABLE());
  return getAuth().handler(req);
}

export const GET = handler;
export const POST = handler;
