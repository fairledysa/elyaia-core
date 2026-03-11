// FILE: src/app/(dashboard)/dashboard/finance/employees/[employeeId]/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Wallet,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  HandCoins,
  User,
  CalendarDays,
} from "lucide-react";

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
  if (value === "piece" || value === "piece_rate" || value === "per_piece")
    return "بالقطعة";
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

function StatCard({
  title,
  value,
  icon: Icon,
  color = "",
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="rounded-3xl border border-border/70 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{title}</div>
          <div className={`mt-2 text-3xl font-black ${color}`}>{value}</div>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted/40">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function EmployeeFinancePage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [employee, setEmployee] = useState<any>(null);
  const [moves, setMoves] = useState<any[]>([]);
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
          cache: "no-store",
        }),
        fetch(
          `/api/finance/employees/${finalEmployeeId}/moves?${queryString}`,
          {
            cache: "no-store",
          },
        ),
      ]);

      const employeeJson = await employeeRes.json();
      const movesJson = await movesRes.json();

      if (!employeeRes.ok || !employeeJson?.ok) {
        throw new Error(employeeJson?.error || "FAILED_TO_LOAD_EMPLOYEE");
      }

      if (!movesRes.ok || !movesJson?.ok) {
        throw new Error(movesJson?.error || "FAILED_TO_LOAD_MOVES");
      }

      setEmployee(employeeJson.employee);
      setMoves(movesJson.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "FAILED_TO_LOAD_EMPLOYEE");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (employeeId) loadData(employeeId);
  }, [employeeId]);

  async function submitAction(type: Exclude<ActionType, "">) {
    const amount = Number(actionAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("أدخل مبلغ صحيح");
      return;
    }

    try {
      setActionLoading(true);

      const res = await fetch(`/api/finance/employees/${employeeId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, amount, note: actionNote }),
      });

      const json = await res.json();

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

  return (
    <div dir="rtl" className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between rounded-3xl border border-border/70 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-black">كشف حساب الموظف</h1>
          <p className="text-muted-foreground">
            {employee?.name || "-"} • {employee?.stageName || "-"} •{" "}
            {mapPayType(employee?.payType)} • {mapActive(employee?.active)}
          </p>
        </div>

        <Link
          href="/dashboard/finance"
          className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          رجوع
        </Link>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <StatCard
          title="له"
          value={loading ? "..." : formatMoney(employee?.credit)}
          icon={TrendingUp}
          color="text-green-600"
        />

        <StatCard
          title="عليه"
          value={loading ? "..." : formatMoney(employee?.debit)}
          icon={TrendingDown}
          color="text-red-500"
        />

        <StatCard
          title="المصروف"
          value={loading ? "..." : formatMoney(employee?.payout)}
          icon={HandCoins}
        />

        <StatCard
          title="الرصيد"
          value={loading ? "..." : formatMoney(employee?.balance)}
          icon={Wallet}
          color="text-blue-700"
        />

        <StatCard
          title="المنفذ"
          value={loading ? "..." : String(employee?.completedCount ?? 0)}
          icon={User}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setActionType("advance")}
          className="rounded-2xl bg-blue-600 px-4 py-2 text-white"
        >
          سلفة
        </button>

        <button
          onClick={() => setActionType("deduction")}
          className="rounded-2xl bg-red-600 px-4 py-2 text-white"
        >
          خصم
        </button>

        <button
          onClick={() => setActionType("payout")}
          className="rounded-2xl bg-green-600 px-4 py-2 text-white"
        >
          صرف
        </button>

        <button
          onClick={() => setActionType("bonus")}
          className="rounded-2xl bg-purple-600 px-4 py-2 text-white"
        >
          مكافأة
        </button>

        <button
          onClick={() => setActionType("salary")}
          className="rounded-2xl bg-black px-4 py-2 text-white"
        >
          راتب
        </button>
      </div>

      {/* Action Form */}
      {actionType && (
        <div className="space-y-4 rounded-3xl border bg-muted/20 p-5">
          <div className="text-lg font-bold">{actionTitle(actionType)}</div>

          <div className="flex flex-wrap gap-3">
            <input
              value={actionAmount}
              onChange={(e) => setActionAmount(e.target.value)}
              type="number"
              placeholder="المبلغ"
              className="rounded-2xl border px-3 py-2"
            />

            <input
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              placeholder="ملاحظة"
              className="min-w-[260px] rounded-2xl border px-3 py-2"
            />

            <button
              onClick={() => submitAction(actionType)}
              disabled={actionLoading}
              className="rounded-2xl bg-black px-4 py-2 text-white"
            >
              {actionLoading ? "جاري الحفظ..." : "حفظ"}
            </button>

            <button
              onClick={() => {
                setActionType("");
                setActionAmount("");
                setActionNote("");
              }}
              className="rounded-2xl border px-4 py-2"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          type="date"
          className="rounded-2xl border px-3 py-2"
        />

        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          type="date"
          className="rounded-2xl border px-3 py-2"
        />

        <button
          onClick={() => loadData()}
          className="rounded-2xl bg-black px-4 py-2 text-white"
        >
          تصفية
        </button>
      </div>

      {/* Moves */}
      <div className="overflow-hidden rounded-3xl border border-border/70 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="p-3 text-right">التاريخ</th>
              <th className="text-right">النوع</th>
              <th className="text-right">المبلغ</th>
              <th className="text-right">الوصف</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  className="p-6 text-center text-muted-foreground"
                  colSpan={4}
                >
                  جاري تحميل الحركات...
                </td>
              </tr>
            ) : moves.length > 0 ? (
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
              <tr>
                <td
                  className="p-6 text-center text-muted-foreground"
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
