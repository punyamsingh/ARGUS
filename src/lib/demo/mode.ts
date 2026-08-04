"use client";

import { useSyncExternalStore } from "react";

/**
 * Demo mode — the presenter switch.
 *
 * On: the studio locks to the scripted account in `scenario.ts` and generation
 * runs against its fixed evidence store (synthesis is still a real model call).
 * Off: nothing changes; ARGUS behaves exactly as it always has.
 *
 * The preference is per-device (localStorage), and `?demo=1` on any URL turns it
 * on — so a demo link can be handed to an investor with no setup. `?demo=0`
 * turns it back off. Same external-store shape as `theme.ts`: components read it
 * with `useSyncExternalStore`, so there's no hydration mismatch.
 */

const KEY = "argus.demo-mode";

/** Server render (and first client render) assumes off, matching the markup. */
const SERVER = false;

let snapshot = SERVER;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** `?demo=1` / `?demo=0` wins over storage, and is persisted. */
function fromQuery(): boolean | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("demo");
  if (raw === null) return null;
  return raw !== "0" && raw !== "false";
}

function read(): boolean {
  if (typeof window === "undefined") return SERVER;
  const forced = fromQuery();
  if (forced !== null) {
    persist(forced);
    return forced;
  }
  try {
    return window.localStorage.getItem(KEY) === "on";
  } catch {
    return SERVER;
  }
}

function persist(on: boolean) {
  try {
    if (on) window.localStorage.setItem(KEY, "on");
    else window.localStorage.removeItem(KEY);
  } catch {
    // best-effort — blocked storage just makes the choice session-only
  }
}

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  snapshot = read();
  // Re-notify React so the toggle's server-matching first render is replaced.
  if (snapshot !== SERVER) queueMicrotask(emit);
}

function subscribe(cb: () => void): () => void {
  hydrate();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Turn demo mode on or off (persisted on this device). */
export function setDemoMode(on: boolean): void {
  hydrated = true;
  persist(on);
  if (snapshot === on) return;
  snapshot = on;
  emit();
}

/** Whether demo mode is on right now, outside of React. */
export function isDemoMode(): boolean {
  hydrate();
  return snapshot;
}

/** React hook: the live demo-mode flag. */
export function useDemoMode(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => SERVER,
  );
}
