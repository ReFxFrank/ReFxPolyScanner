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
