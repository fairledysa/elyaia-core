// FILE: src/app/(dashboard)/dashboard/page.tsx

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
    <div className="space-y-6 p-6">
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-2xl font-bold">لوحة التحكم</h1>
            <p className="text-sm text-muted-foreground">
              متابعة الإنتاج والتنبيهات والطلبات الجاهزة والمخزون
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <select
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              className="h-11 rounded-xl border bg-background px-3 text-sm"
            >
              <option value="all">كل المراحل</option>
              {(data?.options?.stages ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>

            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-11 rounded-xl border bg-background px-3 text-sm"
            />

            <button
              type="button"
              onClick={loadData}
              className="h-11 rounded-xl bg-black px-4 text-sm text-white"
            >
              تحديث
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h2 className="text-lg font-bold">الإنتاج</h2>
              <p className="text-sm text-muted-foreground">
                {data?.production?.stageName || "كل المراحل"} • {month}
              </p>
            </div>
            <div className="text-2xl font-bold">
              {loading ? "..." : (data?.production?.total ?? 0)}
            </div>
          </div>

          <div className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data?.production?.series ?? []}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b px-5 py-4">
            <Bell className="h-5 w-5" />
            <div>
              <h2 className="text-lg font-bold">التنبيهات</h2>
              <p className="text-sm text-muted-foreground">
                آخر الأحداث المهمة
              </p>
            </div>
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {(data?.alerts ?? []).length > 0 ? (
              (data?.alerts ?? []).map((item) => (
                <div
                  key={item.id}
                  className="border-b px-5 py-4 last:border-b-0"
                >
                  <div className="text-sm font-medium">{item.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {item.text}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {formatDate(item.createdAt)}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                لا توجد تنبيهات
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b px-5 py-4">
            <PackageCheck className="h-5 w-5" />
            <div>
              <h2 className="text-lg font-bold">الطلبات الجاهزة</h2>
              <p className="text-sm text-muted-foreground">
                الطلبات التي اكتملت عناصرها
              </p>
            </div>
          </div>

          <div className="max-h-[340px] overflow-y-auto">
            {(data?.readyOrders ?? []).length > 0 ? (
              (data?.readyOrders ?? []).map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-4 border-b px-5 py-4 last:border-b-0"
                >
                  <div>
                    <div className="font-medium">
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

                  <div className="rounded-full border px-3 py-1 text-xs">
                    جاهز
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                لا توجد طلبات جاهزة
              </div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b px-5 py-4">
            <PackageOpen className="h-5 w-5" />
            <div>
              <h2 className="text-lg font-bold">تنبيهات المخزون</h2>
              <p className="text-sm text-muted-foreground">
                المواد الأقل من حد التنبيه
              </p>
            </div>
          </div>

          <div className="max-h-[340px] overflow-y-auto">
            {(data?.lowStock ?? []).length > 0 ? (
              (data?.lowStock ?? []).map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-4 border-b px-5 py-4 last:border-b-0"
                >
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      المتبقي: {item.onHand} {item.unit}
                    </div>
                  </div>

                  <div className="text-sm text-red-600">
                    حد التنبيه: {item.reorderLevel}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                لا توجد تنبيهات مخزون
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <Box className="h-5 w-5" />
          <div>
            <h2 className="text-lg font-bold">حركة المخزون</h2>
            <p className="text-sm text-muted-foreground">آخر الحركات المسجلة</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-right">التاريخ</th>
                <th className="px-4 py-3 text-right">المادة</th>
                <th className="px-4 py-3 text-right">الحركة</th>
                <th className="px-4 py-3 text-right">الكمية</th>
                <th className="px-4 py-3 text-right">الملاحظة</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="border-t">
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    جاري التحميل...
                  </td>
                </tr>
              ) : (data?.inventoryMoves ?? []).length > 0 ? (
                (data?.inventoryMoves ?? []).map((item) => (
                  <tr key={item.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-3">{formatDate(item.createdAt)}</td>
                    <td className="px-4 py-3 font-medium">
                      {item.materialName}
                    </td>
                    <td className="px-4 py-3">{item.moveTypeLabel}</td>
                    <td className="px-4 py-3">{item.quantity}</td>
                    <td className="px-4 py-3">{item.note || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr className="border-t">
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    لا توجد حركات مخزون
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
