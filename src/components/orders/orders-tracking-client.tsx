// FILE: src/components/orders/orders-tracking-client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Search,
  PackageCheck,
  TimerReset,
  Clock3,
  CheckCircle2,
  ScanLine,
  ChevronRight,
  ChevronLeft,
  CalendarRange,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

type StageCell = {
  stageId: string;
  stageName: string;
  state: "done" | "pending";
  doneCount: number;
  totalItems: number;
  firstAt: string | null;
  lastAt: string | null;
  workerName: string | null;
};

type TrackingRow = {
  productionItemId: string;
  qrCode: string;
  pieceNo: number;
  orderId: string;
  orderNumber: string | null;
  sallaOrderId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerCity: string | null;
  batchId: string | null;
  batchNo: number | null;
  batchDate: string | null;
  batchStatus: string | null;
  trackingStatus: "not_started" | "in_progress" | "completed";
  currentStageName: string;
  currentStageAt: string | null;
  printedAt: string | null;
  productName: string | null;
  sku: string | null;
  stageCells: StageCell[];
};

type TrackingStage = {
  id: string;
  name: string;
  sortOrder: number;
};

type TrackingResponse = {
  ok: boolean;
  error?: string;
  stats: {
    totalPrinted: number;
    notStarted: number;
    inProgress: number;
    completed: number;
    totalStages: number;
  };
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  stages: TrackingStage[];
  rows: TrackingRow[];
};

type FilterKey =
  | "all"
  | "not_started"
  | "in_progress"
  | "completed"
  | `stage:${string}`;

type ModeKey = "active" | "completed" | "activity";

function fmtDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

