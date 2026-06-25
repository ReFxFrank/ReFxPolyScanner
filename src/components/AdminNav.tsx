"use client";

import Link from "next/link";
import { useSession } from "./useSession";

// Header affordance for the operator in PUBLIC mode: a quiet "Operator" sign-in
// link when anonymous, or a "Sign out" action when logged in. Hidden entirely
// when auth is off (fully open) or in private mode (the whole site is gated, so
// there's nothing to toggle).
export function AdminNav() {
  const session = useSession();
  if (!session || !session.authEnabled || !session.public) return null;

  async function signOut() {
    await fetch("/api/login", { method: "DELETE" });
    window.location.href = "/";
  }

  if (session.admin) {
    return (
      <button
        onClick={signOut}
        className="rounded-refx-sm px-3 py-1.5 text-refx-meta transition-colors hover:bg-white/[0.04] hover:text-refx-text"
      >
        Sign out
      </button>
    );
  }
  return (
    <Link
      href="/login"
      className="rounded-refx-sm px-3 py-1.5 text-refx-blueText transition-colors hover:bg-white/[0.04]"
    >
      Operator
    </Link>
  );
}
