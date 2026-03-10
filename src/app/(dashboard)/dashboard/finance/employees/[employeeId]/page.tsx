// FILE: src/app/(dashboard)/dashboard/finance/employees/[employeeId]/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type EmployeeDetailsResponse = {
  ok?: boolean;
  error?: string;
  employee?: {
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
  };
};

type EmployeeMovesResponse = {
  ok?: boolean;
  error?: string;
  items?: Array<{
    id: string;
    createdAt: string | null;
    type: string;
    amount: number;
    direction: "plus" | "minus";
    label: string;
    note: string;
  }>;
};

type ActionType = "advance" | "deduction" | "payout" | "bonus" | "salary" | "";

function formatMoney(value: number | null | undefined) {
  const safe = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("ar-SA", {
    maximumFractionDigits: 2,
  }).format(safe);
}

function mapPayType(value: string | null | undefined) {
  if (!value) return "-";
  if (value === "salary") return "راتب شهري";
  if (value === "piece" || value === "piece_rate" || value === "per_piece") {
    return "بالقطعة";
  }
  return value;
}

function mapActive(value: boolean | null | undefined) {
  if (value === true) return "نشط";
  if (value === false) return "غير نشط";
  return "-";
}

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

function mapMoveLabel(type: string) {
  if (type === "stage_earning") return "دخل مرحلة";
  if (type === "bonus") return "مكافأة";
  if (type === "advance") return "سلفة";
  if (type === "deduction") return "خصم";
  if (type === "payout") return "صرف";
  if (type === "salary") return "راتب";
  if (type === "adjustment") return "تسوية";
  return type || "-";
}

function actionTitle(type: ActionType) {
  if (type === "advance") return "سلفة";
  if (type === "deduction") return "خصم";
  if (type === "payout") return "صرف";
  if (type === "bonus") return "مكافأة";
  if (type === "salary") return "راتب";
  return "حركة مالية";
}

