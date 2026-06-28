"use client";

import { useSyncExternalStore } from "react";
import type { BriefResult } from "@/types/brief";

/**
 * Lightweight client-side history of recent briefs, persisted to localStorage
 * and exposed as a subscribable external store (so components read it with
 * `useSyncExternalStore` — no effects, no hydration mismatch). Sales reps often
 * prep several meetings back-to-back; this keeps the last few briefs one click
 * away. Best-effort only — any storage error degrades to an empty history.
 */

const KEY = "argus.recent-briefs";
const MAX = 6;

export type HistoryEntry = {
  /** Stable id — the brief's generation timestamp. */
  id: string;
  company: string;
  person: string;
  context: string;
  result: BriefResult;
};

const EMPTY: HistoryEntry[] = [];

let snapshot: HistoryEntry[] = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

/**
 * Validate a parsed record before trusting it as a `HistoryEntry`. localStorage
 * can hold stale or corrupted data from an older schema; we only keep records
 * with the fields `RecentBriefs` and `openHistory` actually dereference, so a
 * drifted shape is discarded rather than thrown on at read time.
 */
function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<HistoryEntry>;
  const result = entry.result as BriefResult | undefined;
  return (
    typeof entry.id === "string" &&
    typeof entry.company === "string" &&
    typeof entry.person === "string" &&
    typeof entry.context === "string" &&
    !!result &&
    typeof result === "object" &&
    Array.isArray(result.evidence) &&
    !!result.input &&
    typeof result.input.company === "string" &&
    typeof result.input.person === "string" &&
    typeof result.input.context === "string"
  );
}

/** Read and validate the persisted history; returns `EMPTY` on any failure. */
function readStorage(): HistoryEntry[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isHistoryEntry) : EMPTY;
  } catch {
    return EMPTY;
  }
}

/** Notify all current subscribers that the snapshot changed. */
function emit() {
  for (const l of listeners) l();
}

/** `useSyncExternalStore` subscribe: hydrate on first listener, then track it. */
function subscribe(cb: () => void): () => void {
  // First subscriber hydrates from localStorage and notifies, so the initial
  // (server-matching) empty render is replaced with the stored briefs.
  if (!hydrated) {
    hydrated = true;
    snapshot = readStorage();
    if (snapshot.length > 0) queueMicrotask(emit);
  }
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Prepend a brief, de-duplicating by id, capped at MAX, and notify subscribers. */
export function saveToHistory(result: BriefResult): void {
  const entry: HistoryEntry = {
    id: result.meta.generatedAt,
    company: result.entity.company.name,
    person: result.entity.person.name,
    context: result.input.context,
    result,
  };
  const base = hydrated ? snapshot : readStorage();
  hydrated = true;
  snapshot = [entry, ...base.filter((e) => e.id !== entry.id)].slice(0, MAX);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    // best-effort — full storage just means no history this session
  }
  emit();
}

/** React hook: the current recent-briefs list, kept in sync across the app. */
export function useBriefHistory(): HistoryEntry[] {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  );
}
