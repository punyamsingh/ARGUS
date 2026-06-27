import type { Evidence, ResolvedEntity } from "@/types/brief";

/**
 * The shared contract every gather tool implements (#24–#31).
 *
 * Tools are **read-only** and **parallel-safe**. `appliesTo` is where each tool
 * declares its routing (e.g. "only US public companies", "only when a domain is
 * known") — the orchestrator simply runs every tool whose `appliesTo` is true.
 * `run` should resolve quickly and **never reject for ordinary "no data" cases**
 * (return `[]`); the orchestrator additionally enforces a per-tool timeout and
 * isolates failures, so one tool throwing never sinks the others.
 */
export interface GatherTool {
  /** Stable identifier, stamped onto each Evidence this tool produces. */
  name: string;
  /** Conditional routing — should this tool run for this entity? */
  appliesTo(entity: ResolvedEntity): boolean;
  /** Produce evidence. Honour `signal` for cooperative cancellation. */
  run(entity: ResolvedEntity, signal: AbortSignal): Promise<RawEvidence[]>;
}

/**
 * Evidence as a tool produces it — without the global citation `id` (assigned by
 * the orchestrator after merge/dedupe) or `tool` (stamped from `GatherTool.name`).
 */
export type RawEvidence = Omit<Evidence, "id" | "tool">;
