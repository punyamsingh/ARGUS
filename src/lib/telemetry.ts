import { SpanStatusCode, trace } from "@opentelemetry/api";

/**
 * Thin telemetry helpers (#15). When the Langfuse keys are set, the OTel SDK is
 * registered in `instrumentation.ts` and these emit real spans; when they're
 * not, `withSpan` just runs the function (zero overhead) and `aiTelemetry`
 * disables the AI SDK's emitter. Telemetry is always best-effort — a tracing
 * failure must never affect a brief.
 */

export const telemetryEnabled = Boolean(
  process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY,
);

const tracer = trace.getTracer("argus");

type Attrs = Record<string, string | number | boolean>;

/** Run `fn` inside an active span (so nested AI-SDK spans attach under it). */
export async function withSpan<T>(
  name: string,
  attributes: Attrs,
  fn: () => Promise<T>,
): Promise<T> {
  if (!telemetryEnabled) return fn();
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      return await fn();
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      span.end();
    }
  });
}

/** `experimental_telemetry` config for an AI SDK call, on only when enabled. */
export function aiTelemetry(functionId: string, metadata?: Attrs) {
  return { isEnabled: telemetryEnabled, functionId, metadata };
}
