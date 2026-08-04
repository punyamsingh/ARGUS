import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { getPool, isDatabaseConfigured } from "@/db";

/**
 * The auth layer — Better Auth with Google as the only provider, backed by the
 * same Supabase Postgres that stores briefs.
 *
 * Sign-in is **optional**, so auth is optional too: with no `DATABASE_URL` or no
 * Google credentials the app runs exactly as it did before, briefs simply stay
 * in the browser. Everything here is therefore built lazily and every caller
 * gates on `isAuthConfigured()` — an unconfigured deployment must degrade, not
 * 500, and `next build` must not need a database.
 *
 * `nextCookies()` is the last plugin on purpose: it flushes Set-Cookie headers
 * from server actions and must run after every other hook.
 */

export function isAuthConfigured(): boolean {
  return (
    isDatabaseConfigured() &&
    !!process.env.GOOGLE_CLIENT_ID &&
    !!process.env.GOOGLE_CLIENT_SECRET
  );
}

/** Built through a factory so `Auth` is inferred from *these* options. Naming the
 *  type as `ReturnType<typeof betterAuth>` instead widens it to the generic
 *  `BetterAuthOptions` and the two no longer unify. */
function createAuth() {
  return betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    // A `pg` Pool satisfies kysely's `PostgresPool`, so Better Auth drives its
    // own tables through its built-in Kysely path — no adapter, and no second
    // driver alongside the one the brief queries use.
    database: getPool(),
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      },
    },
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;

let cached: Auth | null = null;

/** The Better Auth instance. Throws when unconfigured — call `isAuthConfigured()`
 *  first anywhere the answer should be a graceful no. */
export function getAuth(): Auth {
  cached ??= createAuth();
  return cached;
}

/** The signed-in user for a request, or `null` — for signed-out visitors, an
 *  expired session, and an unconfigured deployment alike. The three are the same
 *  answer to every caller: no server-side storage for this request. */
export async function getSessionUser(
  headers: Headers,
): Promise<{ id: string; name: string; email: string; image?: string | null } | null> {
  if (!isAuthConfigured()) return null;
  try {
    const session = await getAuth().api.getSession({ headers });
    return session?.user ?? null;
  } catch {
    // A database hiccup must not take the whole request with it — treat an
    // unreadable session as signed out and let the client fall back to local.
    return null;
  }
}
