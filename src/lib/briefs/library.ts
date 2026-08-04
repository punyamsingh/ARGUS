"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { BriefResult } from "@/types/brief";
import { useSession } from "@/lib/auth/client";
import { getBriefById, useBriefHistory } from "@/lib/brief-history";
import type { BriefSummary } from "./map";

/**
 * The brief library — one list for the studio to render, whichever side of
 * sign-in the visitor is on.
 *
 * Signed out, this *is* `brief-history.ts`: the same localStorage store, the
 * same six entries, unchanged behaviour. Signed in, it serves the account's
 * briefs from `GET /api/briefs`, because those are the ones that follow you to
 * another device. It deliberately does not merge the two — `claim-local-briefs`
 * pushes local history into the account on first sign-in, so after that the
 * server copy is the complete one and a merge would just show duplicates.
 *
 * The remote half keeps the module-level external-store shape used by
 * `brief-history.ts`, `seller-profile.ts`, and `theme.ts`, so a component reads
 * it through `useSyncExternalStore` with a server snapshot that matches the
 * first client render. Unlike those, hydration here is a network call, so it
 * runs in an effect rather than on first subscribe.
 */

/** A row in the list, from either side. */
export type LibraryEntry = {
  /** Server id when remote; the brief's `generatedAt` when local. Either way,
   *  this is what `/brief/<id>` resolves. */
  id: string;
  company: string;
  person: string;
  context: string;
  evidenceCount: number;
  source: "local" | "remote";
  /** Local entries carry the whole brief; remote ones are fetched on open. */
  result: BriefResult | null;
};

const EMPTY: LibraryEntry[] = [];

let remote: LibraryEntry[] = EMPTY;
let loadedForUser: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function toEntry(summary: BriefSummary): LibraryEntry {
  return {
    id: summary.id,
    company: summary.company,
    person: summary.person,
    context: summary.context,
    evidenceCount: summary.evidenceCount,
    source: "remote",
    result: null,
  };
}

/** Pull the account's briefs. Best-effort: a failed load leaves the list as it
 *  was rather than blanking the studio. */
async function loadRemote(userId: string): Promise<void> {
  try {
    const res = await fetch("/api/briefs", { headers: { Accept: "application/json" } });
    if (!res.ok) return;
    const data = (await res.json()) as { ok: boolean; briefs?: BriefSummary[] };
    if (!data.ok || !data.briefs) return;
    remote = data.briefs.map(toEntry);
    loadedForUser = userId;
    emit();
  } catch {
    // offline or mid-deploy — keep whatever is on screen
  }
}

/** Re-pull after a write, so a newly saved or deleted brief shows up. */
export function refreshLibrary(): void {
  if (loadedForUser) void loadRemote(loadedForUser);
}

/**
 * Save a brief to the account. Returns its server id, or `null` when it wasn't
 * saved — signed out, demo mode, or the request failed.
 *
 * Best-effort by construction: it never throws. The brief has already rendered
 * and already landed in local history by the time this runs, so a failure here
 * costs the user nothing. The id matters because it's what `/brief/<id>` will
 * resolve from another device.
 */
export async function saveBriefToAccount(
  result: BriefResult,
): Promise<string | null> {
  // Demo briefs are refused server-side too; skipping here just avoids the trip.
  if (result.meta.demo) return null;
  try {
    const res = await fetch("/api/briefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok: boolean; id?: string | null };
    refreshLibrary();
    return data.ok ? (data.id ?? null) : null;
  } catch {
    // offline or mid-deploy — the brief is rendered and in local history anyway
    return null;
  }
}

/** Remove a brief from the account. Returns whether it went. */
export async function deleteBriefFromAccount(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/briefs/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) return false;
    remote = remote.filter((e) => e.id !== id);
    emit();
    return true;
  } catch {
    return false;
  }
}

/** Fetch one saved brief from the account. `null` when it isn't there — which
 *  includes another user's id, by design. */
export async function fetchBriefFromAccount(
  id: string,
): Promise<BriefResult | null> {
  try {
    const res = await fetch(`/api/briefs/${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok: boolean; brief?: BriefResult };
    return data.ok && data.brief ? data.brief : null;
  } catch {
    return null;
  }
}

/**
 * The list to render, plus how to open one of its entries.
 *
 * `open` is async because a remote entry is a summary until it's asked for —
 * the brief body is only fetched when someone actually opens it, so listing a
 * long library doesn't drag every evidence store down with it.
 */
export function useBriefLibrary(): {
  entries: LibraryEntry[];
  signedIn: boolean;
  open: (entry: LibraryEntry) => Promise<BriefResult | null>;
} {
  const { data } = useSession();
  const userId = data?.user?.id ?? null;
  const local = useBriefHistory();

  const remoteEntries = useSyncExternalStore(
    subscribe,
    () => remote,
    () => EMPTY,
  );

  useEffect(() => {
    if (!userId) {
      // Signing out drops the account list rather than leaving another user's
      // briefs on screen.
      if (loadedForUser !== null) {
        remote = EMPTY;
        loadedForUser = null;
        emit();
      }
      return;
    }
    if (loadedForUser !== userId) void loadRemote(userId);
  }, [userId]);

  const entries = useMemo<LibraryEntry[]>(() => {
    if (userId) return remoteEntries;
    return local.map((e) => ({
      id: e.id,
      company: e.company,
      person: e.person,
      context: e.context,
      evidenceCount: e.result.evidence.length,
      source: "local" as const,
      result: e.result,
    }));
  }, [userId, remoteEntries, local]);

  const open = useCallback(async (entry: LibraryEntry) => {
    if (entry.result) return entry.result;
    return fetchBriefFromAccount(entry.id);
  }, []);

  return { entries, signedIn: !!userId, open };
}

/** Resolve a brief for `/brief/<id>`: the account first, then this browser's
 *  local history. That order matters — a signed-in user's server copy is the
 *  canonical one — and the local fallback is what keeps old
 *  `/brief/<generatedAt>` links working after the id scheme changed. */
export async function resolveBrief(
  id: string,
  signedIn: boolean,
): Promise<BriefResult | null> {
  if (signedIn) {
    const remoteBrief = await fetchBriefFromAccount(id);
    if (remoteBrief) return remoteBrief;
  }
  return getBriefById(id);
}
