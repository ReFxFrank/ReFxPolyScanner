import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { AdminNav } from "@/components/AdminNav";

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
      <body className="min-h-screen font-sans text-refx-text antialiased">
        <header className="sticky top-0 z-30 border-b border-refx-soft bg-refx-900/70 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-3">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-refx-blue-glass text-[11px] text-white shadow-refx-glow">
                ◆
              </span>
              <span className="font-semibold tracking-tight text-refx-text2">
                ReFx <span className="text-refx-blueText">PolyPanel</span>
              </span>
              <span className="eyebrow rounded border border-refx-soft px-1.5 py-0.5">
                read-only
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <NavLink href="/">Dashboard</NavLink>
              <NavLink href="/calls">My Calls</NavLink>
              <AdminNav />
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-5 py-5">{children}</main>
      </body>
    </html>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-refx-sm px-3 py-1.5 text-refx-muted transition-colors hover:bg-white/[0.04] hover:text-refx-text"
    >
      {children}
    </Link>
  );
}
