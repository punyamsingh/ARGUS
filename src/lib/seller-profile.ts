"use client";

import { useSyncExternalStore } from "react";
import { sellerProfileSchema, type SellerProfile } from "@/types/brief";

/**
 * The rep's seller profile (what they sell), persisted to localStorage and
 * exposed as a subscribable external store — same pattern as `brief-history.ts`
 * (no effects, no hydration mismatch). Set once, remembered across every brief:
 * this is what turns ARGUS from a research tool into a co-pilot that knows your
 * product. Best-effort only — any storage/parse error degrades to "no profile".
 */

const KEY = "argus.seller-profile";

let snapshot: SellerProfile | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

/** Read and validate the persisted profile; returns null on any failure. */
function readStorage(): SellerProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = sellerProfileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function emit() {
  for (const l of listeners) l();
}

/** `useSyncExternalStore` subscribe: hydrate on first listener, then track it. */
function subscribe(cb: () => void): () => void {
  if (!hydrated) {
    hydrated = true;
    snapshot = readStorage();
    if (snapshot) queueMicrotask(emit);
  }
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Persist (or, with null, clear) the seller profile and notify subscribers. */
export function saveSellerProfile(profile: SellerProfile | null): void {
  hydrated = true;
  snapshot = profile;
  try {
    if (profile) {
      window.localStorage.setItem(KEY, JSON.stringify(profile));
    } else {
      window.localStorage.removeItem(KEY);
    }
  } catch {
    // best-effort — storage failure just means no persistence this session
  }
  emit();
}

/** React hook: the current seller profile (or null), kept in sync across the app. */
export function useSellerProfile(): SellerProfile | null {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => null,
  );
}
