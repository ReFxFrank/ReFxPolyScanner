import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReFx PolyPanel",
  description: "Read-only Polymarket research dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-panel-bg text-[#e5edf5] antialiased">
        <header className="sticky top-0 z-20 border-b border-panel-border bg-panel-bg/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-2.5">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="text-flag-arb">◆</span>
              <span>ReFx PolyPanel</span>
              <span className="rounded bg-panel-surface px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-panel-muted">
                read-only
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm text-panel-muted">
              <Link href="/" className="hover:text-white">
                Dashboard
              </Link>
              <Link href="/calls" className="hover:text-white">
                My Calls
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-4">{children}</main>
      </body>
    </html>
  );
}