function TrackingStatusBadge({
  status,
}: {
  status: TrackingRow["trackingStatus"];
}) {
  if (status === "completed") {
    return <Badge className="rounded-full bg-emerald-600">منجز</Badge>;
  }

  if (status === "in_progress") {
    return (
      <Badge variant="secondary" className="rounded-full">
        تحت التنفيذ
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="rounded-full">
      طلبات جديدة
    </Badge>
  );
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
    <Card className="rounded-3xl border-border/70 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-right">
            <div className="text-sm text-muted-foreground">{title}</div>
            <div className="mt-2 text-3xl font-black tracking-tight">
              {value}
            </div>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/40 text-foreground">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StageTimeline({
  row,
  stages,
}: {
  row: TrackingRow;
  stages: TrackingStage[];
}) {
  const currentStageId =
    stages.find((s) => s.name === row.currentStageName)?.id || null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {stages.map((stage, index) => {
        const cell = row.stageCells.find((x) => x.stageId === stage.id);
        const isDone = !!cell && cell.state === "done";
        const isCurrent =
          row.trackingStatus !== "completed" &&
          row.trackingStatus !== "not_started" &&
          currentStageId === stage.id &&
          !isDone;

        return (
          <div key={stage.id} className="flex items-center gap-2">
            <HoverCard openDelay={120}>
              <HoverCardTrigger asChild>
                <div
                  className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-medium ${
                    isDone
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : isCurrent
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-border/70 bg-muted/20 text-muted-foreground"
                  }`}
                >
                  <span className="font-semibold">{stage.name}</span>
                  <span
                    className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                      isDone
                        ? "bg-emerald-100 text-emerald-700"
                        : isCurrent
                          ? "bg-amber-100 text-amber-700"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isDone ? "✓" : isCurrent ? "•" : "—"}
                  </span>
                </div>
              </HoverCardTrigger>

              <HoverCardContent className="w-72 text-right">
                <div className="space-y-2">
                  <div className="text-sm font-bold">{stage.name}</div>

                  {isDone ? (
                    <>
                      <div className="text-xs text-muted-foreground">
                        الحالة: مكتملة
                      </div>
                      <div className="text-xs text-muted-foreground">
                        التوقيت: {fmtDate(cell?.firstAt || null)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        العامل: {cell?.workerName || "—"}
                      </div>
                    </>
                  ) : isCurrent ? (
                    <>
                      <div className="text-xs text-muted-foreground">
                        الحالة: المرحلة الحالية
                      </div>
                      <div className="text-xs text-muted-foreground">
                        آخر حركة: {fmtDate(row.currentStageAt)}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      الحالة: لم يتم البدء
                    </div>
                  )}
                </div>
              </HoverCardContent>
            </HoverCard>

            {index < stages.length - 1 ? (
              <span className="text-muted-foreground">—</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function OrdersTrackingClient() {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<TrackingResponse | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterKey>("all");
  const [mode, setMode] = useState<ModeKey>("active");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      params.set("mode", mode);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const url = `/api/orders/tracking?${params.toString()}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = (await res.json()) as TrackingResponse;

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "فشل تحميل التتبع");
      }

      setPayload(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      load();
    }, 250);

    return () => clearTimeout(t);
  }, [q, mode, from, to, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [q, statusFilter, pageSize, mode, from, to]);

  const rows = payload?.rows || [];
  const stages = payload?.stages || [];
  const stats = payload?.stats || {
    totalPrinted: 0,
    notStarted: 0,
    inProgress: 0,
    completed: 0,
    totalStages: 0,
  };

  const pagination = payload?.pagination || {
    page,
    pageSize,
    total: rows.length,
    totalPages: rows.length ? 1 : 0,
  };

  const stageCounts = useMemo(() => {
    const map = new Map<string, number>();

    for (const stage of stages) {
      map.set(stage.id, 0);
    }

    for (const row of rows) {
      if (row.trackingStatus !== "in_progress") continue;
      const currentStage = stages.find((s) => s.name === row.currentStageName);
      if (currentStage) {
        map.set(currentStage.id, (map.get(currentStage.id) || 0) + 1);
      }
    }

    return map;
  }, [rows, stages]);

  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return rows;

    if (statusFilter === "not_started") {
      return rows.filter((row) => row.trackingStatus === "not_started");
    }

    if (statusFilter === "in_progress") {
      return rows.filter((row) => row.trackingStatus === "in_progress");
    }

    if (statusFilter === "completed") {
      return rows.filter((row) => row.trackingStatus === "completed");
    }

    if (statusFilter.startsWith("stage:")) {
      const stageId = statusFilter.replace("stage:", "");
      const stage = stages.find((s) => s.id === stageId);
      if (!stage) return rows;

      return rows.filter(
        (row) =>
          row.trackingStatus === "in_progress" &&
          row.currentStageName === stage.name,
      );
    }

    return rows;
  }, [rows, statusFilter, stages]);

  const filterCards = useMemo(() => {
    const base = [
      {
        key: "all" as FilterKey,
        label: "الكل",
        count: rows.length,
      },
      {
        key: "not_started" as FilterKey,
        label: "طلبات جديدة",
        count: rows.filter((x) => x.trackingStatus === "not_started").length,
      },
      {
        key: "in_progress" as FilterKey,
        label: "تحت التنفيذ",
        count: rows.filter((x) => x.trackingStatus === "in_progress").length,
      },
      {
        key: "completed" as FilterKey,
        label: "تم الإنجاز",
        count: rows.filter((x) => x.trackingStatus === "completed").length,
      },
    ];

    const stageFilters = stages.map((stage) => ({
      key: `stage:${stage.id}` as FilterKey,
      label: stage.name,
      count: stageCounts.get(stage.id) || 0,
    }));

    return [...base, ...stageFilters];
  }, [rows, stages, stageCounts]);

  const currentPage = pagination.page || page;
  const totalPages = pagination.totalPages || 0;

  return (
    <div dir="rtl" className="space-y-6">
      <div className="overflow-hidden rounded-[28px] border border-border/70 bg-white shadow-sm">
        <div className="flex flex-col gap-5 p-5 md:p-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-3 text-right">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
              <ScanLine className="h-3.5 w-3.5" />
              تتبع القطع بعد الطباعة والتسليم للإنتاج
            </div>

            <div>
              <h1 className="text-2xl font-black tracking-tight md:text-3xl">
                تتبع الإنتاج
              </h1>
              <p className="mt-1 text-sm text-muted-foreground md:text-base">
                عرض كل قطعة بشكل مستقل مع رقم القطعة والمرحلة الحالية وسير
                المراحل بشكل مرتب
              </p>
            </div>
          </div>

          <div className="w-full xl:w-[320px]">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="بحث برقم الطلب أو العميل أو QR أو SKU"
                className="h-12 rounded-2xl border-border/70 pr-10"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="إجمالي المطبوعة"
          value={stats.totalPrinted}
          icon={PackageCheck}
        />
        <StatCard
          title="طلبات جديدة"
          value={stats.notStarted}
          icon={TimerReset}
        />
        <StatCard title="تحت التنفيذ" value={stats.inProgress} icon={Clock3} />
        <StatCard
          title="تم الإنجاز"
          value={stats.completed}
          icon={CheckCircle2}
        />
      </div>

      <Card className="overflow-hidden rounded-3xl border-border/70 shadow-sm">
        <CardContent className="p-5">
          <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="text-right">
              <h2 className="text-xl font-black">الفلاتر الذكية</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                النشطة الآن لا تُخفي الطلبات القديمة غير المنجزة، وكل النشاطات
                تبحث حسب الطباعة أو آخر حركة أو الإنجاز
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-right text-xs text-muted-foreground">
                  وضع العرض
                </label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as ModeKey)}
                  className="h-11 w-full rounded-2xl border border-border/70 bg-background px-3 text-sm outline-none"
                >
                  <option value="active">النشطة الآن</option>
                  <option value="activity">كل النشاطات</option>
                  <option value="completed">المنجزة</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-right text-xs text-muted-foreground">
                  من تاريخ
                </label>
                <div className="relative">
                  <CalendarRange className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="h-11 rounded-2xl border-border/70 pr-10"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-right text-xs text-muted-foreground">
                  إلى تاريخ
                </label>
                <div className="relative">
                  <CalendarRange className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="h-11 rounded-2xl border-border/70 pr-10"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setFrom("");
                    setTo("");
                    setMode("active");
                    setStatusFilter("all");
                    setPage(1);
                  }}
                  className="h-11 w-full rounded-2xl border border-border/70 bg-background px-4 text-sm font-medium transition hover:bg-muted/40"
                >
                  تصفير الفلاتر
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="flex min-w-max items-center gap-3 pb-2">
              {filterCards.map((item) => {
                const active = statusFilter === item.key;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setStatusFilter(item.key)}
                    className={`inline-flex h-12 items-center gap-3 rounded-2xl border px-4 text-sm font-bold transition ${
                      active
                        ? "border-black bg-black text-white"
                        : "border-border/70 bg-white text-foreground hover:bg-muted/40"
                    }`}
                  >
                    <span>{item.label}</span>
                    <span
                      className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs ${
                        active
                          ? "bg-white/15 text-white"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-3xl border-border/70 shadow-sm">
        <CardContent className="border-b border-border/60 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              إجمالي النتائج في هذا العرض: {pagination.total}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                عرض في الصفحة
              </span>

              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm outline-none"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </CardContent>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1450px] text-sm">
              <thead className="bg-muted/40">
                <tr className="border-b border-border/70">
                  <th className="p-4 text-right font-bold">الطلب</th>
                  <th className="p-4 text-right font-bold">رقم القطعة</th>
                  <th className="p-4 text-right font-bold">QR</th>
                  <th className="p-4 text-right font-bold">العميل</th>
                  <th className="p-4 text-right font-bold">المنتج</th>
                  <th className="p-4 text-center font-bold">الدُفعة</th>
                  <th className="p-4 text-center font-bold">الحالة</th>
                  <th className="p-4 text-right font-bold">المرحلة الحالية</th>
                  <th className="p-4 text-right font-bold">سير المراحل</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="p-10 text-center text-muted-foreground"
                    >
                      <div className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        جاري تحميل التتبع...
                      </div>
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="p-10 text-center text-muted-foreground"
                    >
                      لا توجد نتائج مطابقة.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr
                      key={row.productionItemId}
                      className="border-b border-border/60 align-top transition hover:bg-muted/20"
                    >
                      <td className="p-4 text-right">
                        <div className="space-y-1">
                          <div className="font-bold">
                            #{row.orderNumber || row.sallaOrderId || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            طُبع: {fmtDate(row.printedAt)}
                          </div>
                        </div>
                      </td>

                      <td className="p-4 text-right">
                        <div className="font-bold">قطعة #{row.pieceNo}</div>
                      </td>

                      <td className="p-4 text-right">
                        <div className="max-w-[220px] truncate font-mono text-xs">
                          {row.qrCode}
                        </div>
                      </td>

                      <td className="p-4 text-right">
                        <div className="space-y-1">
                          <div className="font-medium">
                            {row.customerName || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.customerPhone || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.customerCity || "—"}
                          </div>
                        </div>
                      </td>

                      <td className="p-4 text-right">
                        <div className="space-y-1">
                          <div className="font-medium">
                            {row.productName || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.sku || "—"}
                          </div>
                        </div>
                      </td>

                      <td className="p-4 text-center">
                        <div className="space-y-1">
                          <div className="font-bold">
                            {row.batchNo ? `دفعة ${row.batchNo}` : "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.batchDate || "—"}
                          </div>
                        </div>
                      </td>

                      <td className="p-4 text-center">
                        <TrackingStatusBadge status={row.trackingStatus} />
                      </td>

                      <td className="p-4 text-right">
                        <div className="space-y-1">
                          <div className="font-bold">
                            {row.currentStageName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {fmtDate(row.currentStageAt)}
                          </div>
                        </div>
                      </td>

                      <td className="p-4 text-right">
                        <div className="min-w-[520px]">
                          <StageTimeline row={row} stages={stages} />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>

        <CardContent className="border-t border-border/60 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              الصفحة {currentPage} من {totalPages || 1}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || loading}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border/70 px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
                السابق
              </button>

              <button
                type="button"
                onClick={() =>
                  setPage((p) => Math.min(Math.max(totalPages, 1), p + 1))
                }
                disabled={currentPage >= Math.max(totalPages, 1) || loading}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border/70 px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                التالي
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
