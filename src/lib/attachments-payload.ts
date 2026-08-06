import {
  ATTACHMENT_LIMITS,
  attachmentSchema,
  type Attachment,
} from "@/types/brief";

/**
 * Validation for the `attachments` sibling on a request body (#99).
 *
 * Shared by both routes that accept one — `/api/brief` on the way in and
 * `/api/briefs` on the way to storage — because they are two independent HTTP
 * boundaries and a client-side cap is not a cap. Anything that can be reached
 * with a direct POST has to enforce the limits itself; the save route validating
 * less strictly than the generate route was exactly the gap worth closing.
 *
 * Enforces the caps here rather than in the schema because the meaningful limit
 * is decoded size, not the base64 string's length, and because the count and
 * total are properties of the batch rather than of any one file. Errors name the
 * offending file so the rep can fix it — and never quote its contents.
 */
export function parseAttachments(
  raw: unknown,
): { value: Attachment[] } | { error: string } {
  if (raw === undefined || raw === null) return { value: [] };
  if (!Array.isArray(raw)) return { error: "Attachments must be a list." };
  if (raw.length === 0) return { value: [] };

  // Checked before anything is parsed or decoded, so an oversized array is
  // rejected on its length rather than by working through it.
  if (raw.length > ATTACHMENT_LIMITS.maxCount) {
    return {
      error: `Please attach at most ${ATTACHMENT_LIMITS.maxCount} files.`,
    };
  }

  const value: Attachment[] = [];
  let total = 0;

  for (const item of raw) {
    const parsed = attachmentSchema.safeParse(item);
    if (!parsed.success) {
      return { error: "That file type isn't supported. Use a PDF, image or text file." };
    }

    // Base64 decodes at 3 bytes per 4 characters, less any padding — cheaper to
    // compute than decoding, and exact enough to enforce a byte cap on. It also
    // rejects non-base64 outright, which matters because `Buffer.from(s,
    // "base64")` silently discards invalid characters rather than throwing.
    const bytes = decodedSize(parsed.data.data);
    if (bytes === null) {
      return { error: `Couldn't read "${parsed.data.name}".` };
    }
    if (bytes > ATTACHMENT_LIMITS.maxBytes) {
      return {
        error: `"${parsed.data.name}" is too large — ${mb(ATTACHMENT_LIMITS.maxBytes)} max per file.`,
      };
    }

    total += bytes;
    if (total > ATTACHMENT_LIMITS.maxTotalBytes) {
      return {
        error: `Attachments come to more than ${mb(ATTACHMENT_LIMITS.maxTotalBytes)} in total.`,
      };
    }

    value.push(parsed.data);
  }

  return { value };
}

/** Decoded byte length of a base64 payload, or null if it isn't valid base64. */
function decodedSize(data: string): number | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length % 4 !== 0) return null;
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  return (data.length / 4) * 3 - padding;
}

function mb(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)}MB`;
}
