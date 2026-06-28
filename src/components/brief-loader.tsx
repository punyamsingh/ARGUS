import { clsx } from "@/lib/cn";
import type { BriefStage } from "@/types/brief";

/**
 * The generation loading + error states, shared between the focused brief page
 * and anywhere a brief streams. A skeleton in the shape of the finished brief
 * (so the layout doesn't jump) with the live pipeline stage surfaced below.
 */

const STAGES: { key: BriefStage; label: string }[] = [
  { key: "resolving", label: "Resolving the company & person…" },
  { key: "gathering", label: "Gathering signals across sources…" },
  { key: "synthesizing", label: "Synthesising your brief…" },
];

/** A shimmering skeleton placeholder bar. */
function Bar({ className }: { className?: string }) {
  return (
    <div className={clsx("animate-pulse rounded bg-line-strong/60", className)} />
  );
}

export function BriefLoader({ stage }: { stage: BriefStage }) {
  const current = STAGES.findIndex((s) => s.key === stage);

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line-strong bg-surface/50">
      {/* header */}
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
        <div className="w-full">
          <Bar className="h-2.5 w-24" />
          <Bar className="mt-3 h-5 w-2/3" />
          <Bar className="mt-2 h-3 w-1/2" />
        </div>
        <Bar className="hidden h-8 w-10 shrink-0 sm:block" />
      </div>

      {/* body — four section placeholders, matching the real brief grid */}
      <div className="grid gap-6 px-6 py-6 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <Bar className="h-2 w-20" />
            <Bar className="mt-3 h-3 w-full" />
            <Bar className="mt-2 h-3 w-5/6" />
          </div>
        ))}
      </div>

      {/* live stage strip */}
      <div className="flex items-center gap-3 border-t border-line px-6 py-4">
        <span className="relative flex size-3 shrink-0 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-accent/30" />
          <span className="size-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)]" />
        </span>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {STAGES.map((s, i) => (
            <span
              key={s.key}
              className={
                i === current
                  ? "text-[12px] text-ivory"
                  : i < current
                    ? "text-[12px] text-faint line-through decoration-line-strong"
                    : "text-[12px] text-faint"
              }
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BriefError({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[var(--radius-card)] border border-risk/40 bg-surface/50 p-8 text-center">
      <span className="size-2.5 rounded-full bg-risk shadow-[0_0_10px_var(--color-risk)]" />
      <p className="mt-4 max-w-sm text-sm text-ivory">
        {message ?? "Something went wrong."}
      </p>
      <button
        onClick={onRetry}
        className="mt-5 rounded-xl border border-line-strong bg-surface-2 px-4 py-2 text-sm font-medium text-ivory transition-colors hover:bg-surface"
      >
        Try again
      </button>
    </div>
  );
}
