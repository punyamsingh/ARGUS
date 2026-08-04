import { describe, expect, it } from "vitest";
import {
  briefInputSchema,
  evidenceSchema,
  resolvedEntitySchema,
} from "@/types/brief";
import { DEMO_ENTITY, DEMO_EVIDENCE, DEMO_INPUT, DEMO_TOOLS } from "./scenario";

/**
 * The demo scenario is hand-written data that flows straight into the pipeline
 * in place of resolve + gather, so it never meets the runtime validation those
 * steps would apply. These checks are that validation: if the scripted account
 * drifts out of contract, a demo would fail in front of an audience — here it
 * fails in CI instead.
 */
describe("demo scenario", () => {
  it("is a valid brief input", () => {
    expect(briefInputSchema.safeParse(DEMO_INPUT).success).toBe(true);
  });

  it("is a valid resolved entity", () => {
    expect(resolvedEntitySchema.safeParse(DEMO_ENTITY).success).toBe(true);
  });

  it("has valid, uniquely-identified evidence", () => {
    for (const e of DEMO_EVIDENCE) {
      expect(evidenceSchema.safeParse(e).success).toBe(true);
    }
    const ids = DEMO_EVIDENCE.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("carries enough evidence, across enough tools, to fill a brief", () => {
    expect(DEMO_EVIDENCE.length).toBeGreaterThanOrEqual(5);
    expect(DEMO_TOOLS.length).toBeGreaterThanOrEqual(4);
  });

  it("names the same company the entity resolves to", () => {
    expect(DEMO_ENTITY.company.name).toContain(DEMO_INPUT.company);
    expect(DEMO_ENTITY.person.name).toBe(DEMO_INPUT.person);
  });
});
