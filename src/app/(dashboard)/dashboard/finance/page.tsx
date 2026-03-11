// FILE: src/app/(dashboard)/dashboard/finance/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Wallet,
  Search,
  CalendarDays,
  RefreshCcw,
  TrendingUp,
  TrendingDown,
  HandCoins,
  Users,
} from "lucide-react";

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

function StatCard({
  title,
  value,
  icon: Icon,
  valueClassName = "",
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-3xl border border-border/70 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="text-right">
          <div className="text-sm text-muted-foreground">{title}</div>
          <div
            className={`mt-2 text-3xl font-black tracking-tight ${valueClassName}`}
          >
            {value}
          </div>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted/50 text-foreground">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
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
    <div dir="rtl" className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="overflow-hidden rounded-[28px] border border-border/70 bg-white shadow-sm">
        <div className="flex flex-col gap-5 p-5 md:p-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-3 text-right">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" />
              إدارة المحافظ والرواتب والصرف
            </div>

            <div>
              <h1 className="text-2xl font-black tracking-tight md:text-3xl">
                المالية
              </h1>
              <p className="mt-1 text-sm text-muted-foreground md:text-base">
                إدارة الرواتب والمحافظ والسلف والخصومات والصرف ومتابعة أرصدة
                العاملين
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-3xl border border-border/70 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-12 w-full rounded-2xl border border-border/70 bg-background pr-10 pl-3 text-sm outline-none transition focus:border-foreground/30"
              placeholder="بحث عامل"
            />
          </div>

          <div className="relative">
            <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              type="date"
              className="h-12 w-full rounded-2xl border border-border/70 bg-background pr-10 pl-3 text-sm outline-none transition focus:border-foreground/30"
            />
          </div>

          <div className="relative">
            <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              type="date"
              className="h-12 w-full rounded-2xl border border-border/70 bg-background pr-10 pl-3 text-sm outline-none transition focus:border-foreground/30"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleApplyFilters}
              className="h-12 flex-1 rounded-2xl bg-black px-4 text-sm font-medium text-white transition hover:opacity-90"
              type="button"
            >
              تصفية
            </button>

            <button
              onClick={handleResetFilters}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-border/70 bg-white px-4 text-sm font-medium transition hover:bg-muted/40"
              type="button"
            >
              <RefreshCcw className="h-4 w-4" />
              تصفير
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="إجمالي المستحقات"
          value={loading ? "..." : `${formatMoney(summary?.totalCredit)} ر.س`}
          icon={TrendingUp}
          valueClassName="text-emerald-700"
        />

        <StatCard
          title="السلف والخصومات"
          value={loading ? "..." : `${formatMoney(summary?.totalDebit)} ر.س`}
          icon={TrendingDown}
          valueClassName="text-red-600"
        />

        <StatCard
          title="المصروف"
          value={loading ? "..." : `${formatMoney(summary?.totalPayout)} ر.س`}
          icon={HandCoins}
        />

        <StatCard
          title="الرصيد المتبقي"
          value={loading ? "..." : `${formatMoney(summary?.balance)} ر.س`}
          icon={Wallet}
          valueClassName="text-blue-700"
        />

        <StatCard
          title="عدد الموظفين"
          value={loading ? "..." : String(summary?.employeeCount ?? 0)}
          icon={Users}
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-3xl border border-border/70 bg-white shadow-sm">
        <div className="border-b border-border/60 px-5 py-4">
          <div className="text-lg font-bold">ملخص حسابات الموظفين</div>
          <div className="mt-1 text-sm text-muted-foreground">
            كشف سريع لمستحقات العاملين والخصومات والمصروف والأرصدة
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-muted/30">
              <tr className="border-b border-border/60">
                <th className="p-3 text-right font-semibold">العامل</th>
                <th className="p-3 text-right font-semibold">المرحلة</th>
                <th className="p-3 text-right font-semibold">نوع الدفع</th>
                <th className="p-3 text-right font-semibold">المنفذ</th>
                <th className="p-3 text-right font-semibold">له</th>
                <th className="p-3 text-right font-semibold">عليه</th>
                <th className="p-3 text-right font-semibold">المصروف</th>
                <th className="p-3 text-right font-semibold">الرصيد</th>
                <th className="p-3 text-right font-semibold">آخر حركة</th>
                <th className="p-3 text-right font-semibold"></th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr className="border-t border-border/60">
                  <td
                    className="p-6 text-center text-muted-foreground"
                    colSpan={10}
                  >
                    جاري تحميل البيانات...
                  </td>
                </tr>
              ) : rows && rows.length > 0 ? (
                rows.map((row) => (
                  <tr
                    key={row.employeeId}
                    className="border-t border-border/60 transition hover:bg-muted/10"
                  >
                    <td className="p-3 font-medium">{row.name || "-"}</td>
                    <td className="p-3">{row.stageName || "-"}</td>
                    <td className="p-3">{mapPayType(row.payType)}</td>
                    <td className="p-3">{row.completedCount}</td>
                    <td className="p-3 font-medium text-emerald-700">
                      {formatMoney(row.credit)}
                    </td>
                    <td className="p-3 font-medium text-red-600">
                      {formatMoney(row.debit)}
                    </td>
                    <td className="p-3">{formatMoney(row.payout)}</td>
                    <td className="p-3 font-bold text-blue-700">
                      {formatMoney(row.balance)}
                    </td>
                    <td className="p-3">{formatDate(row.lastMoveAt)}</td>
                    <td className="p-3">
                      <Link
                        className="font-medium text-blue-600 hover:underline"
                        href={`/dashboard/finance/employees/${row.employeeId}`}
                      >
                        كشف الحساب
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-border/60">
                  <td
                    className="p-6 text-center text-muted-foreground"
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
    </div>
  );
}
