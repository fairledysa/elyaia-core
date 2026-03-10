// FILE: src/app/(dashboard)/dashboard/finance/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SummaryResponse = {
  ok?: boolean;
  error?: string;
  summary?: {
    totalCredit: number;
    totalDebit: number;
    totalPayout: number;
    balance: number;
    employeeCount: number;
  };
};

type EmployeesResponse = {
  ok?: boolean;
  error?: string;
  items?: Array<{
    employeeId: string;
    userId: string;
    name: string | null;
    phone: string | null;
    stageName: string | null;
    payType: string | null;
    active: boolean | null;
    completedCount: number;
    credit: number;
    debit: number;
    payout: number;
    balance: number;
    lastMoveAt: string | null;
  }>;
};

function formatMoney(value: number | null | undefined) {
  const safe = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("ar-SA", {
    maximumFractionDigits: 2,
  }).format(safe);
}

function mapPayType(value: string | null | undefined) {
  if (!value) return "-";
  if (value === "salary") return "راتب شهري";
  if (value === "piece" || value === "piece_rate" || value === "per_piece")
    return "بالقطعة";
  return value;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function FinancePage() {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [summary, setSummary] = useState<SummaryResponse["summary"] | null>(
    null,
  );
  const [rows, setRows] = useState<EmployeesResponse["items"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params.toString();
  }, [search, from, to]);

  async function loadFinance() {
    try {
      setLoading(true);
      setError(null);

      const [summaryRes, employeesRes] = await Promise.all([
        fetch(`/api/finance/summary?${queryString}`, {
          method: "GET",
          cache: "no-store",
        }),
        fetch(`/api/finance/employees?${queryString}`, {
          method: "GET",
          cache: "no-store",
        }),
      ]);

      const summaryJson = (await summaryRes
        .json()
        .catch(() => null)) as SummaryResponse | null;
      const employeesJson = (await employeesRes
        .json()
        .catch(() => null)) as EmployeesResponse | null;

      if (!summaryRes.ok || !summaryJson?.ok) {
        throw new Error(summaryJson?.error || "FAILED_TO_LOAD_SUMMARY");
      }

      if (!employeesRes.ok || !employeesJson?.ok) {
        throw new Error(employeesJson?.error || "FAILED_TO_LOAD_EMPLOYEES");
      }

      setSummary(summaryJson.summary ?? null);
      setRows(employeesJson.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "FAILED_TO_LOAD_FINANCE");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFinance();
  }, []);

  function handleApplyFilters() {
    loadFinance();
  }

  function handleResetFilters() {
    setSearch("");
    setFrom("");
    setTo("");
    setTimeout(() => {
      const params = new URLSearchParams();
      fetch(`/api/finance/summary?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });
    }, 0);
    setTimeout(loadFinance, 0);
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">المالية</h1>
        <p className="text-muted-foreground">
          إدارة الرواتب والمحافظ والسلف والخصومات والصرف
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded border px-3 py-2"
          placeholder="بحث عامل"
        />
        <input
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          type="date"
          className="rounded border px-3 py-2"
        />
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          type="date"
          className="rounded border px-3 py-2"
        />
        <button
          onClick={handleApplyFilters}
          className="rounded bg-black px-4 py-2 text-white"
          type="button"
        >
          تصفية
        </button>
        <button
          onClick={handleResetFilters}
          className="rounded border px-4 py-2"
          type="button"
        >
          تصفير
        </button>
      </div>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded border p-4">
          <p className="text-sm text-muted-foreground">إجمالي المستحقات</p>
          <h2 className="text-xl font-bold text-green-700">
            {loading ? "..." : `${formatMoney(summary?.totalCredit)} ر.س`}
          </h2>
        </div>

        <div className="rounded border p-4">
          <p className="text-sm text-muted-foreground">السلف والخصومات</p>
          <h2 className="text-xl font-bold text-red-500">
            {loading ? "..." : `${formatMoney(summary?.totalDebit)} ر.س`}
          </h2>
        </div>

        <div className="rounded border p-4">
          <p className="text-sm text-muted-foreground">المصروف</p>
          <h2 className="text-xl font-bold">
            {loading ? "..." : `${formatMoney(summary?.totalPayout)} ر.س`}
          </h2>
        </div>

        <div className="rounded border p-4">
          <p className="text-sm text-muted-foreground">الرصيد المتبقي</p>
          <h2 className="text-xl font-bold text-blue-700">
            {loading ? "..." : `${formatMoney(summary?.balance)} ر.س`}
          </h2>
        </div>

        <div className="rounded border p-4">
          <p className="text-sm text-muted-foreground">عدد الموظفين</p>
          <h2 className="text-xl font-bold">
            {loading ? "..." : (summary?.employeeCount ?? 0)}
          </h2>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-3 text-right">العامل</th>
              <th className="text-right">المرحلة</th>
              <th className="text-right">نوع الدفع</th>
              <th className="text-right">المنفذ</th>
              <th className="text-right">له</th>
              <th className="text-right">عليه</th>
              <th className="text-right">المصروف</th>
              <th className="text-right">الرصيد</th>
              <th className="text-right">آخر حركة</th>
              <th className="text-right"></th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr className="border-t">
                <td
                  className="p-4 text-center text-muted-foreground"
                  colSpan={10}
                >
                  جاري تحميل البيانات...
                </td>
              </tr>
            ) : rows && rows.length > 0 ? (
              rows.map((row) => (
                <tr key={row.employeeId} className="border-t">
                  <td className="p-3 font-medium">{row.name || "-"}</td>
                  <td>{row.stageName || "-"}</td>
                  <td>{mapPayType(row.payType)}</td>
                  <td>{row.completedCount}</td>
                  <td className="text-green-700">{formatMoney(row.credit)}</td>
                  <td className="text-red-600">{formatMoney(row.debit)}</td>
                  <td>{formatMoney(row.payout)}</td>
                  <td className="font-bold text-blue-700">
                    {formatMoney(row.balance)}
                  </td>
                  <td>{formatDate(row.lastMoveAt)}</td>
                  <td>
                    <Link
                      className="text-blue-600 hover:underline"
                      href={`/dashboard/finance/employees/${row.employeeId}`}
                    >
                      كشف الحساب
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr className="border-t">
                <td
                  className="p-4 text-center text-muted-foreground"
                  colSpan={10}
                >
                  لا توجد بيانات
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
