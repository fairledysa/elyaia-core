// FILE: src/app/(production)/production/timeline/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, Layers3, PackageOpen, Sparkles, Loader2 } from "lucide-react";

type TimelineApiResponse = {
  ok?: boolean;
  error?: string;
  stage?: {
    id: string;
    name: string;
    sortOrder: number;
  } | null;
  currentOrder?: {
    orderId: string;
    orderNumber: string;
    stageName: string;
    totalPieces: number;
    completedPieces: number;
    remainingPieces: number;
    status: string;
  } | null;
  newOrders?: Array<{
    orderId: string;
    orderNumber: string;
    newPieces: number;
    customerName: string | null;
    message: string;
  }>;
  timeline?: Array<{
    type: string;
    title: string;
    subtitle: string;
    time: string;
  }>;
};

export default function ProductionTimelinePage() {
  const [data, setData] = useState<TimelineApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadTimeline() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/production/timeline", {
        method: "GET",
        cache: "no-store",
      });

      const json = (await res
        .json()
        .catch(() => null)) as TimelineApiResponse | null;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "FAILED_TO_LOAD_TIMELINE");
      }

      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "FAILED_TO_LOAD_TIMELINE");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTimeline();
  }, []);

  const currentOrder = data?.currentOrder ?? null;
  const newOrders = useMemo(() => data?.newOrders ?? [], [data?.newOrders]);
  const timelineItems = useMemo(() => data?.timeline ?? [], [data?.timeline]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="flex items-center gap-3 text-slate-700">
          <Loader2 className="h-5 w-5 animate-spin" />
          جاري تحميل التايم لاين...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="mb-2 text-base font-black text-slate-900">
          تعذر تحميل الصفحة
        </div>
        <div className="text-sm text-red-600">{error}</div>
        <button
          type="button"
          onClick={loadTimeline}
          className="mt-4 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] bg-[linear-gradient(135deg,#111827,#0f766e,#0f172a)] p-5 text-white shadow-2xl shadow-emerald-950/10">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-white/60">الطلب الحالي</div>
            <div className="mt-1 text-2xl font-black">
              {currentOrder?.orderNumber || "-"}
            </div>
            <div className="mt-2 text-sm text-white/75">
              {currentOrder
                ? `${currentOrder.totalPieces} قطع في مرحلة ${currentOrder.stageName || data?.stage?.name || "-"}`
                : `لا يوجد طلب نشط حاليًا${data?.stage?.name ? ` في مرحلة ${data.stage.name}` : ""}`}
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 p-3">
            <PackageOpen className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-white/10 p-3">
            <div className="text-xs text-white/60">المنفذ</div>
            <div className="mt-1 text-lg font-black">
              {currentOrder?.completedPieces ?? 0}
            </div>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <div className="text-xs text-white/60">المتبقي</div>
            <div className="mt-1 text-lg font-black">
              {currentOrder?.remainingPieces ?? 0}
            </div>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <div className="text-xs text-white/60">الحالة</div>
            <div className="mt-1 text-sm font-black">
              {currentOrder?.status || "لا يوجد"}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-base font-black text-slate-900">يوجد جديد</div>
            <div className="text-xs text-slate-500">
              إشارات سريعة للأعمال الجديدة في مرحلتك
            </div>
          </div>

          <div className="rounded-2xl bg-violet-50 p-3 text-violet-600">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>

        {newOrders.length === 0 ? (
          <div className="rounded-[24px] border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
            لا يوجد طلبات جديدة في مرحلتك الآن
          </div>
        ) : (
          <div className="space-y-3">
            {newOrders.map((item) => (
              <div
                key={item.orderId}
                className="rounded-[24px] border border-violet-100 bg-[linear-gradient(135deg,#faf5ff,#eef2ff)] p-4"
              >
                <div className="mb-2 inline-flex rounded-full bg-violet-600 px-3 py-1 text-xs font-bold text-white">
                  طلب جديد متاح
                </div>
                <div className="text-lg font-black text-slate-900">
                  {item.orderNumber}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {item.message}
                </div>
                {item.customerName ? (
                  <div className="mt-2 text-xs text-slate-500">
                    العميل: {item.customerName}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-base font-black text-slate-900">التايم لاين</div>
          <div className="rounded-2xl bg-slate-100 p-3 text-slate-600">
            <Layers3 className="h-5 w-5" />
          </div>
        </div>

        {timelineItems.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            لا توجد أحداث حتى الآن
          </div>
        ) : (
          <div className="space-y-4">
            {timelineItems.map((item, index) => (
              <div
                key={`${item.title}-${index}`}
                className="relative flex gap-3"
              >
                <div className="relative mt-1 flex flex-col items-center">
                  <div className="h-3.5 w-3.5 rounded-full bg-[linear-gradient(135deg,#1d4ed8,#7c3aed)]" />
                  {index !== timelineItems.length - 1 ? (
                    <div className="mt-1 h-full w-px bg-slate-200" />
                  ) : null}
                </div>

                <div className="flex-1 rounded-2xl bg-slate-50 p-4">
                  <div className="font-bold text-slate-900">{item.title}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    {item.subtitle}
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    {item.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
