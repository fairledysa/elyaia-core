// FILE: src/app/(dashboard)/dashboard/orders/print-batches/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Printer,
  RefreshCw,
  FileStack,
  Package2,
  Boxes,
} from "lucide-react";

type PrintBatchRow = {
  id: string;
  batch_date: string;
  batch_no: number;
  status: string;
  total_orders: number;
  total_items: number;
  created_at: string;
};

function todayLocalDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-3xl border border-border/70 bg-white p-5 text-right shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">{title}</div>
          <div className="mt-2 text-3xl font-black tracking-tight">{value}</div>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted/50 text-foreground">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function PrintBatchesPage() {
  const [batchDate, setBatchDate] = useState(todayLocalDate());
  const [rows, setRows] = useState<PrintBatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadBatches(date: string) {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `/api/print-batches?batchDate=${encodeURIComponent(date)}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "FAILED_TO_LOAD_BATCHES");
      }

      setRows(Array.isArray(json?.batches) ? json.batches : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "INTERNAL_ERROR");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBatches(batchDate);
  }, [batchDate]);

  async function handleCreateBatch() {
    try {
      setCreating(true);
      setError(null);

      const res = await fetch("/api/print-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchDate }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "FAILED_TO_CREATE_BATCH");
      }

      await loadBatches(batchDate);

      if (json?.batch?.id) {
        window.location.href = `/dashboard/orders/print-batches/${json.batch.id}`;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "INTERNAL_ERROR");
    } finally {
      setCreating(false);
    }
  }

  const totalOrders = useMemo(
    () => rows.reduce((sum, row) => sum + (row.total_orders || 0), 0),
    [rows],
  );

  const totalItems = useMemo(
    () => rows.reduce((sum, row) => sum + (row.total_items || 0), 0),
    [rows],
  );

  return (
    <div dir="rtl" className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="overflow-hidden rounded-[28px] border border-border/70 bg-white shadow-sm">
        <div className="flex flex-col gap-5 p-5 md:p-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-3 text-right">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
              <Printer className="h-3.5 w-3.5" />
              إدارة دفعات الطباعة اليومية
            </div>

            <div>
              <h1 className="text-2xl font-black tracking-tight md:text-3xl">
                دفعات الطباعة
              </h1>
              <p className="mt-1 text-sm text-muted-foreground md:text-base">
                أنشئ دفعة جديدة حسب تاريخ الطباعة، وسيتم ترقيم النسخة تلقائيًا
                وعرض جميع الدفعات الخاصة بنفس اليوم
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[220px_160px_140px]">
            <div className="flex flex-col gap-2 text-right">
              <label htmlFor="batchDate" className="text-sm font-medium">
                تاريخ الطباعة
              </label>

              <div className="relative">
                <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="batchDate"
                  type="date"
                  value={batchDate}
                  onChange={(e) => setBatchDate(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-border/70 bg-background pr-10 pl-3 text-sm outline-none transition focus:border-foreground/30"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateBatch}
              disabled={creating}
              className="h-12 self-end rounded-2xl bg-black px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {creating ? "جاري الإنشاء..." : "إنشاء دفعة جديدة"}
            </button>

            <button
              type="button"
              onClick={() => loadBatches(batchDate)}
              className="flex h-12 items-center justify-center gap-2 self-end rounded-2xl border border-border/70 bg-white px-4 text-sm font-medium transition hover:bg-muted/40"
            >
              <RefreshCw className="h-4 w-4" />
              تحديث
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="عدد الدفعات" value={rows.length} icon={FileStack} />
        <StatCard title="إجمالي الطلبات" value={totalOrders} icon={Package2} />
        <StatCard title="إجمالي القطع" value={totalItems} icon={Boxes} />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-3xl border border-border/70 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div className="text-right">
            <div className="text-lg font-bold">دفعات تاريخ {batchDate}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              عرض جميع النسخ التي تم إنشاؤها لهذا اليوم
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {rows.length} دفعة
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            جاري التحميل...
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            لا توجد دفعات لهذا التاريخ
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-right text-sm">
              <thead className="bg-muted/30">
                <tr className="border-b border-border/60">
                  <th className="px-4 py-3 font-semibold">التاريخ</th>
                  <th className="px-4 py-3 font-semibold">النسخة</th>
                  <th className="px-4 py-3 font-semibold">الحالة</th>
                  <th className="px-4 py-3 font-semibold">عدد الطلبات</th>
                  <th className="px-4 py-3 font-semibold">عدد القطع</th>
                  <th className="px-4 py-3 font-semibold">إجراءات</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/60 transition last:border-b-0 hover:bg-muted/20"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.batch_date}
                    </td>

                    <td className="px-4 py-3 font-black">#{row.batch_no}</td>

                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full border border-border/70 bg-muted/50 px-3 py-1 text-xs font-medium">
                        {row.status}
                      </span>
                    </td>

                    <td className="px-4 py-3">{row.total_orders}</td>
                    <td className="px-4 py-3">{row.total_items}</td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <a
                          href={`/dashboard/orders/print-batches/${row.id}`}
                          className="rounded-xl border border-border/70 px-3 py-2 text-xs font-medium transition hover:bg-muted/40"
                        >
                          فتح
                        </a>

                        <a
                          href={`/dashboard/orders/print-batches/${row.id}`}
                          className="rounded-xl bg-black px-3 py-2 text-xs font-medium text-white transition hover:opacity-90"
                        >
                          طباعة
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
