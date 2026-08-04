/**
 * Where demo mode lives. Deliberately in its own server-safe module: `mode.ts`
 * is a client module, and a plain constant exported from one becomes a client
 * reference when a server component imports it — which silently renders as a
 * stub rather than a path.
 *
 * Demo mode is a *place*, not a stored preference: `/demo` is the home page
 * with the studio laced to the scripted account. That makes it shareable (hand
 * an investor the URL and they land in the demo), impossible to leave switched
 * on by accident, and trivially reasoned about — the route is the whole state.
 */

export const DEMO_PATH = "/demo";

export function isDemoPath(pathname: string | null): boolean {
  return pathname === DEMO_PATH || !!pathname?.startsWith(`${DEMO_PATH}/`);
}
