// FILE: src/app/(dashboard)/dashboard/finance/reports/page.tsx
"use client";

import { useEffect, useState } from "react";

type ReportEmployeeRow = {
  employeeId: string;
  name: string | null;
  stageName: string | null;
  credit: number;
  debit: number;
  payout: number;
  balance: number;
};

type FinanceReportResponse = {
  ok?: boolean;
  error?: string;
  report?: {
    totals: {
      totalCredit: number;
      totalDebit: number;
      totalPayout: number;
      balance: number;
    };
    employees: ReportEmployeeRow[];
  };
};

function formatMoney(value: number | null | undefined) {
  const safe = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("ar-SA", {
    maximumFractionDigits: 2,
  }).format(safe);
}

export default function FinanceReportsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [report, setReport] = useState<FinanceReportResponse["report"] | null>(
    null,
  );

  async function loadReport() {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await fetch(`/api/finance/reports?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const json = (await res
        .json()
        .catch(() => null)) as FinanceReportResponse | null;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "FAILED_TO_LOAD_REPORT");
      }

      setReport(json.report ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "FAILED_TO_LOAD_REPORT");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">التقارير المالية</h1>
        <p className="text-muted-foreground">
          تقرير المستحقات والسلف والخصومات والصرف حسب الفترة
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="date"
          className="rounded border px-3 py-2"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input
          type="date"
          className="rounded border px-3 py-2"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <button
          className="rounded bg-black px-4 py-2 text-white"
          type="button"
          onClick={loadReport}
        >
          إنشاء التقرير
        </button>
      </div>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded border p-4">
          <p className="text-sm text-muted-foreground">
            دخل المراحل والمستحقات
          </p>
          <h2 className="text-xl font-bold text-green-700">
            {loading ? "..." : formatMoney(report?.totals.totalCredit)} ر.س
          </h2>
        </div>

        <div className="rounded border p-4">
          <p className="text-sm text-muted-foreground">السلف والخصومات</p>
          <h2 className="text-xl font-bold text-red-600">
            {loading ? "..." : formatMoney(report?.totals.totalDebit)} ر.س
          </h2>
        </div>

        <div className="rounded border p-4">
          <p className="text-sm text-muted-foreground">المصروف</p>
          <h2 className="text-xl font-bold">
            {loading ? "..." : formatMoney(report?.totals.totalPayout)} ر.س
          </h2>
        </div>

        <div className="rounded border p-4">
          <p className="text-sm text-muted-foreground">الصافي</p>
          <h2 className="text-xl font-bold text-blue-700">
            {loading ? "..." : formatMoney(report?.totals.balance)} ر.س
          </h2>
        </div>
      </div>

      <div className="overflow-hidden rounded border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-3 text-right">الموظف</th>
              <th className="text-right">المرحلة</th>
              <th className="text-right">له</th>
              <th className="text-right">عليه</th>
              <th className="text-right">المصروف</th>
              <th className="text-right">الصافي</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr className="border-t">
                <td
                  colSpan={6}
                  className="p-6 text-center text-muted-foreground"
                >
                  جاري تحميل التقرير...
                </td>
              </tr>
            ) : report?.employees && report.employees.length > 0 ? (
              report.employees.map((row) => (
                <tr key={row.employeeId} className="border-t">
                  <td className="p-3 font-medium">{row.name || "-"}</td>
                  <td>{row.stageName || "-"}</td>
                  <td className="text-green-700">{formatMoney(row.credit)}</td>
                  <td className="text-red-600">{formatMoney(row.debit)}</td>
                  <td>{formatMoney(row.payout)}</td>
                  <td className="font-bold text-blue-700">
                    {formatMoney(row.balance)}
                  </td>
                </tr>
              ))
            ) : (
              <tr className="border-t">
                <td
                  colSpan={6}
                  className="p-6 text-center text-muted-foreground"
                >
                  لا توجد بيانات في هذه الفترة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
