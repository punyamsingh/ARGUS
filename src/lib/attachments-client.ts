"use client";

import {
  ATTACHMENT_LIMITS,
  attachmentMediaTypeSchema,
  type Attachment,
} from "@/types/brief";

/**
 * Client-side handling for rep-supplied attachments (#99).
 *
 * The studio hands a pending brief to the focused page (`/brief/new`) through
 * sessionStorage, but attachments deliberately do **not** travel that way. Two
 * reasons, and the second is the one that matters: a few megabytes of base64
 * would blow the ~5MB storage quota, and — more to the point — "never stored"
 * should mean the browser too, not just the server. So they ride in a module
 * variable across the client-side navigation and are taken exactly once.
 *
 * The cost is that a hard reload of `/brief/new` loses them and the brief runs
 * on public sources alone. That is the right way for this to fail: the brief
 * still generates, and nothing lingers.
 */

let pending: Attachment[] = [];

/** Stash the attachments for the navigation that's about to happen. */
export function setPendingAttachments(attachments: Attachment[]): void {
  pending = attachments;
}

/** Take the stashed attachments, clearing them. Empty on a reload or re-read. */
export function takePendingAttachments(): Attachment[] {
  const taken = pending;
  pending = [];
  return taken;
}

/** The `accept` attribute for the file picker, from the supported media types. */
export const ATTACHMENT_ACCEPT = attachmentMediaTypeSchema.options.join(",");

export interface AttachmentRejection {
  name: string;
  reason: string;
}

/**
 * Read picked files into the wire shape, dropping any the server would reject
 * anyway. Validating here is a courtesy — the route re-checks everything — but
 * it turns a failed brief into an inline message before anything is sent.
 */
export async function readAttachments(
  files: File[],
  alreadyPicked: Attachment[] = [],
): Promise<{ accepted: Attachment[]; rejected: AttachmentRejection[] }> {
  const accepted: Attachment[] = [];
  const rejected: AttachmentRejection[] = [];

  let count = alreadyPicked.length;
  let total = alreadyPicked.reduce((sum, a) => sum + approxBytes(a.data), 0);

  for (const file of files) {
    const mediaType = attachmentMediaTypeSchema.safeParse(file.type);
    if (!mediaType.success) {
      rejected.push({ name: file.name, reason: "unsupported file type" });
      continue;
    }
    if (count >= ATTACHMENT_LIMITS.maxCount) {
      rejected.push({
        name: file.name,
        reason: `over the ${ATTACHMENT_LIMITS.maxCount}-file limit`,
      });
      continue;
    }
    if (file.size > ATTACHMENT_LIMITS.maxBytes) {
      rejected.push({ name: file.name, reason: "too large" });
      continue;
    }
    if (total + file.size > ATTACHMENT_LIMITS.maxTotalBytes) {
      rejected.push({ name: file.name, reason: "over the total size limit" });
      continue;
    }

    try {
      accepted.push({
        name: file.name.slice(0, 200),
        mediaType: mediaType.data,
        data: await toBase64(file),
      });
      count += 1;
      total += file.size;
    } catch {
      rejected.push({ name: file.name, reason: "couldn't be read" });
    }
  }

  return { accepted, rejected };
}

/** Decoded size of a base64 payload, near enough for a running total. */
function approxBytes(data: string): number {
  return Math.floor((data.length / 4) * 3);
}

async function toBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  // Chunked so a multi-megabyte file doesn't blow the argument limit on
  // `String.fromCharCode`, which a single spread of the whole array would.
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
