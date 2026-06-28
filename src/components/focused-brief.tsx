"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { BriefInput, BriefResult } from "@/types/brief";
import { getBriefById } from "@/lib/brief-history";
import { PENDING_BRIEF_KEY, useBriefStream } from "@/lib/use-brief-stream";
import { ArgusMark } from "@/components/argus-mark";
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
  const { status, stage, result, error, run } = useBriefStream();
  const [loaded, setLoaded] = useState<BriefResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const inputRef = useRef<BriefInput | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    /* eslint-disable react-hooks/set-state-in-effect --
       One-shot read of browser storage on mount (sessionStorage for a pending
       generation, localStorage history for a saved brief); guarded by
       startedRef so it runs once and can't loop. */
    if (id === "new") {
      const raw = sessionStorage.getItem(PENDING_BRIEF_KEY);
      sessionStorage.removeItem(PENDING_BRIEF_KEY);
      if (!raw) {
        setNotFound(true);
        return;
      }
      let input: BriefInput;
      try {
        input = JSON.parse(raw) as BriefInput;
      } catch {
        setNotFound(true);
        return;
      }
      inputRef.current = input;
      void run(input, (r) => {
        // Swap the ephemeral /brief/new for the saved brief's own URL so a
        // refresh or bookmark lands back on it.
        router.replace(`/brief/${encodeURIComponent(r.meta.generatedAt)}`);
      });
    } else {
      const found = getBriefById(id);
      if (found) setLoaded(found);
      else setNotFound(true);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [id, run, router]);

  const brief = result ?? loaded;

  return (
    <main className="relative flex min-h-full flex-1 flex-col">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-glow opacity-60" />

      {/* slim focused chrome */}
      <header className="sticky top-0 z-10 border-b border-line bg-ink/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2 text-ivory" aria-label="ARGUS home">
            <ArgusMark size={22} />
            <span className="font-display text-sm font-semibold tracking-tight">ARGUS</span>
          </Link>
          <Link
            href="/"
            className="rounded-full border border-line bg-surface/60 px-3.5 py-1.5 text-[13px] font-medium text-ivory transition-colors hover:border-line-strong hover:bg-surface-2"
          >
            New brief
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        {notFound && <NotFound />}
        {!notFound && status === "loading" && <BriefLoader stage={stage} />}
        {!notFound && status === "error" && (
          <BriefError
            message={error}
            onRetry={() => {
              if (inputRef.current) void run(inputRef.current);
            }}
          />
        )}
        {!notFound && brief && <BriefConversation result={brief} />}
      </div>
    </main>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[var(--radius-card)] border border-line bg-surface/40 p-8 text-center">
      <p className="text-sm text-ivory">This brief isn’t available on this device.</p>
      <p className="mt-1 max-w-sm text-[13px] text-muted">
        Briefs are saved locally in your browser. Generate a fresh one to pick up
        where you left off.
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
