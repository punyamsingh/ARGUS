"use client";

import { usePathname } from "next/navigation";
import { isDemoPath } from "./path";

/**
 * The client-side read of demo mode: are we on the demo surface right now?
 * The route is the state (see `path.ts`), so there's nothing to persist and
 * nothing to synchronise.
 *
 * Everything downstream of the studio — the streaming brief page, follow-ups —
 * carries the flag explicitly rather than re-deriving it from the path, since
 * those routes live outside `/demo`.
 */
export function useDemoMode(): boolean {
  return isDemoPath(usePathname());
}
