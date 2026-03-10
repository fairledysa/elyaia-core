// FILE: src/app/(dashboard)/dashboard/orders/print-batches/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

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
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      <div className="flex flex-col gap-4 rounded-2xl border bg-white p-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1 text-right">
          <h1 className="text-2xl font-bold">دفعات الطباعة</h1>
          <p className="text-sm text-neutral-500">
            أنشئ دفعة جديدة حسب تاريخ الطباعة، وسيتم ترقيم النسخة تلقائيًا.
          </p>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex flex-col gap-2 text-right">
            <label htmlFor="batchDate" className="text-sm font-medium">
              تاريخ الطباعة
            </label>
            <input
              id="batchDate"
              type="date"
              value={batchDate}
              onChange={(e) => setBatchDate(e.target.value)}
              className="h-10 rounded-xl border px-3 text-sm outline-none"
            />
          </div>

          <button
            type="button"
            onClick={handleCreateBatch}
            disabled={creating}
            className="h-10 rounded-xl bg-black px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {creating ? "جاري الإنشاء..." : "إنشاء دفعة جديدة"}
          </button>

          <button
            type="button"
            onClick={() => loadBatches(batchDate)}
            className="h-10 rounded-xl border px-4 text-sm font-medium"
          >
            تحديث
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4 text-right">
          <div className="text-sm text-neutral-500">عدد الدفعات</div>
          <div className="mt-2 text-2xl font-bold">{rows.length}</div>
        </div>

        <div className="rounded-2xl border bg-white p-4 text-right">
          <div className="text-sm text-neutral-500">إجمالي الطلبات</div>
          <div className="mt-2 text-2xl font-bold">{totalOrders}</div>
        </div>

        <div className="rounded-2xl border bg-white p-4 text-right">
          <div className="text-sm text-neutral-500">إجمالي القطع</div>
          <div className="mt-2 text-2xl font-bold">{totalItems}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white">
        <div className="border-b px-4 py-3 text-right font-semibold">
          دفعات تاريخ {batchDate}
        </div>

        {loading ? (
          <div className="p-6 text-center text-sm text-neutral-500">
            جاري التحميل...
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-neutral-500">
            لا توجد دفعات لهذا التاريخ
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-right text-sm">
              <thead className="bg-neutral-50">
                <tr className="border-b">
                  <th className="px-4 py-3 font-medium">التاريخ</th>
                  <th className="px-4 py-3 font-medium">النسخة</th>
                  <th className="px-4 py-3 font-medium">الحالة</th>
                  <th className="px-4 py-3 font-medium">عدد الطلبات</th>
                  <th className="px-4 py-3 font-medium">عدد القطع</th>
                  <th className="px-4 py-3 font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">{row.batch_date}</td>
                    <td className="px-4 py-3 font-bold">#{row.batch_no}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs">
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{row.total_orders}</td>
                    <td className="px-4 py-3">{row.total_items}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <a
                          href={`/dashboard/orders/print-batches/${row.id}`}
                          className="rounded-lg border px-3 py-2 text-xs font-medium"
                        >
                          فتح
                        </a>
                        <a
                          href={`/dashboard/orders/print-batches/${row.id}`}
                          className="rounded-lg bg-black px-3 py-2 text-xs font-medium text-white"
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
