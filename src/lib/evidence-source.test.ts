import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_SCHEME,
  isAttachmentEvidence,
  isLinkedEvidence,
} from "@/lib/evidence-source";
import { mergeEvidence } from "@/lib/agent/grounding";
import { evidenceSchema, type Evidence } from "@/types/brief";

/**
 * The attachment source (#99) rests on one property: an `attachment://` locator
 * is a valid `Evidence.sourceUrl` that the UI can tell apart from a public link.
 * These lock down both halves — the contract accepting it, and everything that
 * renders it refusing to treat it as clickable.
 */

const publicEv = (id: string): Evidence => ({
  id,
  claim: `claim ${id}`,
  sourceUrl: `https://example.com/${id}`,
  sourceTitle: `Source ${id}`,
  tool: "wikipedia",
  retrievedAt: "2026-08-05T00:00:00.000Z",
});

const attachmentEv = (claim: string, locator = "p. 3"): Evidence => ({
  id: "",
  claim,
  sourceUrl: `${ATTACHMENT_SCHEME}//a1b2c3d4e5f6#${encodeURIComponent(locator)}`,
  sourceTitle: `acme-rfp.pdf — ${locator}`,
  tool: "attachment",
  retrievedAt: "2026-08-05T00:00:00.000Z",
});

describe("an attachment locator is valid evidence", () => {
  it("satisfies the evidence contract without a schema change", () => {
    const parsed = evidenceSchema.safeParse({ ...attachmentEv("x"), id: "e1" });
    expect(parsed.success).toBe(true);
  });

  it("survives a locator with spaces and punctuation", () => {
    const ev = attachmentEv("x", "Section 3.2 — Requirements");
    expect(evidenceSchema.safeParse({ ...ev, id: "e1" }).success).toBe(true);
  });
});

describe("public sources link, attachments do not", () => {
  it("treats http(s) as linkable", () => {
    expect(isLinkedEvidence("https://example.com/a")).toBe(true);
    expect(isLinkedEvidence("http://example.com/a")).toBe(true);
    expect(isLinkedEvidence("HTTPS://example.com/a")).toBe(true);
  });

  it("refuses to link an attachment locator", () => {
    expect(isLinkedEvidence(attachmentEv("x").sourceUrl)).toBe(false);
    expect(isAttachmentEvidence(attachmentEv("x"))).toBe(true);
    expect(isAttachmentEvidence(publicEv("e1"))).toBe(false);
  });

  it("degrades to not-linkable rather than throwing on a malformed locator", () => {
    expect(isLinkedEvidence("")).toBe(false);
    expect(isLinkedEvidence("javascript:alert(1)")).toBe(false);
    expect(isLinkedEvidence("//example.com")).toBe(false);
  });
});

describe("attachment evidence folds in beside the gathered evidence", () => {
  it("appends with contiguous ids, leaving public citation ids untouched", () => {
    const merged = mergeEvidence(
      [publicEv("e1"), publicEv("e2")],
      [attachmentEv("Wants SSO by Q3"), attachmentEv("Incumbent is Vendor X")],
    );

    expect(merged.map((e) => e.id)).toEqual(["e1", "e2", "e3", "e4"]);
    // The public ids the brief already cites keep pointing at the same source.
    expect(merged[0].sourceUrl).toBe("https://example.com/e1");
    expect(merged[3].tool).toBe("attachment");
  });

  it("collapses the same claim from the same document attached twice", () => {
    const once = attachmentEv("Wants SSO by Q3");
    const merged = mergeEvidence([publicEv("e1")], [once, { ...once }]);

    expect(merged).toHaveLength(2);
    expect(merged.map((e) => e.id)).toEqual(["e1", "e2"]);
  });

  it("keeps distinct claims that share a locator", () => {
    const merged = mergeEvidence(
      [],
      [attachmentEv("Wants SSO by Q3"), attachmentEv("Budget signed off")],
    );
    expect(merged).toHaveLength(2);
  });
});
