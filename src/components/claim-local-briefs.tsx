"use client";

import { useEffect, useRef } from "react";
import { useSession } from "@/lib/auth/client";
import { readLocalBriefs } from "@/lib/brief-history";
import { refreshLibrary } from "@/lib/briefs/library";

/**
 * Moves this browser's saved briefs into the account, once, on first sign-in.
 *
 * Without it, signing in reads as data loss: the briefs someone generated
 * before making an account would quietly stop appearing, because the library
 * switches to the server list the moment there's a session. Nobody should have
 * to choose between signing in and keeping their work.
 *
 * Runs once per user per browser, guarded by a localStorage marker. The real
 * safety net is server-side though — the unique index on
 * `(user_id, generated_at)` means a double-fire, a re-signin, or two tabs racing
 * all collapse to the same rows. The marker just avoids the pointless request.
 *
 * Renders nothing; it's mounted in the root layout so it sees every sign-in
 * regardless of which page it happened on.
 */

const claimedKey = (userId: string) => `argus.claimed-for.${userId}`;

export function ClaimLocalBriefs() {
  const { data } = useSession();
  const userId = data?.user?.id ?? null;
  // Guards against a second run inside one mount while the request is in
  // flight — the marker isn't written until it comes back.
  const runningRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || runningRef.current === userId) return;

    let alreadyClaimed = false;
    try {
      alreadyClaimed = !!window.localStorage.getItem(claimedKey(userId));
    } catch {
      // storage blocked — fall through and let the unique index dedupe
    }
    if (alreadyClaimed) return;

    const briefs = readLocalBriefs().map((e) => e.result);
    if (briefs.length === 0) {
      // Nothing to move, but still mark it: a later brief generated while
      // signed in is written through directly and must not be re-claimed.
      try {
        window.localStorage.setItem(claimedKey(userId), "1");
      } catch {
        // best-effort
      }
      return;
    }

    runningRef.current = userId;
    void (async () => {
      try {
        const res = await fetch("/api/briefs/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ briefs }),
        });
        if (!res.ok) return; // leave the marker unset so a reload retries
        try {
          window.localStorage.setItem(claimedKey(userId), "1");
        } catch {
          // best-effort
        }
        refreshLibrary();
      } catch {
        // offline — the briefs are still in localStorage, so a later visit
        // picks this back up. Nothing is lost by failing here.
      } finally {
        runningRef.current = null;
      }
    })();
  }, [userId]);

  return null;
}
