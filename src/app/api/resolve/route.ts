import { resolveEntity } from "@/lib/agent/resolve";
import { briefInputSchema } from "@/types/brief";

/**
 * Temporary probe for #4 — verifies entity resolution on a deploy.
 * Removed once the real /api/brief pipeline lands (#7).
 *
 * GET /api/resolve?company=Stripe&person=Jane%20Doe&context=renewal%20call
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const parsed = briefInputSchema.safeParse({
    company: params.get("company") ?? "",
    person: params.get("person") ?? "",
    context: params.get("context") ?? "",
  });

  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: "Provide company, person, and context query params.",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const entity = await resolveEntity(parsed.data);
    return Response.json({ ok: true, input: parsed.data, entity });
  } catch (err) {
    console.error("resolve error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
