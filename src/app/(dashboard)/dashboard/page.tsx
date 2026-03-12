// FILE: src/app/(dashboard)/dashboard/page.tsx
// redeploy test
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Bell,
  Box,
  CalendarDays,
  PackageCheck,
  PackageOpen,
  Filter,
  TrendingUp,
} from "lucide-react";

type ApiResponse = {
  ok?: boolean;
  error?: string;
  filters?: {
    stageId: string;
    month: string;
  };
  options?: {
    stages: Array<{
      id: string;
      name: string;
    }>;
  };
  production?: {
    total: number;
    stageName: string;
    series: Array<{
      day: number;
      label: string;
      value: number;
    }>;
  };
  alerts?: Array<{
    id: string;
    kind: string;
    title: string;
    text: string;
    createdAt: string | null;
  }>;
  lowStock?: Array<{
    id: string;
    name: string;
    onHand: number;
    reorderLevel: number;
    unit: string;
  }>;
  inventoryMoves?: Array<{
    id: string;
    materialName: string;
    quantity: number;
    moveType: string;
    moveTypeLabel: string;
    note: string | null;
    createdAt: string | null;
  }>;
  readyOrders?: Array<{
    id: string;
    orderNumber: string | null;
    customerName: string | null;
    customerPhone: string | null;
    customerCity: string | null;
    status: string | null;
    createdAt: string | null;
  }>;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(
    2,
    "0",
  )}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function defaultMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function SectionCard({
  title,
  subtitle,
  icon: Icon,
  children,
  rightSlot,
}: {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-border/70 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted/60 text-foreground">
            <Icon className="h-5 w-5" />
          </div>

          <div className="text-right">
            <h2 className="text-base font-bold md:text-lg">{title}</h2>
            {subtitle ? (
              <p className="text-xs text-muted-foreground md:text-sm">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        {rightSlot}
      </div>

      {children}
    </div>
  );
}

export default function Page() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stageId, setStageId] = useState("all");
  const [month, setMonth] = useState(defaultMonthValue());

  const queryString = useMemo(() => {
    const query = new URLSearchParams();
    if (stageId && stageId !== "all") query.set("stageId", stageId);
    if (month) query.set("month", month);
    return query.toString();
  }, [stageId, month]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/dashboard/overview?${queryString}`, {
        method: "GET",
        cache: "no-store",
      });

      const json = (await res.json().catch(() => null)) as ApiResponse | null;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "FAILED_TO_LOAD_DASHBOARD");
      }

      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "FAILED_TO_LOAD_DASHBOARD");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadData();
  }, [queryString]);

  return (
    <div dir="rtl" className="space-y-6 p-4 md:p-6">
      {/* HERO */}
      <div className="overflow-hidden rounded-[28px] border border-border/70 bg-white shadow-sm">
        <div className="flex flex-col gap-5 p-5 md:p-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              متابعة تشغيل المصنع والإنتاج
            </div>

            <div>
              <h1 className="text-2xl font-black tracking-tight md:text-3xl">
                لوحة التحكم
              </h1>
              <p className="mt-1 text-sm text-muted-foreground md:text-base">
                متابعة الإنتاج والتنبيهات والطلبات الجاهزة وحركة المخزون في
                واجهة واحدة
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3 xl:min-w-[700px]">
            <div className="relative">
              <Filter className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                className="h-12 w-full rounded-2xl border border-border/70 bg-background pr-10 pl-3 text-sm outline-none transition focus:border-foreground/30"
              >
                <option value="all">كل المراحل</option>
                {(data?.options?.stages ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="h-12 w-full rounded-2xl border border-border/70 bg-background pr-10 pl-3 text-sm outline-none transition focus:border-foreground/30"
              />
            </div>

            <button
              type="button"
              onClick={loadData}
              className="h-12 rounded-2xl bg-black px-4 text-sm font-medium text-white transition hover:opacity-90"
            >
              {loading ? "جاري التحديث..." : "تحديث البيانات"}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* TOP GRID */}
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <SectionCard
          title="الإنتاج"
          subtitle={`${data?.production?.stageName || "كل المراحل"} • ${month}`}
          icon={BarChart}
          rightSlot={
            <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-2 text-center">
              <div className="text-xs text-muted-foreground">الإجمالي</div>
              <div className="text-xl font-black md:text-2xl">
                {loading ? "..." : (data?.production?.total ?? 0)}
              </div>
            </div>
          }
        >
          <div className="p-3 md:p-4">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={data?.production?.series ?? []}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="التنبيهات"
          subtitle="آخر الأحداث المهمة"
          icon={Bell}
        >
          <div className="max-h-[380px] overflow-y-auto">
            {(data?.alerts ?? []).length > 0 ? (
              (data?.alerts ?? []).map((item) => (
                <div
                  key={item.id}
                  className="border-b border-border/60 px-5 py-4 last:border-b-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold">{item.title}</div>
                      <div className="mt-1 text-sm leading-6 text-muted-foreground">
                        {item.text}
                      </div>
                    </div>

                    <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />
                  </div>

                  <div className="mt-2 text-xs text-muted-foreground">
                    {formatDate(item.createdAt)}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                لا توجد تنبيهات
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* MIDDLE GRID */}
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="الطلبات الجاهزة"
          subtitle="الطلبات التي اكتملت عناصرها"
          icon={PackageCheck}
        >
          <div className="max-h-[360px] overflow-y-auto">
            {(data?.readyOrders ?? []).length > 0 ? (
              (data?.readyOrders ?? []).map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-4 border-b border-border/60 px-5 py-4 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">
                      {item.customerName || "بدون اسم"}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      طلب #{item.orderNumber || "-"} •{" "}
                      {item.customerCity || "-"}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDate(item.createdAt)}
                    </div>
                  </div>

                  <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    جاهز
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                لا توجد طلبات جاهزة
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="تنبيهات المخزون"
          subtitle="المواد الأقل من حد التنبيه"
          icon={PackageOpen}
        >
          <div className="max-h-[360px] overflow-y-auto">
            {(data?.lowStock ?? []).length > 0 ? (
              (data?.lowStock ?? []).map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-4 border-b border-border/60 px-5 py-4 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">{item.name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      المتبقي: {item.onHand} {item.unit}
                    </div>
                  </div>

                  <div className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                    حد التنبيه: {item.reorderLevel}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                لا توجد تنبيهات مخزون
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* TABLE */}
      <SectionCard
        title="حركة المخزون"
        subtitle="آخر الحركات المسجلة"
        icon={Box}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/40">
              <tr className="border-b border-border/60">
                <th className="px-4 py-3 text-right font-semibold">التاريخ</th>
                <th className="px-4 py-3 text-right font-semibold">المادة</th>
                <th className="px-4 py-3 text-right font-semibold">الحركة</th>
                <th className="px-4 py-3 text-right font-semibold">الكمية</th>
                <th className="px-4 py-3 text-right font-semibold">الملاحظة</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr className="border-t border-border/60">
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    جاري التحميل...
                  </td>
                </tr>
              ) : (data?.inventoryMoves ?? []).length > 0 ? (
                (data?.inventoryMoves ?? []).map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-border/60 transition hover:bg-muted/20"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {item.materialName}
                    </td>
                    <td className="px-4 py-3">{item.moveTypeLabel}</td>
                    <td className="px-4 py-3">{item.quantity}</td>
                    <td className="px-4 py-3">{item.note || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-border/60">
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    لا توجد حركات مخزون
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
