import { clsx } from "@/lib/cn";

/**
 * The Argus mark — an all-seeing iris.
 * A slow scanning ring around a gold iris and dark pupil.
 */
export function ArgusMark({
  size = 36,
  className,
  animated = true,
}: {
  size?: number;
  className?: string;
  animated?: boolean;
}) {
  return (
    <span
      className={clsx("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* Scanning ring */}
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className={clsx("absolute inset-0", animated && "ring-scan")}
        style={{ transformOrigin: "center" }}
      >
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke="var(--color-line-strong)"
          strokeWidth="1.5"
          strokeDasharray="3 9"
        />
      </svg>

      {/* Iris + pupil */}
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className={animated ? "iris-pulse" : undefined}
        style={{ transformOrigin: "center" }}
      >
        <defs>
          <radialGradient id="argus-iris" cx="38%" cy="34%" r="75%">
            <stop offset="0%" stopColor="var(--color-accent-strong)" />
            <stop offset="55%" stopColor="var(--color-accent)" />
            <stop offset="100%" stopColor="var(--color-accent-deep)" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="30" fill="url(#argus-iris)" />
        <circle cx="50" cy="50" r="30" fill="none" stroke="var(--color-ink)" strokeOpacity="0.25" strokeWidth="2" />
        <circle cx="50" cy="50" r="12" fill="var(--color-ink)" />
        {/* catchlight */}
        <circle cx="42" cy="42" r="4" fill="#fff" fillOpacity="0.9" />
      </svg>
    </span>
  );
}
