// ── Auth (single-user, app-level session) ─────────────────────────────────
// Read-only panel: there are no money-moving secrets here, the only goal is
// "don't let randoms read it". One password from AUTH_PASSWORD. The session
// cookie holds SHA-256(salt + password); the middleware recomputes and
// compares. If AUTH_PASSWORD is unset, auth is DISABLED (dev convenience) —
// set it in production when internet-exposed (see .env.example / README).

export const SESSION_COOKIE = "pp_session";
const SALT = "polypanel:v1:";

export function authEnabled(): boolean {
  return !!process.env.AUTH_PASSWORD;
}

/**
 * Public mode: reads/pages are open to anyone, but estimate WRITES still
 * require the operator's session (admin) cookie. Enabled with PUBLIC=true.
 */
export function isPublic(): boolean {
  return process.env.PUBLIC === "true";
}

/**
 * Server-side check that a session token grants admin (write) rights. When
 * auth is disabled entirely, everyone is treated as admin (fully-open mode).
 */
export async function isValidAdminToken(
  token: string | undefined | null
): Promise<boolean> {
  const expected = await expectedToken();
  if (!expected) return true; // no AUTH_PASSWORD → fully open, writes allowed
  return !!token && safeEqual(token, expected);
}

/** Compute the opaque session token for a password (Web Crypto; edge-safe). */
export async function sessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(SALT + password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** The expected token for the configured password (or null if auth is off). */
export async function expectedToken(): Promise<string | null> {
  const pw = process.env.AUTH_PASSWORD;
  return pw ? sessionToken(pw) : null;
}

/** Constant-time-ish comparison to avoid trivial timing leaks. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
