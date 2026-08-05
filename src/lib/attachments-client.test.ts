import { describe, expect, it } from "vitest";
import { attachmentBytes, formatBytes } from "@/lib/attachments-client";
import { ATTACHMENT_LIMITS, type Attachment } from "@/types/brief";

/**
 * The size shown beside an attached filename. It is the only number the rep
 * sees, and it's what makes the per-file limit legible when a file is turned
 * away — so it has to agree with the cap that rejected it.
 */

const withBytes = (bytes: number): Attachment => ({
  name: "doc.pdf",
  mediaType: "application/pdf",
  // 4 base64 chars per 3 bytes, no padding.
  data: "A".repeat(Math.ceil(bytes / 3) * 4),
});

describe("attachment size, as the rep sees it", () => {
  it("recovers the decoded size from the base64 payload", () => {
    expect(attachmentBytes(withBytes(300))).toBe(300);
    expect(attachmentBytes(withBytes(900_000))).toBeCloseTo(900_000, -2);
  });

  it("scales the unit to the size", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(21)).toBe("21 B");
    expect(formatBytes(999)).toBe("999 B");
    expect(formatBytes(1_000)).toBe("1 KB");
    expect(formatBytes(842_000)).toBe("842 KB");
    expect(formatBytes(1_200_000)).toBe("1.2 MB");
  });

  it("labels the per-file cap the same way the rejection message does", () => {
    // The route rejects with "1.5MB max per file"; a file just under the cap
    // must not round up to a figure that looks like it should have been
    // refused.
    expect(formatBytes(ATTACHMENT_LIMITS.maxBytes)).toBe("1.5 MB");
    expect(formatBytes(ATTACHMENT_LIMITS.maxBytes - 1)).toBe("1.5 MB");
  });
});
