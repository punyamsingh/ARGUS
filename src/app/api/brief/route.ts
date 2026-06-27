import { generateBrief } from "@/lib/agent/brief";
import { briefInputSchema } from "@/types/brief";

/**
 * POST /api/brief — the end-to-end pipeline.
 * Body: { company, person, context } → { ok, result: BriefResult }.
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

  try {
    const result = await generateBrief(parsed.data);
    return Response.json({ ok: true, result });
  } catch (err) {
    console.error("brief error:", err);
    return Response.json(
      { ok: false, error: "Couldn't generate the brief. Please try again." },
      { status: 500 },
    );
  }
}
