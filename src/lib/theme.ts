"use client";

import { useSyncExternalStore } from "react";
import { THEME_KEY } from "@/lib/theme-bootstrap";

/**
 * Theme preference — dark, light, or "system" (follow the OS). Dark is the
 * default on every device, and following the OS is an explicit opt-in rather
 * than the fallback: an unset preference means dark, not "ask the machine".
 * Persisted to localStorage and exposed as a subscribable external store,
 * mirroring `brief-history.ts`: components read it with `useSyncExternalStore`
 * (no effects, no hydration mismatch) and the WebGL backdrop — which is not a
 * React tree — subscribes directly via `subscribeResolvedTheme`.
 *
 * The resolved theme is written to `<html data-theme>`, which `globals.css`
 * keys its light palette off. An inline script in the root layout stamps the
 * same attribute before first paint, so there is no flash of the wrong theme;
 * this module only takes over once React hydrates.
 */

const KEY = THEME_KEY;

export type ThemeChoice = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

type Snapshot = { choice: ThemeChoice; resolved: ResolvedTheme };

/** Matches what the server renders (and what the pre-paint script assumes). */
const SERVER: Snapshot = { choice: "dark", resolved: "dark" };

let snapshot: Snapshot = SERVER;
let hydrated = false;
const listeners = new Set<() => void>();
let media: MediaQueryList | null = null;

function isChoice(value: unknown): value is ThemeChoice {
  return value === "system" || value === "light" || value === "dark";
}

/** The OS-level preference; defaults to dark when unknown or unsupported. */
function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function resolve(choice: ThemeChoice): ResolvedTheme {
  return choice === "system" ? systemTheme() : choice;
}

/** Read the persisted choice; nothing stored (or any storage failure) is dark. */
function readChoice(): ThemeChoice {
  if (typeof window === "undefined") return "dark";
  try {
    const raw = window.localStorage.getItem(KEY);
    return isChoice(raw) ? raw : "dark";
  } catch {
    return "dark";
  }
}

function emit() {
  for (const l of listeners) l();
}

/** Push the resolved theme onto `<html>` so the CSS palette switches. */
function paint(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = resolved;
}

/** Recompute the snapshot from a choice, repaint, and notify — if anything moved. */
function commit(choice: ThemeChoice) {
  const resolved = resolve(choice);
  if (snapshot.choice === choice && snapshot.resolved === resolved) return;
  snapshot = { choice, resolved };
  paint(resolved);
  emit();
}

/**
 * First-subscriber hydration: adopt the stored choice and start tracking the OS
 * preference, so a "system" user following their laptop's schedule flips live.
 */
function hydrate() {
  if (hydrated) return;
  hydrated = true;

  const choice = readChoice();
  snapshot = { choice, resolved: resolve(choice) };

  if (typeof window !== "undefined" && window.matchMedia) {
    media = window.matchMedia("(prefers-color-scheme: light)");
    media.addEventListener("change", () => {
      // Only "system" tracks the OS; an explicit choice stays put.
      if (snapshot.choice === "system") commit("system");
    });
  }

  // The pre-paint script already stamped `data-theme`; re-notify React so the
  // toggle's initial (server-matching) render is replaced with the real state.
  if (snapshot.choice !== SERVER.choice || snapshot.resolved !== SERVER.resolved) {
    paint(snapshot.resolved);
    queueMicrotask(emit);
  }
}

function subscribe(cb: () => void): () => void {
  hydrate();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Set (and persist) the theme preference. "system" is stored like any other
 * choice rather than cleared: with dark as the default, an absent key means
 * dark, so clearing it would silently undo the visitor's pick.
 */
export function setTheme(choice: ThemeChoice): void {
  hydrated = true;
  try {
    window.localStorage.setItem(KEY, choice);
  } catch {
    // best-effort — full/blocked storage just means the choice is session-only
  }
  commit(choice);
}

/** The theme actually in effect right now, outside of React. */
export function getResolvedTheme(): ResolvedTheme {
  hydrate();
  return snapshot.resolved;
}

/**
 * Non-React subscription to the resolved theme, for imperative consumers like
 * the WebGL backdrop. Returns an unsubscribe function.
 */
export function subscribeResolvedTheme(
  cb: (theme: ResolvedTheme) => void,
): () => void {
  let last = getResolvedTheme();
  return subscribe(() => {
    if (snapshot.resolved === last) return;
    last = snapshot.resolved;
    cb(last);
  });
}

/** React hook: the current choice and the theme it resolves to. */
export function useTheme(): Snapshot {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => SERVER,
  );
}
