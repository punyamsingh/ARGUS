"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { isDemoPath } from "./path";

/**
 * The client-side read of demo mode.
 *
 * `/demo` is the demo *surface* — the studio laced with the scripted account
 * (see `path.ts`). But a demo doesn't end at the studio: generating a brief
 * carries the presenter to `/brief/new` and then to `/brief/<id>`, routes that
 * live outside `/demo`. The path alone therefore answers "is the studio
 * scripted?", not "is this person still inside a demo?" — which is why the
 * floating control used to offer "Try demo" to someone already watching one.
 *
 * So there are two reads, and they are not the same question:
 *
 *  - `useDemoMode()` — is *this surface* the demo surface? Path-only. The
 *    studio uses it to decide whether to lace and lock its form.
 *  - `useInDemo()` — is the visitor inside a demo *at all*, anywhere? The path,
 *    or a demo brief currently on screen. The demo control uses it, so the way
 *    out stays offered for as long as there is something to bail out of.
 */

export function useDemoMode(): boolean {
  return isDemoPath(usePathname());
}

/**
 * Whether a demo brief is on screen right now, as a tiny external store — the
 * same shape as `theme.ts` and the demo control's own dismissal.
 *
 * Deliberately *not* persisted. Demo mode is a place, not a preference: this is
 * a live fact about what is currently rendered, published by the brief page and
 * retracted when it unmounts. Nothing can be left switched on by accident, and
 * a reload re-derives it from the brief's own `meta.demo`.
 */
let demoBrief = false;
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Published by the brief page while it is showing a demo brief. */
export function setDemoBrief(active: boolean): void {
  if (demoBrief === active) return;
  demoBrief = active;
  for (const l of listeners) l();
}

export function useInDemo(): boolean {
  const onDemoPath = isDemoPath(usePathname());
  const viewingDemoBrief = useSyncExternalStore(
    subscribe,
    () => demoBrief,
    () => false,
  );
  return onDemoPath || viewingDemoBrief;
}
