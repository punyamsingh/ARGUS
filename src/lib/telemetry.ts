import { startActiveObservation } from "@langfuse/tracing";

/**
 * Telemetry helpers (#15), built on the first-party `@langfuse/tracing` SDK so
 * our manual spans are real Langfuse observations (exported by default and shown
 * as a proper trace tree). When the Langfuse keys are unset everything no-ops:
 * `withObservation` just runs the function and `aiTelemetry` disables the AI
 * SDK's emitter. Tracing is best-effort and must never affect a brief.
 */

export const telemetryEnabled = Boolean(
  process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY,
);

type Json = Record<string, unknown>;

/**
 * Run `fn` inside an active Langfuse observation. Nested AI-SDK generations and
 * child observations attach under it automatically, so the whole brief becomes
 * one trace tree. `input` is set explicitly (only the relevant data — never raw
 * function args) and the resolved value is recorded as the observation output.
 */
export async function withObservation<T>(
  name: string,
  input: Json,
  fn: () => Promise<T>,
  toOutput?: (result: T) => Json,
): Promise<T> {
  if (!telemetryEnabled) return fn();
  return startActiveObservation(name, async (span) => {
    span.update({ input });
    const result = await fn();
    if (toOutput) span.update({ output: toOutput(result) });
    return result;
  });
}

/** `experimental_telemetry` config for an AI SDK call — on only when enabled. */
export function aiTelemetry(functionId: string, metadata?: Json) {
  return { isEnabled: telemetryEnabled, functionId, metadata };
}
