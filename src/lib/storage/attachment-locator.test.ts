import { describe, expect, it } from "vitest";
import { ATTACHMENT_SCHEME, attachmentRefOf } from "@/lib/evidence-source";
import { attachmentRef } from "@/lib/storage/attachment-ref";
import { objectPath } from "@/lib/storage/attachments-store";
import type { Attachment } from "@/types/brief";

/**
 * The chain that lets a saved brief re-open its own documents (#99):
 *
 *   attachmentRef(file) ─▶ evidence `attachment://<ref>` ─▶ attachmentRefOf()
 *                       └─▶ objectPath(user, brief, ref) ─▶ the stored object
 *
 * Both ends compute the ref independently — extraction writes it into the
 * locator, the save route derives the object name from the uploaded bytes — so
 * if they ever disagree, every attachment source silently 404s. These pin the
 * agreement, and pin the parsing that stands between a URL and a file read.
 */

const file = (name: string, data: string): Attachment => ({
  name,
  mediaType: "application/pdf",
  data,
});

describe("the ref survives the round trip through a locator", () => {
  it("parses back out of the locator extraction writes", () => {
    const ref = attachmentRef(file("rfp.pdf", "SGVsbG8="));
    const locator = `${ATTACHMENT_SCHEME}//${ref}#${encodeURIComponent("p. 3")}`;
    expect(attachmentRefOf(locator)).toBe(ref);
  });

  it("parses with no locator fragment at all", () => {
    const ref = attachmentRef(file("rfp.pdf", "SGVsbG8="));
    expect(attachmentRefOf(`${ATTACHMENT_SCHEME}//${ref}`)).toBe(ref);
  });

  it("is stable for the same file and distinct for different ones", () => {
    expect(attachmentRef(file("a.pdf", "SGVsbG8="))).toBe(
      attachmentRef(file("a.pdf", "SGVsbG8=")),
    );
    // Same bytes, different name — a rep renaming a file gets its own object.
    expect(attachmentRef(file("a.pdf", "SGVsbG8="))).not.toBe(
      attachmentRef(file("b.pdf", "SGVsbG8=")),
    );
    expect(attachmentRef(file("a.pdf", "SGVsbG8="))).not.toBe(
      attachmentRef(file("a.pdf", "V29ybGQ=")),
    );
  });

  it("produces a ref the resolver's own guard accepts", () => {
    // The route rejects anything that isn't lowercase hex before building a
    // path from it; a ref that failed that check would be unservable.
    expect(attachmentRef(file("rfp.pdf", "SGVsbG8="))).toMatch(/^[a-f0-9]{6,64}$/);
  });
});

describe("only an attachment locator yields a ref", () => {
  it("returns null for a public source", () => {
    expect(attachmentRefOf("https://example.com/a")).toBeNull();
    expect(attachmentRefOf("https://example.com/attachment://abc")).toBeNull();
  });

  it("returns null rather than throwing on junk", () => {
    for (const bad of [
      "",
      "attachment://",
      "attachment://not-hex-at-all",
      // Traversal in the ref position must not survive parsing — it would
      // otherwise be interpolated into an object path.
      "attachment://../../secrets",
      "attachment://abc/../../etc/passwd",
    ]) {
      expect(attachmentRefOf(bad)).toBeNull();
    }
  });
});

describe("object layout keeps one brief's documents to itself", () => {
  it("nests under the owning user and brief", () => {
    expect(objectPath("user-1", "brief-a", "abc123")).toBe(
      "user-1/brief-a/abc123",
    );
  });

  it("gives two briefs citing the same document their own copy", () => {
    // Deleting one brief sweeps its own folder, so it can never pull a file out
    // from under another brief that happens to cite the same document.
    const ref = attachmentRef(file("rfp.pdf", "SGVsbG8="));
    expect(objectPath("u", "brief-a", ref)).not.toBe(
      objectPath("u", "brief-b", ref),
    );
  });
});
