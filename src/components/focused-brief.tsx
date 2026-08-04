"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { BriefInput, BriefResult } from "@/types/brief";
import { useSession } from "@/lib/auth/client";
import { resolveBrief } from "@/lib/briefs/library";
import {
  PENDING_BRIEF_KEY,
  parsePendingBrief,
  useBriefStream,
} from "@/lib/use-brief-stream";
import { setDemoBrief } from "@/lib/demo/mode";
import { BriefConversation } from "@/components/brief-conversation";
import { BriefError, BriefLoader } from "@/components/brief-loader";

/**
 * The focused, single-column brief page. Two modes:
 *  - `id === "new"`: read the pending input the studio stashed and STREAM the
 *    brief here, then swap the URL for the saved brief's id so refresh works.
 *  - a real id: load that brief from history and show it.
 * Either way it's the same focused conversation surface — brief on top, grounded
 * follow-ups beneath.
 */
export function FocusedBrief({ id }: { id: string }) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();
  const signedIn = !!session?.user;
  const { status, stage, result, error, run } = useBriefStream();
  const [loaded, setLoaded] = useState<BriefResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const inputRef = useRef<BriefInput | null>(null);
  const demoRef = useRef(false);
  const startedRef = useRef(false);
  /** Mirrors `demoRef` as state, so the demo control can react to it. */
  const [demoRun, setDemoRun] = useState(false);

  useEffect(() => {
    if (startedRef.current) return;

    // A saved brief is looked up in the account first, so wait for the session
    // to settle before deciding where to look — starting early would treat a
    // signed-in user as anonymous and skip the server. Generating doesn't
    // depend on the session, so `/brief/new` never waits.
    if (id !== "new" && sessionPending) return;

    startedRef.current = true;

    /* eslint-disable react-hooks/set-state-in-effect --
       One-shot resolution on mount (sessionStorage for a pending generation,
       account-then-localStorage for a saved brief); guarded by startedRef so it
       runs once and can't loop. */
    if (id === "new") {
      const raw = sessionStorage.getItem(PENDING_BRIEF_KEY);
      sessionStorage.removeItem(PENDING_BRIEF_KEY);
      if (!raw) {
        setNotFound(true);
        return;
      }
      const pending = parsePendingBrief(raw);
      if (!pending) {
        setNotFound(true);
        return;
      }
      inputRef.current = pending.input;
      demoRef.current = pending.demo === true;
      setDemoRun(demoRef.current);
      void run(
        pending.input,
        (r, savedId) => {
          // Swap the ephemeral /brief/new for the brief's own URL so a refresh
          // or bookmark lands back on it. Prefer the account id when there is
          // one — that's the link that also opens on another device.
          const url = savedId ?? r.meta.generatedAt;
          router.replace(`/brief/${encodeURIComponent(url)}`);
        },
        { demo: demoRef.current },
      );
    } else {
      void resolveBrief(id, signedIn).then((found) => {
        // A saved demo brief is still a demo — reopening one from history, or
        // reloading this page, puts the presenter back inside it.
        if (found) {
          setLoaded(found);
          setDemoRun(found.meta.demo === true);
        } else setNotFound(true);
      });
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [id, run, router, signedIn, sessionPending]);

  /**
   * Publish demo mode for as long as this page shows a demo brief, and retract
   * it on the way out — the demo control lives in the root layout and has no
   * other way to know that a brief being streamed here came from the demo.
   */
  useEffect(() => {
    if (!demoRun) return;
    setDemoBrief(true);
    return () => setDemoBrief(false);
  }, [demoRun]);

  const brief = result ?? loaded;

  // The site header and footer come from the root layout. The brief sits in a
  // narrower reading column — only the column narrows, not the site.
  return (
    <main className="relative flex min-h-full flex-1 flex-col">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-glow opacity-60" />

      {/* Still one centred reading column — a brief is a document and a
          full-window line length is unreadable — just a little wider. */}
      <div className="shell w-full max-w-4xl flex-1 py-8">
        {notFound && <NotFound />}
        {!notFound && status === "loading" && <BriefLoader stage={stage} />}
        {!notFound && status === "error" && (
          <BriefError
            message={error}
            onRetry={() => {
              if (inputRef.current) {
                void run(inputRef.current, undefined, {
                  demo: demoRef.current,
                });
              }
            }}
          />
        )}
        {/* No expand light here — this is already the expanded view. Closing
            the window returns to the studio. */}
        {!notFound && brief && (
          <BriefConversation result={brief} onClose={() => router.push("/")} />
        )}
      </div>
    </main>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[var(--radius-card)] border border-line bg-surface/95 p-8 text-center">
      <p className="text-sm text-ivory">
        This brief isn’t available on this device.
      </p>
      <p className="mt-1 max-w-sm text-[13px] text-muted">
        Briefs are saved locally in your browser. Generate a fresh one to pick
        up where you left off.
      </p>
      <Link
        href="/"
        className="mt-5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-ink transition-opacity hover:bg-accent-strong"
      >
        Generate a brief
      </Link>
    </div>
  );
}
