// FILE: src/components/inventory/inventory-moves-client.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Download,
  Loader2,
  Printer,
  Boxes,
  TrendingDown,
  TrendingUp,
  Scale,
  SlidersHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type InventoryMoveApiRow = {
  id: string;
  material_id: string;
  material_name: string | null;
  material_unit: string | null;
  stage_event_id: string | null;
  quantity: number;
  move_type: string;
  direction: "in" | "out" | "neutral";
  unit_cost: number | null;
  total_cost: number | null;
  note: string | null;
  running_balance: number | null;
  created_at: string;
  created_by: { id: string; name: string } | null;
  user: { id: string; name: string } | null;
  meta: {
    source: string | null;
    created_from: string | null;
    reason: string | null;
    order_id: string | null;
    order_number: string | null;
    production_item_id: string | null;
    quantity_index: number | null;
    salla_item_id: string | null;
    sku: string | null;
    product_name: string | null;
    stage_id: string | null;
    stage_name: string | null;
    employee_id: string | null;
    employee_user_id: string | null;
    employee_name: string | null;
  };
};

type MaterialOption = {
  id: string;
  name: string;
  unit: string | null;
};

type ExecutorOption = {
  id: string;
  name: string;
};

type MovesResponse = {
  ok: boolean;
  items: InventoryMoveApiRow[];
  materials: MaterialOption[];
  executors: ExecutorOption[];
};

type DirectionFilter = "all" | "in" | "out";

type ColumnVisibility = {
  date: boolean;
  material: boolean;
  unit: boolean;
  move: boolean;
  direction: boolean;
  quantity: boolean;
  balance: boolean;
  cost: boolean;
  value: boolean;
  executor: boolean;
  user: boolean;
  stage: boolean;
  sku: boolean;
  order: boolean;
  piece: boolean;
  note: boolean;
};

const defaultColumns: ColumnVisibility = {
  date: true,
  material: true,
  unit: true,
  move: true,
  direction: true,
  quantity: true,
  balance: true,
  cost: true,
  value: true,
  executor: true,
  user: false,
  stage: false,
  sku: false,
  order: false,
  piece: false,
  note: true,
};

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const txt = await res.text();
  if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
  return JSON.parse(txt) as T;
}

function unitLabel(unit: string | null | undefined) {
  switch ((unit || "").toLowerCase()) {
    case "m":
    case "meter":
    case "meters":
      return "متر";
    case "pcs":
    case "piece":
    case "pieces":
      return "قطعة";
    case "roll":
    case "rolls":
      return "لفة";
    default:
      return unit || "—";
  }
}

