"use client";

import { useState } from "react";
import { GlassPanel } from "./ui/GlassPanel";
import { Button, Eyebrow, Input } from "./ui/Controls";

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
    <GlassPanel beam className="mx-auto mt-24 max-w-sm animate-fade-in p-6">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-refx-blue-glass text-[11px] text-white shadow-refx-glow">
          ◆
        </span>
        <h1 className="font-semibold tracking-tight text-refx-text2">
          ReFx <span className="text-refx-blueText">PolyPanel</span>
        </h1>
      </div>
      <Eyebrow className="mb-4">Enter the panel password</Eyebrow>
      <form onSubmit={submit}>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          placeholder="Password"
          className="w-full"
        />
        {error && <p className="mt-2 text-sm text-status-error">{error}</p>}
        <Button type="submit" variant="primary" disabled={busy} className="mt-4 w-full">
          {busy ? "…" : "Sign in"}
        </Button>
      </form>
    </GlassPanel>
  );
}
