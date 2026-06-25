"use client";

import { useState } from "react";

export function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error("Wrong password");
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-24 max-w-sm rounded-lg border border-panel-border bg-panel-surface p-6"
    >
      <h1 className="mb-1 text-lg font-semibold">ReFx PolyPanel</h1>
      <p className="mb-4 text-sm text-panel-muted">Enter the panel password.</p>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
        placeholder="Password"
        className="w-full rounded border border-panel-border bg-panel-bg px-3 py-2 outline-none"
      />
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="mt-4 w-full rounded bg-flag-arb/20 px-3 py-2 font-medium text-flag-arb hover:bg-flag-arb/30 disabled:opacity-50"
      >
        {busy ? "…" : "Sign in"}
      </button>
    </form>
  );
}
