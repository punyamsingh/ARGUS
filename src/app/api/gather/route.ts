import { resolveEntity } from "@/lib/agent/resolve";
import { gather } from "@/lib/agent/gather";
import { briefInputSchema } from "@/types/brief";

/**
 * Temporary probe for #5 — runs resolve → gather on a deploy so the pipeline
 * wiring is verifiable. Until tools register (#24+), `evidence` is empty and
 * `toolsRun` shows which tools the orchestrator considered. Removed at #7.
 *
 * GET /api/gather?company=Stripe&person=Jane%20Doe&context=renewal%20call
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
    const { evidence, toolsRun, toolErrors } = await gather(entity);
    return Response.json({
      ok: true,
      input: parsed.data,
      entity,
      toolsRun,
      toolErrors,
      evidenceCount: evidence.length,
      evidence,
    });
  } catch (err) {
    console.error("gather error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
