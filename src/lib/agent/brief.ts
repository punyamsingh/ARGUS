import { llmModelId, llmProvider } from "@/lib/llm";
import type {
  Attachment,
  Brief,
  BriefInput,
  BriefResult,
  BriefStage,
  Evidence,
  GuidanceItem,
  ResolvedEntity,
} from "@/types/brief";
import { withObservation } from "@/lib/telemetry";
import {
  DEMO_ENTITY,
  DEMO_EVIDENCE,
  DEMO_INPUT,
  DEMO_STAGE_MS,
} from "@/lib/demo/scenario";
import { resolveEntity } from "./resolve";
import { gather } from "./gather";
import { extractAttachmentEvidence } from "./attachments";
import { mergeEvidence } from "./grounding";
import { synthesizeBrief } from "./synthesize";

export interface GenerateBriefOptions {
  /** Called as each stage begins, so callers can stream progress. */
  onProgress?: (stage: BriefStage) => void;
  /** Groups a user's briefs into one Langfuse session (#15). */
  sessionId?: string;
  /** Demo mode: use the scripted entity + evidence instead of resolve/gather.
   *  Synthesis still runs for real, so the brief is genuinely generated. */
  demo?: boolean;
  /** Documents the rep supplied for this brief (#99). Read during the gather
   *  stage, then dropped — they are never part of `BriefInput`, so they cannot
   *  reach the returned `BriefResult` or anything that persists it. */
  attachments?: Attachment[];
}

/**
 * The end-to-end brief pipeline (#7): resolve → gather → synthesize.
 * Returns the full `BriefResult` contract for the API and UI. `onProgress` fires
 * at the start of each stage to drive live progress in the UI (#10).
 */
export async function generateBrief(
  input: BriefInput,
  { onProgress, sessionId, demo = false, attachments = [] }: GenerateBriefOptions = {},
): Promise<BriefResult> {
  // Wrap the whole pipeline in one observation so resolve, each gather tool, and
  // synthesis nest under a single per-brief trace in Langfuse (#15). Input is set
  // to just the meeting fields (not raw args); output to a compact summary; the
  // session id groups a user's briefs in the Langfuse Sessions view.
  return withObservation(
    "brief",
    {
      company: input.company,
      person: input.person,
      context: input.context,
      demo,
      // Count only — an attachment's contents are the rep's, and a trace is one
      // more place they'd outlive the request.
      attachments: attachments.length,
    },
    () => runPipeline(input, onProgress, demo, attachments),
    (result) => ({
      entity: result.entity.company.name,
      sources: result.evidence.length,
      elapsedMs: result.meta.elapsedMs,
    }),
    { sessionId, traceName: demo ? "brief-demo" : "brief" },
  );
}

async function runPipeline(
  input: BriefInput,
  onProgress?: (stage: BriefStage) => void,
  demo = false,
  attachments: Attachment[] = [],
): Promise<BriefResult> {
  const start = Date.now();

  // Demo mode short-circuits the two network stages with the scripted account.
  // The stages are still announced (and briefly held) so the pipeline reads on
  // screen exactly as it does for a live run.
  const briefInput = demo ? DEMO_INPUT : input;

  onProgress?.("resolving");
  let entity: ResolvedEntity;
  if (demo) {
    await pause(DEMO_STAGE_MS.resolving);
    entity = DEMO_ENTITY;
  } else {
    entity = await resolveEntity(input);
  }

  onProgress?.("gathering");
  let evidence: Evidence[];
  if (demo) {
    await pause(DEMO_STAGE_MS.gathering);
    evidence = DEMO_EVIDENCE;
  } else {
    // Public sources and rep-supplied documents are independent, so they run
    // together and the stage costs whichever is slower rather than the sum.
    // Reading attachments is part of gathering as far as the UI is concerned —
    // no new stage, no change to the streaming protocol.
    const [gathered, fromAttachments] = await Promise.all([
      gather(entity),
      extractAttachmentEvidence(attachments, entity),
    ]);
    // Public evidence keeps the low citation ids; `mergeEvidence` appends the
    // attachment claims with contiguous ids and drops anything already covered.
    evidence = mergeEvidence(gathered.evidence, fromAttachments);
  }

  onProgress?.("synthesizing");
  const brief = await synthesizeBrief(briefInput, entity, evidence);

  return {
    input: briefInput,
    entity,
    // Show only evidence the brief actually cites. Tools can return tangential
    // hits (e.g. a broad news match); the synthesizer correctly ignores them,
    // but leaving them in the Sources list adds noise and inflates the count.
    evidence: citedEvidence(brief, evidence),
    brief,
    meta: {
      generatedAt: new Date().toISOString(),
      provider: llmProvider,
      model: llmModelId,
      elapsedMs: Date.now() - start,
      ...(demo ? { demo: true } : {}),
    },
  };
}

/** Hold a demo stage briefly so the pipeline is legible on screen. */
function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function citedEvidence(brief: Brief, evidence: Evidence[]): Evidence[] {
  const cited = new Set<string>();
  // Sourced claims cite via `citations`.
  for (const section of [
    brief.talkingPoints,
    brief.riskAlerts,
    brief.buyingSignals,
  ]) {
    for (const item of section) {
      for (const id of item.citations) cited.add(id);
    }
  }
  // Derived guidance cites via `anchors` — so a guidance item's premise still
  // renders in the Sources list (#73).
  const guidanceSections: GuidanceItem[][] = [
    brief.decisionAsks,
    brief.questions,
    brief.fitHypotheses,
  ];
  for (const section of guidanceSections) {
    for (const item of section) {
      for (const id of item.anchors) cited.add(id);
    }
  }
  return evidence.filter((e) => cited.has(e.id));
}
