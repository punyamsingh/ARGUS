"use client";

import { createAuthClient } from "better-auth/react";

/**
 * The browser-side auth client. Same-origin, so no `baseURL` is needed — the
 * client talks to `/api/auth/*` on whatever host it was served from, which also
 * means preview deployments work without rebuilding.
 */

export const authClient = createAuthClient();

export const { useSession, signOut } = authClient;

/** Start the Google flow, returning to wherever the user was. Keeping the
 *  callback on the current path means signing in from a brief doesn't dump you
 *  back on the landing page. */
export function signInWithGoogle(callbackURL?: string): Promise<unknown> {
  return authClient.signIn.social({
    provider: "google",
    callbackURL:
      callbackURL ??
      (typeof window === "undefined"
        ? "/"
        : window.location.pathname + window.location.search),
  });
}
