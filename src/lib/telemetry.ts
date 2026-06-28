import { propagateAttributes, startActiveObservation } from "@langfuse/tracing";

/**
 * Telemetry helpers (#15), built on the first-party `@langfuse/tracing` SDK so
 * our spans are real Langfuse observations (exported by default, shown as a
 * proper trace tree). When the Langfuse keys are unset everything no-ops and the
 * functions just run their callback. Tracing is best-effort — it must never
 * affect a brief.
 */

export const telemetryEnabled = Boolean(
  process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY,
);

type Json = Record<string, unknown>;

interface TraceAttrs {
  /** Groups related briefs in the Langfuse Sessions view. */
  sessionId?: string;
  /** Explicit trace name (otherwise Langfuse infers it from the root span). */
  traceName?: string;
}

interface Usage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

/**
 * Run `fn` inside an active Langfuse observation. Nested observations attach
 * under it automatically, so the whole brief becomes one trace tree. `input` is
 * set explicitly (only the relevant data — never raw function args). Pass `trace`
 * on the root call to stamp every span in the tree with a session id / name.
 */
export async function withObservation<T>(
  name: string,
  input: Json,
  fn: () => Promise<T>,
  toOutput?: (result: T) => Json,
  trace?: TraceAttrs,
): Promise<T> {
  if (!telemetryEnabled) return fn();
  const run = () =>
    startActiveObservation(name, async (span) => {
      span.update({ input });
      const result = await fn();
      if (toOutput) span.update({ output: toOutput(result) });
      return result;
    });
  if (trace?.sessionId || trace?.traceName) {
    return propagateAttributes(
      { sessionId: trace.sessionId, traceName: trace.traceName },
      run,
    );
  }
  return run();
}

/**
 * Run an LLM call inside a Langfuse *generation* observation, recording model
 * name and token usage so cost is computed automatically. We capture these
 * explicitly (rather than via the AI SDK's OTel emitter) so the generation —
 * with tokens — reliably shows up in the trace.
 */
export async function withGeneration<T>(
  name: string,
  params: { model: string; input: Json },
  fn: () => Promise<T>,
  extract: (result: T) => { output?: unknown; usage?: Usage },
): Promise<T> {
  if (!telemetryEnabled) return fn();
  return startActiveObservation(
    name,
    async (generation) => {
      generation.update({ model: params.model, input: params.input });
      const result = await fn();
      const { output, usage } = extract(result);
      generation.update({
        output,
        usageDetails: usage
          ? {
              input: usage.inputTokens ?? 0,
              output: usage.outputTokens ?? 0,
              total: usage.totalTokens ?? 0,
            }
          : undefined,
      });
      return result;
    },
    { asType: "generation" },
  );
}
