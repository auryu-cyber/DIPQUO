"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import type { ReactNode } from "react";

const NAV_ITEMS = [
  { href: "/quotes", label: "Quotes" },
  { href: "/quotes/new", label: "New Quote" },
  { href: "/masters", label: "Master Data", adminOnly: true },
  { href: "/logs", label: "Activity Log", adminOnly: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.isAdmin ?? false;
  const initial = session?.user?.name?.[0] ?? session?.user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="flex min-h-screen">
      <div className="w-[220px] shrink-0 bg-knt-navy flex flex-col p-4">
        <div className="flex items-center gap-2.5 px-2 pb-6">
          <svg width="40" height="28" viewBox="0 0 76 52" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="72" height="48" rx="12" stroke="#FFFFFF" strokeWidth="4" />
            <text x="38" y="34" textAnchor="middle" fontFamily="var(--font-quicksand), sans-serif" fontWeight="700" fontSize="24" fill="#FFFFFF">
              KNT
            </text>
          </svg>
          <div className="font-heading text-[13px] font-bold text-white">DIP Quotation System</div>
        </div>

        <nav className="flex flex-col gap-1 mt-2">
          {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
            const active = pathname === item.href || (item.href !== "/quotes" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2.5 rounded-[10px] text-[13px] transition-colors ${
                  active ? "bg-white/[0.18] text-white font-medium" : "text-knt-pale-blue hover:bg-white/10"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2.5 p-2 border-t border-white/10 text-left hover:bg-white/5 rounded-lg"
        >
          <div className="w-[30px] h-[30px] rounded-full bg-knt-blue flex items-center justify-center text-xs font-bold text-white shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <div className="text-xs text-white font-medium truncate">{session?.user?.name ?? session?.user?.email}</div>
            <div className="text-[10px] text-knt-pale-blue">Sign out</div>
          </div>
        </button>
      </div>

      <div className="flex-1 min-w-0 bg-knt-ivory">{children}</div>
    </div>
  );
}
