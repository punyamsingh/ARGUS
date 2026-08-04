"use client";

import { clsx } from "@/lib/cn";
import { setTheme, useTheme, type ThemeChoice } from "@/lib/theme";

/**
 * Three-way theme control that lives in the site footer: light, auto (follow
 * the OS), dark. A segmented control rather than a single flip-switch so
 * "auto" stays reachable — most visitors never touch it, and the ones who do
 * usually want the site to track their machine rather than pin one mode.
 */

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path
        strokeLinecap="round"
        d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.2 8.2 0 1 0 10.2 10.2Z"
      />
    </svg>
  );
}

function AutoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="12" cy="12" r="8.2" />
      <path fill="currentColor" stroke="none" d="M12 3.8a8.2 8.2 0 0 1 0 16.4Z" />
    </svg>
  );
}

const OPTIONS: { value: ThemeChoice; label: string; Icon: () => React.ReactElement }[] = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "system", label: "System", Icon: AutoIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
];

export function ThemeToggle() {
  const { choice } = useTheme();

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className="inline-flex items-center gap-0.5 rounded-full border border-line bg-surface/85 p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = choice === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={active}
            title={`${label} theme`}
            className={clsx(
              "grid size-7 place-items-center rounded-full transition-colors",
              active
                ? "bg-surface-2 text-accent"
                : "text-faint hover:text-ivory",
            )}
          >
            <Icon />
            <span className="sr-only">{label} theme</span>
          </button>
        );
      })}
    </div>
  );
}
