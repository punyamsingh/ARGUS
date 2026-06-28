import { registerOTel, OTLPHttpProtoTraceExporter } from "@vercel/otel";

/**
 * OpenTelemetry → Langfuse wiring (#15).
 *
 * Next.js calls `register()` once at server startup. The Vercel AI SDK emits
 * OTel spans when `experimental_telemetry` is enabled; `@vercel/otel` ships them
 * to Langfuse's OTLP endpoint and handles span-flushing on serverless (the usual
 * footgun). Entirely gated on the Langfuse keys — with none set, no exporter is
 * registered and the app runs exactly as before.
 */
export function register() {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  if (!publicKey || !secretKey) return;

  const baseUrl = process.env.LANGFUSE_BASEURL ?? "https://cloud.langfuse.com";
  const auth = Buffer.from(`${publicKey}:${secretKey}`).toString("base64");

  registerOTel({
    serviceName: "argus",
    traceExporter: new OTLPHttpProtoTraceExporter({
      url: `${baseUrl.replace(/\/$/, "")}/api/public/otel/v1/traces`,
      headers: { Authorization: `Basic ${auth}` },
    }),
  });
}
