/**
 * Shared disabled treatment for the site's primary (accent-filled) buttons.
 *
 * The previous treatment swapped the accent fill for `line-strong` and the label
 * for `muted`. On the light palette that resolves to a solid beige button with
 * grey text — a control that still reads as the page's main call to action, and
 * at ~3.7:1 does not clear AA either. Hollowing the button out instead makes
 * "not yet" unmistakable in both palettes.
 *
 * Buttons using this must carry `border border-transparent` in their base
 * classes so the disabled border does not shift the layout by a pixel.
 */
export const DISABLED_PRIMARY =
  "disabled:cursor-not-allowed disabled:border-line disabled:bg-transparent disabled:text-faint disabled:shadow-none";
