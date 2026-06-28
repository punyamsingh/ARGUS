import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

/**
 * Langfuse tracing wiring (#15), following the official Langfuse skill.
 *
 * The Vercel AI SDK emits OpenTelemetry spans (`experimental_telemetry`) and our
 * pipeline adds spans via `@langfuse/tracing`; the `LangfuseSpanProcessor` ships
 * them to Langfuse. `exportMode: "immediate"` is the Langfuse-recommended mode
 * for short-lived serverless functions (spans export as they end, instead of
 * being batched and risking loss when the function freezes); the route also
 * force-flushes via `after()` as a belt-and-braces measure.
 *
 * Fully gated on the Langfuse keys — with none set, no processor is created and
 * no tracer provider is registered, so the app runs exactly as before.
 */

const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
const secretKey = process.env.LANGFUSE_SECRET_KEY;

export const langfuseSpanProcessor =
  publicKey && secretKey
    ? new LangfuseSpanProcessor({
        publicKey,
        secretKey,
        // @langfuse/otel reads LANGFUSE_BASE_URL; accept the legacy spelling too.
        baseUrl: process.env.LANGFUSE_BASE_URL ?? process.env.LANGFUSE_BASEURL,
        exportMode: "immediate",
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      })
    : undefined;

export function register() {
  if (!langfuseSpanProcessor) return;
  new NodeTracerProvider({
    spanProcessors: [langfuseSpanProcessor],
  }).register();
}
