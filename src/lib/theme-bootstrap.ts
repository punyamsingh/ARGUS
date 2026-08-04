/**
 * The theme's storage key and its pre-paint bootstrap script.
 *
 * Deliberately server-safe (no "use client"): the root layout is a server
 * component and needs the literal string to inline, while `theme.ts` — which
 * *is* a client module — imports the key from here so the two can never drift.
 */

export const THEME_KEY = "argus.theme";

/**
 * Runs before first paint to stamp `<html data-theme>`, so a visitor who has
 * chosen light never sees a flash of the dark palette. Mirrors
 * `readChoice`/`systemTheme` in `theme.ts`; keep the two in step.
 *
 * Dark is the default on every device: ARGUS is a dark product, and a visitor
 * whose laptop happens to be in light mode should still meet it the way it was
 * designed. Following the OS is opt-in — an explicitly stored "system" — so an
 * absent key means dark, not "ask the machine".
 */
export const THEME_BOOTSTRAP = `(function(){try{var c=localStorage.getItem(${JSON.stringify(
  THEME_KEY,
)});var r=(c==="light"||c==="dark")?c:(c==="system"&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");document.documentElement.dataset.theme=r}catch(e){document.documentElement.dataset.theme="dark"}})()`;
