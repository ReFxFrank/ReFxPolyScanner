"use client";

import { useEffect, useState } from "react";

export interface Session {
  /** Whether AUTH_PASSWORD is configured at all. */
  authEnabled: boolean;
  /** Public mode: reads open, writes gated. */
  public: boolean;
  /** Whether THIS visitor may manage estimates (operator, or fully-open). */
  admin: boolean;
}

// Fetches the viewer's session once. Returns null until loaded. Used to
// show/hide the operator-only estimate write controls.
export function useSession(): Session | null {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/session", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (alive && s) setSession(s);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return session;
}