function formatMoney(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("ar-SA", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatQty(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("ar-SA", {
    maximumFractionDigits: 3,
  }).format(Number(value || 0));
}

function moveTypeLabel(moveType: string) {
  switch (moveType) {
    case "purchase_in":
      return "شراء";
    case "manual_add":
      return "إضافة يدوية";
    case "manual_remove":
      return "سحب يدوي";
    case "adjustment":
      return "تسوية";
    case "return_in":
      return "مرتجع";
    case "production_deduct":
      return "خصم إنتاج";
    default:
      return moveType || "—";
  }
}

function directionLabel(direction: "in" | "out" | "neutral") {
  switch (direction) {
    case "in":
      return "مدخل";
    case "out":
      return "مخرج";
    default:
      return "—";
  }
}

function directionBadgeClass(direction: "in" | "out" | "neutral") {
  switch (direction) {
    case "in":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200";
    case "out":
      return "bg-red-50 text-red-700 border border-red-200";
    default:
      return "bg-slate-100 text-slate-700 border border-slate-200";
  }
}

function buildCsv(rows: InventoryMoveApiRow[], columns: ColumnVisibility) {
  const selectedHeaders: string[] = [];
  const selectedValues: ((r: InventoryMoveApiRow) => string)[] = [];

  if (columns.date) {
    selectedHeaders.push("التاريخ");
    selectedValues.push((r) => new Date(r.created_at).toLocaleString("ar-SA"));
  }
  if (columns.material) {
    selectedHeaders.push("القماش");
    selectedValues.push((r) => r.material_name || "—");
  }
  if (columns.unit) {
    selectedHeaders.push("الوحدة");
    selectedValues.push((r) => unitLabel(r.material_unit));
  }
  if (columns.move) {
    selectedHeaders.push("الحركة");
    selectedValues.push((r) => moveTypeLabel(r.move_type));
  }
  if (columns.direction) {
    selectedHeaders.push("الاتجاه");
    selectedValues.push((r) => directionLabel(r.direction));
  }
  if (columns.quantity) {
    selectedHeaders.push("الكمية");
    selectedValues.push((r) => formatQty(r.quantity));
  }
  if (columns.balance) {
    selectedHeaders.push("المتبقي");
    selectedValues.push((r) => formatQty(r.running_balance));
  }
  if (columns.cost) {
    selectedHeaders.push("التكلفة");
    selectedValues.push((r) => formatMoney(r.unit_cost));
  }
  if (columns.value) {
    selectedHeaders.push("القيمة");
    selectedValues.push((r) => formatMoney(r.total_cost));
  }
  if (columns.executor) {
    selectedHeaders.push("المنفذ");
    selectedValues.push((r) => r.created_by?.name || "—");
  }
  if (columns.user) {
    selectedHeaders.push("المستخدم");
    selectedValues.push((r) => r.meta.employee_name || r.user?.name || "—");
  }
  if (columns.stage) {
    selectedHeaders.push("المرحلة");
    selectedValues.push((r) => r.meta.stage_name || "—");
  }
  if (columns.sku) {
    selectedHeaders.push("SKU");
    selectedValues.push((r) => r.meta.sku || "—");
  }
  if (columns.order) {
    selectedHeaders.push("الطلب");
    selectedValues.push((r) => r.meta.order_number || "—");
  }
  if (columns.piece) {
    selectedHeaders.push("القطعة");
    selectedValues.push((r) =>
      r.meta.quantity_index == null ? "—" : `#${r.meta.quantity_index}`,
    );
  }
  if (columns.note) {
    selectedHeaders.push("ملاحظة");
    selectedValues.push((r) => r.note || "—");
  }

  const escape = (value: unknown) => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };

  const lines = rows.map((r) =>
    selectedValues.map((getter) => escape(getter(r))).join(","),
  );

  return (
    "\uFEFF" + [selectedHeaders.map(escape).join(","), ...lines].join("\n")
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <Card className="rounded-3xl border-border/70 shadow-sm print-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="text-right">
            <div className="text-sm text-muted-foreground">{title}</div>
            <div className="mt-2 text-3xl font-black tracking-tight">
              {value}
            </div>
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted/50 text-foreground">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function InventoryMovesClient() {
  const [loading, setLoading] = useState(true);
  const [moves, setMoves] = useState<InventoryMoveApiRow[]>([]);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [executors, setExecutors] = useState<ExecutorOption[]>([]);
  const [materialId, setMaterialId] = useState("all");
  const [executorId, setExecutorId] = useState("all");
  const [directionFilter, setDirectionFilter] =
    useState<DirectionFilter>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [columns, setColumns] = useState<ColumnVisibility>(defaultColumns);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("limit", "500");

      if (materialId !== "all") params.set("material_id", materialId);
      if (executorId !== "all") params.set("created_by", executorId);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const res = await j<MovesResponse>(
        `/api/inventory/moves?${params.toString()}`,
      );

      setMoves(Array.isArray(res.items) ? res.items : []);
      setMaterials(Array.isArray(res.materials) ? res.materials : []);
      setExecutors(Array.isArray(res.executors) ? res.executors : []);
    } catch (e: any) {
      setError(e?.message || "تعذر تحميل التقرير");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredMoves = useMemo(() => {
    return moves.filter((row) => {
      if (directionFilter === "in" && row.direction !== "in") return false;
      if (directionFilter === "out" && row.direction !== "out") return false;
      return true;
    });
  }, [moves, directionFilter]);

  const summary = useMemo(() => {
    const totalIn = filteredMoves
      .filter((r) => r.direction === "in")
      .reduce((sum, r) => sum + Math.abs(Number(r.quantity || 0)), 0);

    const totalOut = filteredMoves
      .filter((r) => r.direction === "out")
      .reduce((sum, r) => sum + Math.abs(Number(r.quantity || 0)), 0);

    const latestBalance =
      filteredMoves.length > 0 && filteredMoves[0]?.running_balance != null
        ? Number(filteredMoves[0].running_balance)
        : 0;

    return {
      totalIn,
      totalOut,
      latestBalance,
    };
  }, [filteredMoves]);

  function handlePrint() {
    window.print();
  }

  function handleExportCsv() {
    const csv = buildCsv(filteredMoves, columns);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory-moves.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div dir="rtl" className="space-y-6 print:space-y-2">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }

          html,
          body {
            background: white !important;
          }

          aside,
          nav,
          header,
          .print-hidden {
            display: none !important;
          }

          .print-page-title {
            display: block !important;
            margin-bottom: 8px !important;
          }

          .print-page-title h1 {
            font-size: 18px !important;
            margin: 0 0 4px 0 !important;
          }

          .print-page-title p {
            font-size: 11px !important;
            margin: 0 !important;
            color: #444 !important;
          }

          .print-summary-cards {
            display: none !important;
          }

          .print-summary-text {
            display: block !important;
            margin: 6px 0 10px 0 !important;
            padding: 0 !important;
            border: 0 !important;
          }

          .print-summary-text .row {
            display: flex !important;
            gap: 18px !important;
            flex-wrap: wrap !important;
            font-size: 12px !important;
            margin-bottom: 6px !important;
          }

          .print-summary-text .item {
            display: inline-flex !important;
            gap: 6px !important;
            align-items: baseline !important;
          }

          .print-summary-text .label {
            color: #444 !important;
            font-weight: 600 !important;
          }

          .print-summary-text .value {
            color: #000 !important;
            font-weight: 700 !important;
          }

          .print-filter-box {
            box-shadow: none !important;
            border: 0 !important;
            padding: 0 !important;
            margin-bottom: 4px !important;
          }

          .print-filter-title {
            display: block !important;
            font-size: 12px !important;
            font-weight: 700 !important;
            margin-bottom: 4px !important;
          }

          .print-filter-line {
            display: block !important;
            font-size: 11px !important;
            color: #444 !important;
            margin-bottom: 6px !important;
          }

          .print-card {
            box-shadow: none !important;
            border: 0 !important;
          }

          .print-table-wrap {
            overflow: visible !important;
            border: 0 !important;
            border-radius: 0 !important;
          }

          .print-table {
            min-width: 100% !important;
            width: 100% !important;
            font-size: 10px !important;
            border-collapse: collapse !important;
          }

          .print-table th,
          .print-table td {
            white-space: nowrap !important;
            padding: 4px 6px !important;
            border-bottom: 1px solid #ddd !important;
          }

          .print-table thead th {
            background: #f3f4f6 !important;
          }

          .print-direction-badge {
            border: 1px solid #bbb !important;
            background: transparent !important;
            color: #000 !important;
            padding: 1px 6px !important;
          }

          footer,
          .site-footer {
            display: none !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="print-hidden overflow-hidden rounded-[28px] border border-border/70 bg-white shadow-sm">
        <div className="flex flex-col gap-5 p-5 md:p-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-3 text-right">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
              <Boxes className="h-3.5 w-3.5" />
              تقرير شامل لحركة الأقمشة
            </div>

            <div>
              <h1 className="text-2xl font-black tracking-tight md:text-3xl">
                حركات المخزون
              </h1>
              <p className="mt-1 text-sm text-muted-foreground md:text-base">
                متابعة حركة الأقمشة دخولًا وخروجًا مع الطباعة والتصدير
              </p>
            </div>
          </div>

          <Button
            asChild
            variant="outline"
            className="h-11 rounded-2xl border-border/70"
          >
            <Link href="/dashboard/inventory" className="gap-2">
              <ArrowRight className="h-4 w-4" />
              الرجوع
            </Link>
          </Button>
        </div>
      </div>

      <div className="print-page-title hidden">
        <h1>تقرير حركة المخزون</h1>
        <p>تقرير حركة الأقمشة دخولًا وخروجًا</p>
      </div>

      {/* Filters */}
      <Card className="print-card print-filter-box rounded-3xl border-border/70 shadow-sm">
        <CardHeader className="pb-2 print:hidden">
          <CardTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="h-4 w-4" />
            فلاتر التقرير
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4 print:p-0">
          <div className="print-hidden grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div>
              <div className="mb-2 text-sm font-medium">نوع الحركة</div>
              <Select
                value={directionFilter}
                onValueChange={(value: DirectionFilter) =>
                  setDirectionFilter(value)
                }
              >
                <SelectTrigger className="h-11 rounded-2xl border-border/70">
                  <SelectValue placeholder="نوع الحركة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="in">مدخل</SelectItem>
                  <SelectItem value="out">مخرج</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="mb-2 text-sm font-medium">القماش</div>
              <Select value={materialId} onValueChange={setMaterialId}>
                <SelectTrigger className="h-11 rounded-2xl border-border/70">
                  <SelectValue placeholder="اختر القماش" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {materials.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="mb-2 text-sm font-medium">المنفذ</div>
              <Select value={executorId} onValueChange={setExecutorId}>
                <SelectTrigger className="h-11 rounded-2xl border-border/70">
                  <SelectValue placeholder="اختر المنفذ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {executors.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="mb-2 text-sm font-medium">من تاريخ</div>
              <Input
                type="date"
                className="h-11 rounded-2xl border-border/70"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            <div>
              <div className="mb-2 text-sm font-medium">إلى تاريخ</div>
              <Input
                type="date"
                className="h-11 rounded-2xl border-border/70"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button
                className="h-11 w-full rounded-2xl"
                onClick={load}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                ) : null}
                عرض التقرير
              </Button>
            </div>
          </div>

          <div className="print-filter-title hidden">فلاتر التقرير</div>
          <div className="print-filter-line hidden">
            نوع الحركة:{" "}
            {directionFilter === "all"
              ? "الكل"
              : directionFilter === "in"
                ? "مدخل"
                : "مخرج"}{" "}
            | القماش:{" "}
            {materialId === "all"
              ? "الكل"
              : materials.find((m) => m.id === materialId)?.name || "—"}{" "}
            | المنفذ:{" "}
            {executorId === "all"
              ? "الكل"
              : executors.find((e) => e.id === executorId)?.name || "—"}{" "}
            | من: {fromDate || "—"} | إلى: {toDate || "—"}
          </div>

          <div className="print-hidden flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              className="h-11 rounded-2xl gap-2 border-border/70"
              onClick={handleExportCsv}
            >
              <Download className="h-4 w-4" />
              Excel
            </Button>

            <Button
              variant="outline"
              className="h-11 rounded-2xl gap-2 border-border/70"
              onClick={handlePrint}
            >
              <Printer className="h-4 w-4" />
              طباعة
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-11 rounded-2xl gap-2 border-border/70"
                >
                  الأعمدة
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56 text-right">
                <DropdownMenuCheckboxItem
                  checked={columns.date}
                  onCheckedChange={(checked) =>
                    setColumns((prev) => ({ ...prev, date: !!checked }))
                  }
                >
                  التاريخ
                </DropdownMenuCheckboxItem>

                <DropdownMenuCheckboxItem
                  checked={columns.material}
                  onCheckedChange={(checked) =>
                    setColumns((prev) => ({ ...prev, material: !!checked }))
                  }
                >
                  القماش
                </DropdownMenuCheckboxItem>

                <DropdownMenuCheckboxItem
                  checked={columns.unit}
                  onCheckedChange={(checked) =>
                    setColumns((prev) => ({ ...prev, unit: !!checked }))
                  }
                >
                  الوحدة
                </DropdownMenuCheckboxItem>

                <DropdownMenuCheckboxItem
                  checked={columns.move}
                  onCheckedChange={(checked) =>
                    setColumns((prev) => ({ ...prev, move: !!checked }))
                  }
                >
                  الحركة
                </DropdownMenuCheckboxItem>

                <DropdownMenuCheckboxItem
                  checked={columns.direction}
                  onCheckedChange={(checked) =>
                    setColumns((prev) => ({ ...prev, direction: !!checked }))
                  }
                >
                  الاتجاه
                </DropdownMenuCheckboxItem>

                <DropdownMenuCheckboxItem
                  checked={columns.quantity}
                  onCheckedChange={(checked) =>
                    setColumns((prev) => ({ ...prev, quantity: !!checked }))
                  }
                >
                  الكمية
                </DropdownMenuCheckboxItem>

                <DropdownMenuCheckboxItem
                  checked={columns.balance}
                  onCheckedChange={(checked) =>
                    setColumns((prev) => ({ ...prev, balance: !!checked }))
                  }
                >
                  المتبقي
                </DropdownMenuCheckboxItem>

                <DropdownMenuCheckboxItem
                  checked={columns.cost}
                  onCheckedChange={(checked) =>
                    setColumns((prev) => ({ ...prev, cost: !!checked }))
                  }
                >
                  التكلفة
                </DropdownMenuCheckboxItem>

                <DropdownMenuCheckboxItem
                  checked={columns.value}
                  onCheckedChange={(checked) =>
                    setColumns((prev) => ({ ...prev, value: !!checked }))
                  }
                >
                  القيمة
                </DropdownMenuCheckboxItem>

                <DropdownMenuCheckboxItem
                  checked={columns.executor}
                  onCheckedChange={(checked) =>
                    setColumns((prev) => ({ ...prev, executor: !!checked }))
                  }
                >
                  المنفذ
                </DropdownMenuCheckboxItem>

                <DropdownMenuCheckboxItem
                  checked={columns.user}
                  onCheckedChange={(checked) =>
                    setColumns((prev) => ({ ...prev, user: !!checked }))
                  }
                >
                  المستخدم
                </DropdownMenuCheckboxItem>

                <DropdownMenuCheckboxItem
                  checked={columns.stage}
                  onCheckedChange={(checked) =>
                    setColumns((prev) => ({ ...prev, stage: !!checked }))
                  }
                >
                  المرحلة
                </DropdownMenuCheckboxItem>

                <DropdownMenuCheckboxItem
                  checked={columns.sku}
                  onCheckedChange={(checked) =>
                    setColumns((prev) => ({ ...prev, sku: !!checked }))
                  }
                >
                  SKU
                </DropdownMenuCheckboxItem>

                <DropdownMenuCheckboxItem
                  checked={columns.order}
                  onCheckedChange={(checked) =>
                    setColumns((prev) => ({ ...prev, order: !!checked }))
                  }
                >
                  الطلب
                </DropdownMenuCheckboxItem>

                <DropdownMenuCheckboxItem
                  checked={columns.piece}
                  onCheckedChange={(checked) =>
                    setColumns((prev) => ({ ...prev, piece: !!checked }))
                  }
                >
                  القطعة
                </DropdownMenuCheckboxItem>

                <DropdownMenuCheckboxItem
                  checked={columns.note}
                  onCheckedChange={(checked) =>
                    setColumns((prev) => ({ ...prev, note: !!checked }))
                  }
                >
                  ملاحظة
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="print-hidden print-summary-cards grid gap-4 md:grid-cols-3">
        <StatCard
          title="إجمالي المدخل"
          value={formatQty(summary.totalIn)}
          icon={TrendingUp}
        />
        <StatCard
          title="إجمالي المخرج"
          value={formatQty(summary.totalOut)}
          icon={TrendingDown}
        />
        <StatCard
          title="الرصيد النهائي"
          value={formatQty(summary.latestBalance)}
          icon={Scale}
        />
      </div>

      <div className="print-summary-text hidden">
        <div className="row">
          <div className="item">
            <span className="label">إجمالي المدخل:</span>
            <span className="value">{formatQty(summary.totalIn)}</span>
          </div>
          <div className="item">
            <span className="label">إجمالي المخرج:</span>
            <span className="value">{formatQty(summary.totalOut)}</span>
          </div>
          <div className="item">
            <span className="label">الرصيد النهائي:</span>
            <span className="value">{formatQty(summary.latestBalance)}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <Card className="print-card overflow-hidden rounded-3xl border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">سجل الحركات</CardTitle>
        </CardHeader>

        <CardContent className="print:p-0">
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري التحميل...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : (
            <div className="print-table-wrap overflow-auto rounded-2xl border border-border/70">
              <table className="print-table w-full min-w-[1200px] text-sm">
                <thead className="bg-muted/30">
                  <tr className="border-b border-border/60">
                    {columns.date && (
                      <th className="p-3 text-center font-semibold">التاريخ</th>
                    )}
                    {columns.material && (
                      <th className="p-3 text-right font-semibold">القماش</th>
                    )}
                    {columns.unit && (
                      <th className="p-3 text-center font-semibold">الوحدة</th>
                    )}
                    {columns.move && (
                      <th className="p-3 text-center font-semibold">الحركة</th>
                    )}
                    {columns.direction && (
                      <th className="p-3 text-center font-semibold">الاتجاه</th>
                    )}
                    {columns.quantity && (
                      <th className="p-3 text-center font-semibold">الكمية</th>
                    )}
                    {columns.balance && (
                      <th className="p-3 text-center font-semibold">المتبقي</th>
                    )}
                    {columns.cost && (
                      <th className="p-3 text-center font-semibold">التكلفة</th>
                    )}
                    {columns.value && (
                      <th className="p-3 text-center font-semibold">القيمة</th>
                    )}
                    {columns.executor && (
                      <th className="p-3 text-right font-semibold">المنفذ</th>
                    )}
                    {columns.user && (
                      <th className="p-3 text-right font-semibold">المستخدم</th>
                    )}
                    {columns.stage && (
                      <th className="p-3 text-right font-semibold">المرحلة</th>
                    )}
                    {columns.sku && (
                      <th className="p-3 text-right font-semibold">SKU</th>
                    )}
                    {columns.order && (
                      <th className="p-3 text-right font-semibold">الطلب</th>
                    )}
                    {columns.piece && (
                      <th className="p-3 text-right font-semibold">القطعة</th>
                    )}
                    {columns.note && (
                      <th className="p-3 text-right font-semibold">ملاحظة</th>
                    )}
                  </tr>
                </thead>

                <tbody>
                  {filteredMoves.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-border/60 align-top transition hover:bg-muted/10"
                    >
                      {columns.date && (
                        <td className="whitespace-nowrap p-3 text-center">
                          {new Date(r.created_at).toLocaleString("ar-SA")}
                        </td>
                      )}

                      {columns.material && (
                        <td className="p-3">
                          <div className="font-medium">
                            {r.material_name || "—"}
                          </div>
                        </td>
                      )}

                      {columns.unit && (
                        <td className="p-3 text-center">
                          {unitLabel(r.material_unit)}
                        </td>
                      )}

                      {columns.move && (
                        <td className="p-3 text-center">
                          {moveTypeLabel(r.move_type)}
                        </td>
                      )}

                      {columns.direction && (
                        <td className="p-3 text-center">
                          <span
                            className={`print-direction-badge inline-flex rounded-full px-3 py-1 text-xs font-medium ${directionBadgeClass(
                              r.direction,
                            )}`}
                          >
                            {directionLabel(r.direction)}
                          </span>
                        </td>
                      )}

                      {columns.quantity && (
                        <td className="p-3 text-center">
                          {formatQty(r.quantity)}
                        </td>
                      )}

                      {columns.balance && (
                        <td className="p-3 text-center">
                          {formatQty(r.running_balance)}
                        </td>
                      )}

                      {columns.cost && (
                        <td className="p-3 text-center">
                          {formatMoney(r.unit_cost)}
                        </td>
                      )}

                      {columns.value && (
                        <td className="p-3 text-center">
                          {formatMoney(r.total_cost)}
                        </td>
                      )}

                      {columns.executor && (
                        <td className="p-3">{r.created_by?.name || "—"}</td>
                      )}

                      {columns.user && (
                        <td className="p-3">
                          {r.meta.employee_name || r.user?.name || "—"}
                        </td>
                      )}

                      {columns.stage && (
                        <td className="p-3">{r.meta.stage_name || "—"}</td>
                      )}

                      {columns.sku && (
                        <td className="p-3">{r.meta.sku || "—"}</td>
                      )}

                      {columns.order && (
                        <td className="p-3">{r.meta.order_number || "—"}</td>
                      )}

                      {columns.piece && (
                        <td className="p-3">
                          {r.meta.quantity_index == null
                            ? "—"
                            : `#${r.meta.quantity_index}`}
                        </td>
                      )}

                      {columns.note && <td className="p-3">{r.note || "—"}</td>}
                    </tr>
                  ))}

                  {!filteredMoves.length ? (
                    <tr>
                      <td
                        className="p-10 text-center text-sm text-muted-foreground"
                        colSpan={16}
                      >
                        لا توجد حركات.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
