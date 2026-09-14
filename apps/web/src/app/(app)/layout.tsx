"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { roleAtLeast } from "@doculedger/shared";

const NAV = [
  { href: "/dashboard", label: "Dashboard", minRole: "MEMBER" as const },
  { href: "/documents", label: "Documents", minRole: "MEMBER" as const },
  { href: "/review", label: "Review queue", minRole: "REVIEWER" as const },
  { href: "/settings/schemas", label: "Schemas", minRole: "MEMBER" as const },
  { href: "/settings/users", label: "Users", minRole: "ADMIN" as const },
  { href: "/settings/api-keys", label: "API keys", minRole: "ADMIN" as const },
  { href: "/settings/audit-log", label: "Audit log", minRole: "ADMIN" as const },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Loading&hellip;</div>;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-lg font-semibold text-brand-700">DocuLedger</p>
          <p className="truncate text-xs text-slate-500">{user.organization?.name}</p>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.filter((item) => roleAtLeast(user.role, item.minRole)).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                pathname?.startsWith(item.href) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-200 px-5 py-4">
          <p className="truncate text-sm font-medium text-slate-800">{user.name}</p>
          <p className="truncate text-xs text-slate-500">
            {user.email} &middot; {user.role}
          </p>
          <button onClick={logout} className="mt-3 text-xs font-medium text-brand-600 hover:underline">
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