export default function EmployeeFinancePage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [employee, setEmployee] = useState<NonNullable<
    EmployeeDetailsResponse["employee"]
  > | null>(null);
  const [moves, setMoves] = useState<EmployeeMovesResponse["items"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [actionType, setActionType] = useState<ActionType>("");
  const [actionAmount, setActionAmount] = useState("");
  const [actionNote, setActionNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    params.then((p) => setEmployeeId(p.employeeId));
  }, [params]);

  const queryString = useMemo(() => {
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    return query.toString();
  }, [from, to]);

  async function loadData(targetEmployeeId?: string) {
    const finalEmployeeId = targetEmployeeId || employeeId;
    if (!finalEmployeeId) return;

    try {
      setLoading(true);
      setError(null);

      const [employeeRes, movesRes] = await Promise.all([
        fetch(`/api/finance/employees/${finalEmployeeId}`, {
          method: "GET",
          cache: "no-store",
        }),
        fetch(
          `/api/finance/employees/${finalEmployeeId}/moves?${queryString}`,
          {
            method: "GET",
            cache: "no-store",
          },
        ),
      ]);

      const employeeJson = (await employeeRes
        .json()
        .catch(() => null)) as EmployeeDetailsResponse | null;

      const movesJson = (await movesRes
        .json()
        .catch(() => null)) as EmployeeMovesResponse | null;

      if (!employeeRes.ok || !employeeJson?.ok) {
        throw new Error(employeeJson?.error || "FAILED_TO_LOAD_EMPLOYEE");
      }

      if (!movesRes.ok || !movesJson?.ok) {
        throw new Error(movesJson?.error || "FAILED_TO_LOAD_MOVES");
      }

      setEmployee(employeeJson.employee || null);
      setMoves(movesJson.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "FAILED_TO_LOAD_EMPLOYEE");
    } finally {
      setLoading(false);
    }
  }

  async function submitAction(type: Exclude<ActionType, "">) {
    if (!employeeId) return;

    const amount = Number(actionAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("أدخل مبلغ صحيح");
      return;
    }

    try {
      setActionLoading(true);
      setError(null);

      const res = await fetch(`/api/finance/employees/${employeeId}/actions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          amount,
          note: actionNote,
        }),
      });

      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "FAILED_TO_CREATE_ACTION");
      }

      setActionType("");
      setActionAmount("");
      setActionNote("");
      await loadData(employeeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "FAILED_TO_CREATE_ACTION");
    } finally {
      setActionLoading(false);
    }
  }

  useEffect(() => {
    if (employeeId) {
      loadData(employeeId);
    }
  }, [employeeId]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">كشف حساب الموظف</h1>
          <p className="text-muted-foreground">
            {employee?.name || "-"} • {employee?.stageName || "-"} •{" "}
            {mapPayType(employee?.payType)} • {mapActive(employee?.active)}
          </p>
        </div>

        <Link
          href="/dashboard/finance"
          className="rounded border px-4 py-2 text-sm"
        >
          رجوع
        </Link>
      </div>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded border p-4">
          <p className="text-sm text-muted-foreground">له</p>
          <h2 className="text-xl font-bold text-green-600">
            {loading ? "..." : formatMoney(employee?.credit)}
          </h2>
        </div>

        <div className="rounded border p-4">
          <p className="text-sm text-muted-foreground">عليه</p>
          <h2 className="text-xl font-bold text-red-500">
            {loading ? "..." : formatMoney(employee?.debit)}
          </h2>
        </div>

        <div className="rounded border p-4">
          <p className="text-sm text-muted-foreground">المصروف</p>
          <h2 className="text-xl font-bold">
            {loading ? "..." : formatMoney(employee?.payout)}
          </h2>
        </div>

        <div className="rounded border p-4">
          <p className="text-sm text-muted-foreground">الرصيد</p>
          <h2 className="text-xl font-bold text-blue-700">
            {loading ? "..." : formatMoney(employee?.balance)}
          </h2>
        </div>

        <div className="rounded border p-4">
          <p className="text-sm text-muted-foreground">المنفذ</p>
          <h2 className="text-xl font-bold">
            {loading ? "..." : (employee?.completedCount ?? 0)}
          </h2>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          className="rounded bg-blue-600 px-4 py-2 text-white"
          type="button"
          onClick={() => setActionType("advance")}
        >
          سلفة
        </button>

        <button
          className="rounded bg-red-600 px-4 py-2 text-white"
          type="button"
          onClick={() => setActionType("deduction")}
        >
          خصم
        </button>

        <button
          className="rounded bg-green-600 px-4 py-2 text-white"
          type="button"
          onClick={() => setActionType("payout")}
        >
          صرف
        </button>

        <button
          className="rounded bg-purple-600 px-4 py-2 text-white"
          type="button"
          onClick={() => setActionType("bonus")}
        >
          مكافأة
        </button>

        <button
          className="rounded bg-slate-800 px-4 py-2 text-white"
          type="button"
          onClick={() => setActionType("salary")}
        >
          راتب
        </button>
      </div>

      {actionType ? (
        <div className="space-y-4 rounded border bg-slate-50 p-4">
          <div className="text-lg font-bold">{actionTitle(actionType)}</div>

          <div className="flex flex-wrap gap-3">
            <input
              value={actionAmount}
              onChange={(e) => setActionAmount(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder="المبلغ"
              className="rounded border px-3 py-2"
            />

            <input
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              type="text"
              placeholder="ملاحظة"
              className="min-w-[260px] rounded border px-3 py-2"
            />

            <button
              onClick={() => submitAction(actionType)}
              className="rounded bg-black px-4 py-2 text-white"
              type="button"
              disabled={actionLoading}
            >
              {actionLoading ? "جاري الحفظ..." : "حفظ"}
            </button>

            <button
              onClick={() => {
                setActionType("");
                setActionAmount("");
                setActionNote("");
              }}
              className="rounded border px-4 py-2"
              type="button"
            >
              إلغاء
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
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
          onClick={() => loadData()}
          className="rounded bg-black px-4 py-2 text-white"
          type="button"
        >
          تصفية
        </button>
      </div>

      <div className="overflow-hidden rounded border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-3 text-right">التاريخ</th>
              <th className="text-right">النوع</th>
              <th className="text-right">المبلغ</th>
              <th className="text-right">الوصف</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr className="border-t">
                <td
                  className="p-4 text-center text-muted-foreground"
                  colSpan={4}
                >
                  جاري تحميل الحركات...
                </td>
              </tr>
            ) : moves && moves.length > 0 ? (
              moves.map((move) => (
                <tr key={move.id} className="border-t">
                  <td className="p-3">{formatDate(move.createdAt)}</td>
                  <td>{move.label || mapMoveLabel(move.type)}</td>
                  <td
                    className={
                      move.direction === "plus"
                        ? "font-bold text-green-600"
                        : "font-bold text-red-600"
                    }
                  >
                    {move.direction === "plus" ? "+" : "-"}
                    {formatMoney(Math.abs(move.amount))}
                  </td>
                  <td>{move.note || "-"}</td>
                </tr>
              ))
            ) : (
              <tr className="border-t">
                <td
                  className="p-4 text-center text-muted-foreground"
                  colSpan={4}
                >
                  لا توجد حركات
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
