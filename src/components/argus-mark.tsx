import { clsx } from "@/lib/cn";

/**
 * The Argus mark — a gold ring enclosing the "A" peak and a four-point star.
 * Strokes use the brand gold gradient; the star gives a gentle catchlight pulse.
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
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{ transformOrigin: "center" }}
      >
        <defs>
          <linearGradient id="argus-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent-strong)" />
            <stop offset="52%" stopColor="var(--color-accent)" />
            <stop offset="100%" stopColor="var(--color-accent-deep)" />
          </linearGradient>
        </defs>

        {/* outer ring */}
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="url(#argus-gold)"
          strokeWidth="3.4"
        />

        {/* the A */}
        <path
          d="M33 73 L50 26 L67 73"
          fill="none"
          stroke="url(#argus-gold)"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M37 65 L63 65"
          fill="none"
          stroke="url(#argus-gold)"
          strokeWidth="3.4"
          strokeLinecap="round"
        />

        {/* four-point star */}
        <path
          d="M50 45 L51.9 51.1 L58 53 L51.9 54.9 L50 61 L48.1 54.9 L42 53 L48.1 51.1 Z"
          fill="url(#argus-gold)"
          className={animated ? "iris-pulse" : undefined}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
      </svg>
    </span>
  );
}
