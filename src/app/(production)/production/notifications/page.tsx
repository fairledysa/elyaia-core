// FILE: src/app/(production)/production/notifications/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Gift,
  Loader2,
  PackagePlus,
  Target,
  Wallet,
} from "lucide-react";

type NotificationItem = {
  id: string;
  title: string;
  text: string;
  time: string;
  tone: string;
  type: string;
  readAt?: string | null;
};

type NotificationsApiResponse = {
  ok?: boolean;
  error?: string;
  items?: NotificationItem[];
};

function toneClass(tone: string) {
  if (tone === "violet") return "bg-violet-100 text-violet-700";
  if (tone === "indigo") return "bg-indigo-100 text-indigo-700";
  if (tone === "emerald") return "bg-emerald-100 text-emerald-700";
  if (tone === "amber") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

function toneIcon(type: string) {
  if (type === "new_order") return PackagePlus;
  if (type === "target") return Target;
  if (type === "bonus") return Gift;
  if (type === "wallet") return Wallet;
  return BellRing;
}

export default function ProductionNotificationsPage() {
  const [data, setData] = useState<NotificationsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadNotifications() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/production/notifications", {
        method: "GET",
        cache: "no-store",
      });

      const json = (await res
        .json()
        .catch(() => null)) as NotificationsApiResponse | null;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "FAILED_TO_LOAD_NOTIFICATIONS");
      }

      setData(json);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "FAILED_TO_LOAD_NOTIFICATIONS",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();

    // تعليم الإشعارات كمقروءة
    fetch("/api/production/notifications/read", {
      method: "POST",
    });
  }, []);

  const items = useMemo(() => data?.items ?? [], [data?.items]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="flex items-center gap-3 text-slate-700">
          <Loader2 className="h-5 w-5 animate-spin" />
          جاري تحميل التنبيهات...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="mb-2 text-base font-black text-slate-900">
          تعذر تحميل التنبيهات
        </div>
        <div className="text-sm text-red-600">{error}</div>
        <button
          type="button"
          onClick={loadNotifications}
          className="mt-4 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[30px] bg-[linear-gradient(135deg,#111827,#1e293b,#334155)] p-5 text-white shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-white/70">مركز الإشعارات</div>
            <div className="mt-2 text-2xl font-black">آخر التنبيهات</div>
          </div>

          <div className="rounded-2xl bg-white/10 p-3">
            <BellRing className="h-6 w-6" />
          </div>
        </div>
      </section>

      {items.length === 0 ? (
        <section className="rounded-[26px] bg-white p-6 text-center shadow-sm ring-1 ring-slate-100">
          <div className="font-black text-slate-900">
            لا توجد تنبيهات حالياً
          </div>
          <div className="mt-2 text-sm text-slate-500">
            عندما يدخل طلب جديد أو تتغير محفظتك ستظهر هنا
          </div>
        </section>
      ) : (
        <section className="space-y-3">
          {items.map((item) => {
            const Icon = toneIcon(item.type);

            return (
              <div
                key={item.id}
                className={`rounded-[26px] p-4 shadow-sm ring-1 ${
                  item.readAt
                    ? "bg-white ring-slate-100"
                    : "bg-indigo-50 ring-indigo-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${toneClass(
                      item.tone,
                    )}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="flex-1">
                    <div className="font-black text-slate-900">
                      {item.title}
                    </div>
                    <div className="mt-1 text-sm leading-6 text-slate-600">
                      {item.text}
                    </div>
                    <div className="mt-3 text-xs text-slate-400">
                      {item.time}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
