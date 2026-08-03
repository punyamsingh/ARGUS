/**
 * The deployed app version, exposed to the client by `next.config.ts` from
 * package.json (which the release workflow bumps). One definition so the
 * fallback can't drift between the header and the footer.
 */
export const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
