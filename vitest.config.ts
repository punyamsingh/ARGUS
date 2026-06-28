import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Eval / unit test config (#76). Resolves the `@/` path alias the app uses and
 * limits the run to colocated `*.test.ts` files. The grounding-invariant suite
 * is deterministic and offline — no LLM, no network — so it's safe to gate CI.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
