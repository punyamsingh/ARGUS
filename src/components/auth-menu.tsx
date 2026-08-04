"use client";

import { useEffect, useRef, useState } from "react";
import { signInWithGoogle, signOut, useSession } from "@/lib/auth/client";

/**
 * The sign-in affordance. Signing in is entirely optional — it upgrades brief
 * storage from "this browser" to "your account" — so this is deliberately quiet:
 * a pill next to the primary action, never a wall or a modal.
 *
 * Whether sign-in exists at all is discovered from the session request rather
 * than passed down from the server. It has to be: the landing page is
 * statically prerendered, so a server-side `isAuthConfigured()` would be
 * evaluated at *build* time and baked into the HTML, leaving the control stuck
 * at whatever the build machine's environment happened to be. `/api/auth/*`
 * answers 503 when it isn't configured, which is a runtime fact, so the menu
 * simply renders nothing when it sees one.
 */
export function AuthMenu() {
  const { data, isPending, error } = useSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close the menu on an outside click or Escape — a dropdown that traps focus
  // in a sticky header is worse than no dropdown.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // 503 — this deployment has no database or no Google credentials, so there is
  // nothing to sign into. Render nothing at all, which is what keeps a key-less
  // local clone looking exactly as it did before any of this existed.
  if (error?.status === 503) return null;

  // Hold the space while the session resolves rather than flashing "Sign in" at
  // someone who is already signed in.
  if (isPending) return <div className="size-8" aria-hidden="true" />;

  const user = data?.user;

  if (!user) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void signInWithGoogle().catch(() => setBusy(false));
        }}
        className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3.5 py-1.5 text-[13px] font-medium text-ivory transition-colors hover:border-line-strong hover:bg-surface-2 disabled:opacity-60"
      >
        <GoogleGlyph />
        {busy ? "Signing in…" : "Sign in"}
      </button>
    );
  }

  const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account"
        className="flex size-8 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-2 text-[13px] font-semibold text-ivory transition-colors hover:border-line-strong"
      >
        {user.image ? (
          /* A 32px external Google avatar — not worth a `remotePatterns` entry
             and an optimiser round-trip, so plain <img>. */
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="size-full object-cover" />
        ) : (
          initial
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-10 z-50 w-56 overflow-hidden rounded-xl border border-line-strong bg-surface shadow-lg"
        >
          <div className="border-b border-line px-3.5 py-3">
            <p className="truncate text-[13px] font-medium text-ivory">{user.name}</p>
            <p className="truncate text-[12px] text-muted">{user.email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="w-full px-3.5 py-2.5 text-left text-[13px] text-ivory transition-colors hover:bg-surface-2"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/** Google's four-colour G. Inlined — it's six paths and avoids a network hop. */
function GoogleGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.1 24.5c0-1.6-.1-2.8-.4-4H24v7.3h12.1c-.2 2-1.6 5-4.5 7l-.1.3 6.5 5 .5.1c4.1-3.8 6.6-9.4 6.6-15.7"
      />
      <path
        fill="#34A853"
        d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4c-1.9 1.3-4.4 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-.3 0-6.7 5.2-.1.3C8 40.5 15.4 46 24 46"
      />
      <path
        fill="#FBBC05"
        d="M11.5 28.4c-.5-1.4-.7-2.9-.7-4.4s.3-3 .7-4.4l0-.3-6.8-5.3-.2.1A22 22 0 0 0 2 24c0 3.5.9 6.9 2.5 9.9z"
      />
      <path
        fill="#EA4335"
        d="M24 9.5c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 3.4 29.9 1 24 1 15.4 1 8 6.5 4.5 14.1l7 5.5C13.3 14.3 18.2 9.5 24 9.5"
      />
    </svg>
  );
}
