// FILE: src/components/production/production-shell.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CreditCard,
  Home,
  Loader2,
  QrCode,
  TimerReset,
  UserCircle2,
} from "lucide-react";

type NotificationsCountApiResponse = {
  ok?: boolean;
  error?: string;
  count?: number;
};

function getPageTitle(pathname: string) {
  if (pathname === "/production") return "صفحتي";
  if (pathname === "/production/scan") return "الباركود";
  if (pathname === "/production/timeline") return "الطلبات";
  if (pathname === "/production/wallet") return "المحفظة";
  if (pathname === "/production/profile") return "الحساب";
  if (pathname === "/production/notifications") return "الإشعارات";
  if (pathname === "/production/profile/privacy") return "الخصوصية والأمان";
  return "Production";
}

const navItems = [
  { href: "/production", label: "صفحتي", icon: Home },
  { href: "/production/scan", label: "الباركود", icon: QrCode },
  { href: "/production/timeline", label: "الطلبات", icon: TimerReset },
  { href: "/production/wallet", label: "المحفظة", icon: CreditCard },
];

export function ProductionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  const [notificationsCount, setNotificationsCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const isNotificationsPage = pathname === "/production/notifications";

  useEffect(() => {
    let cancelled = false;

    async function loadNotificationsCount() {
      try {
        setNotificationsLoading(true);

        const res = await fetch("/api/production/notifications/count", {
          method: "GET",
          cache: "no-store",
        });

        const json = (await res
          .json()
          .catch(() => null)) as NotificationsCountApiResponse | null;

        if (!res.ok || !json?.ok) {
          if (!cancelled) {
            setNotificationsCount(0);
          }
          return;
        }

        if (!cancelled) {
          setNotificationsCount(
            typeof json.count === "number" ? json.count : 0,
          );
        }
      } catch {
        if (!cancelled) {
          setNotificationsCount(0);
        }
      } finally {
        if (!cancelled) {
          setNotificationsLoading(false);
        }
      }
    }

    loadNotificationsCount();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const visibleNotificationsCount = useMemo(() => {
    if (isNotificationsPage) return 0;
    return notificationsCount;
  }, [isNotificationsPage, notificationsCount]);

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),_transparent_35%),linear-gradient(180deg,#0b1020_0%,#12182d_35%,#f7f8fc_35%,#f7f8fc_100%)]"
    >
      <div className="mx-auto min-h-screen w-full max-w-md bg-transparent">
        <header className="sticky top-0 z-40">
          <div className="px-4 pt-4">
            <div className="rounded-[28px] border border-white/10 bg-[#0f172a]/90 px-4 py-4 shadow-2xl shadow-black/20 backdrop-blur">
              <div className="flex items-center justify-between">
                <Link
                  href="/production/notifications"
                  className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                >
                  {notificationsLoading && !isNotificationsPage ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Bell className="h-5 w-5" />
                  )}

                  {visibleNotificationsCount > 0 ? (
                    <span className="absolute -left-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                      {visibleNotificationsCount > 99
                        ? "99+"
                        : visibleNotificationsCount}
                    </span>
                  ) : null}
                </Link>

                <div className="text-center text-white">
                  <div className="text-xs text-white/60">Elyaia Production</div>
                  <div className="text-base font-bold">{title}</div>
                </div>

                <Link
                  href="/production/profile"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                >
                  <UserCircle2 className="h-6 w-6" />
                </Link>
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 pb-28 pt-4">{children}</main>

        <nav className="fixed bottom-0 left-0 right-0 z-50">
          <div className="mx-auto w-full max-w-md px-4 pb-4">
            <div className="rounded-[28px] border border-white/10 bg-[#0f172a]/95 px-2 py-2 shadow-2xl shadow-black/25 backdrop-blur">
              <div className="grid grid-cols-4 gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname === item.href ||
                    (item.href !== "/production" &&
                      pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex flex-col items-center justify-center rounded-2xl px-2 py-3 text-xs transition ${
                        active
                          ? "bg-white text-slate-900 shadow-lg"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon className="mb-1 h-5 w-5" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}
