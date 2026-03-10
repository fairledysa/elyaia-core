//src/app/(dashboard)/dashboard/finance/moves/page.tsx

"use client";

import { useEffect, useState } from "react";

type MoveRow = {
  id: string;
  createdAt: string | null;
  employeeName: string | null;
  type: string;
  amount: number;
};

type MovesResponse = {
  ok?: boolean;
  error?: string;
  items?: MoveRow[];
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("ar-SA", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function mapType(type: string) {
  if (type === "stage_earning") return "دخل مرحلة";
  if (type === "bonus") return "مكافأة";
  if (type === "advance") return "سلفة";
  if (type === "deduction") return "خصم";
  if (type === "payout") return "صرف";
  if (type === "salary") return "راتب";
  return type;
}

export default function FinanceMovesPage() {
  const [moves, setMoves] = useState<MoveRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");

  async function loadMoves() {
    setLoading(true);

    const params = new URLSearchParams();

    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (search) params.set("search", search);

    const res = await fetch(`/api/finance/moves?${params.toString()}`, {
      cache: "no-store",
    });

    const json = (await res.json()) as MovesResponse;

    if (json.ok && json.items) {
      setMoves(json.items);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadMoves();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">الحركات المالية</h1>

      <div className="flex gap-3">
        <input
          type="date"
          className="border rounded px-3 py-2"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />

        <input
          type="date"
          className="border rounded px-3 py-2"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />

        <input
          className="border rounded px-3 py-2"
          placeholder="بحث موظف"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <button
          onClick={loadMoves}
          className="bg-black text-white px-4 rounded"
        >
          تصفية
        </button>
      </div>

      <div className="border rounded">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="p-3 text-right">التاريخ</th>
              <th className="text-right">الموظف</th>
              <th className="text-right">النوع</th>
              <th className="text-right">المبلغ</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="p-6 text-center">
                  جاري التحميل...
                </td>
              </tr>
            ) : moves.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center">
                  لا توجد حركات
                </td>
              </tr>
            ) : (
              moves.map((move) => (
                <tr key={move.id} className="border-t">
                  <td className="p-3">{formatDate(move.createdAt)}</td>

                  <td>{move.employeeName || "-"}</td>

                  <td>{mapType(move.type)}</td>

                  <td
                    className={
                      move.amount >= 0
                        ? "text-green-600 font-bold"
                        : "text-red-600 font-bold"
                    }
                  >
                    {move.amount >= 0 ? "+" : ""}
                    {formatMoney(move.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
