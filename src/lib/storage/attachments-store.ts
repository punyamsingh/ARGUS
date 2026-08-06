/**
 * Object storage for rep-supplied attachments (#99), on Supabase Storage.
 *
 * Spoken to over its REST API with plain `fetch`, for the same reason
 * `db/index.ts` speaks SQL rather than an ORM: this is four calls — upload,
 * sign, list, remove — and neither `@supabase/supabase-js` nor an S3 client
 * earns its dependency surface for that. The endpoints below are also
 * S3-compatible on Supabase's side; we use the native paths because they take
 * the same service-role key the rest of the project already provisions.
 *
 * Storage is **optional and independent of the database**, mirroring how
 * accounts work: unconfigured means attachments stay ephemeral and the app is
 * otherwise unchanged. Nothing here throws in a way that can sink a brief —
 * an upload that fails costs the link, not the research.
 *
 * Layout is `{userId}/{briefId}/{ref}`. Keying by the owning brief rather than
 * by content hash alone is deliberate: two briefs that cite the same document
 * get their own copy, so deleting one can never pull a file out from under the
 * other. Duplicate bytes are cheap; a source that silently stops resolving is
 * not.
 */

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "attachments";

const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** True when the app is configured to retain attachments at all. */
export const storageConfigured = Boolean(url && key);

/** How long a minted download link stays valid. Short by intent: the link is
 *  handed out per click, so it never needs to outlive the page it opened on. */
const SIGNED_URL_TTL_SECONDS = 60;

/**
 * How long any one Storage call may take.
 *
 * `fetch` has no default timeout, so a stalled connection would otherwise hold
 * a save, a resolve or a delete open until the platform's own limit killed it —
 * turning a slow bucket into a slow app. Every call below aborts on this signal
 * and falls through to its normal "couldn't do it" return, so a timeout costs
 * the link, not the request. Generous enough for a multi-megabyte upload on a
 * poor connection, short enough to fail well inside a 60s function.
 */
const REQUEST_TIMEOUT_MS = 15_000;

/** An abort signal for one Storage call. */
function deadline(): AbortSignal {
  return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${key}`,
    apikey: key as string,
    ...extra,
  };
}

/** The object path for one attachment of one brief. */
export function objectPath(
  userId: string,
  briefId: string,
  ref: string,
): string {
  return `${userId}/${briefId}/${ref}`;
}

/**
 * Store one attachment. Resolves to false when storage isn't configured or the
 * write fails — callers treat that as "no link for this source", never as a
 * reason to fail the request that carried it.
 */
export async function putAttachment(
  path: string,
  body: Uint8Array,
  contentType: string,
): Promise<boolean> {
  if (!storageConfigured) return false;
  try {
    const res = await fetch(
      `${url}/storage/v1/object/${BUCKET}/${encodePath(path)}`,
      {
        method: "POST",
        headers: headers({
          "Content-Type": contentType,
          // Re-saving the same brief overwrites rather than 409s.
          "x-upsert": "true",
        }),
        body: body as BodyInit,
        signal: deadline(),
      },
    );
    if (!res.ok) {
      console.warn(`attachment upload failed — ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("attachment upload failed —", message(err));
    return false;
  }
}

/**
 * Mint a short-lived download URL. Returns null when storage is off or the
 * object is gone, which the caller renders as an unresolvable source rather
 * than a broken link.
 */
export async function signedAttachmentUrl(path: string): Promise<string | null> {
  if (!storageConfigured) return null;
  try {
    const res = await fetch(
      `${url}/storage/v1/object/sign/${BUCKET}/${encodePath(path)}`,
      {
        method: "POST",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
        signal: deadline(),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { signedURL?: string };
    if (!data.signedURL) return null;
    // The API returns a path relative to /storage/v1.
    return `${url}/storage/v1${data.signedURL.startsWith("/") ? "" : "/"}${data.signedURL}`;
  } catch (err) {
    console.warn("attachment sign failed —", message(err));
    return null;
  }
}

/**
 * Remove every object under a prefix — one brief's attachments, or every
 * attachment belonging to one user.
 *
 * Best-effort by design: a failed sweep is logged, not thrown, so deleting a
 * brief still deletes the brief. The cost of the other choice is a user who
 * cannot remove their own record because a bucket call timed out.
 */
export async function removeAttachmentPrefix(prefix: string): Promise<number> {
  if (!storageConfigured) return 0;
  try {
    const paths = await listPrefix(prefix);
    if (paths.length === 0) return 0;
    const res = await fetch(`${url}/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ prefixes: paths }),
      signal: deadline(),
    });
    if (!res.ok) {
      console.warn(`attachment delete failed — ${res.status}`);
      return 0;
    }
    return paths.length;
  } catch (err) {
    console.warn("attachment delete failed —", message(err));
    return 0;
  }
}

/**
 * Every attachment belonging to one user.
 *
 * Worth stating plainly: the `brief` table's `on delete cascade` is enforced by
 * Postgres and never runs application code, so dropping a user row removes
 * their briefs and leaves their files behind. Nothing in the app deletes an
 * account today — Better Auth's delete-user plugin isn't enabled — so this is
 * the call that closes that gap the moment one exists, and the one to reach for
 * when removing a user out of band.
 */
export function removeUserAttachments(userId: string): Promise<number> {
  return removeAttachmentPrefix(userId);
}

/**
 * Every object path under a prefix.
 *
 * The list endpoint is one level at a time, so a user prefix is walked into its
 * per-brief folders. Depth is bounded by the layout — user → brief → object —
 * so this recurses exactly once.
 */
async function listPrefix(prefix: string): Promise<string[]> {
  const entries = await listOnce(prefix);
  const out: string[] = [];
  for (const entry of entries) {
    // A folder comes back with no id; a real object always has one.
    if (entry.id) {
      out.push(`${prefix}/${entry.name}`);
    } else {
      const nested = await listOnce(`${prefix}/${entry.name}`);
      for (const child of nested) {
        if (child.id) out.push(`${prefix}/${entry.name}/${child.name}`);
      }
    }
  }
  return out;
}

async function listOnce(
  prefix: string,
): Promise<{ name: string; id: string | null }[]> {
  const res = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prefix, limit: 1000 }),
    signal: deadline(),
  });
  if (!res.ok) return [];
  return (await res.json()) as { name: string; id: string | null }[];
}

/** Encode each segment, keeping the separators that make it a path. */
function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function message(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : "unknown error";
}
