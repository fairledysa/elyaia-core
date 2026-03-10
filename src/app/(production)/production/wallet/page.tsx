// FILE: src/app/(production)/production/wallet/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpLeft,
  BadgePercent,
  CalendarIcon,
  HandCoins,
  Loader2,
  Wallet2,
} from "lucide-react";
import { format } from "date-fns";
import { type DateRange } from "react-day-picker";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type WalletFilterPreset =
  | "all"
  | "today"
  | "7d"
  | "this_month"
  | "last_month"
  | "this_year";

type WalletTransaction = {
  id: string;
  title: string;
  subtitle?: string | null;
  amount: string;
  type: "plus" | "minus";
  time: string;
  rawAmount: number;
  createdAt: string | null;
  rawType?: string;
  note?: string | null;
};

type WalletApiResponse = {
  ok?: boolean;
  error?: string;
  summary?: {
    balance: number;
    totalCredit: number;
    totalDebit: number;
    totalBonus: number;
    totalPayout: number;
    updatedAt: string | null;
  };
  filters?: {
    preset: WalletFilterPreset;
    year: number | null;
    month: number | null;
    from: string | null;
    to: string | null;
  };
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  transactions?: WalletTransaction[];
};

const PAGE_SIZE = 20;

const presetOptions: Array<{ value: WalletFilterPreset; label: string }> = [
  { value: "all", label: "الكل" },
  { value: "today", label: "اليوم" },
  { value: "7d", label: "آخر 7 أيام" },
  { value: "this_month", label: "هذا الشهر" },
  { value: "last_month", label: "الشهر الماضي" },
  { value: "this_year", label: "هذه السنة" },
];

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "0";
  return new Intl.NumberFormat("ar-SA", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatUpdatedAt(value: string | null | undefined) {
  if (!value) return "لا يوجد تحديث بعد";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const period = h >= 12 ? "م" : "ص";
  const hour12 = h % 12 || 12;

  return `آخر تحديث اليوم ${hour12}:${m} ${period}`;
}

function formatFullDate(value: string | null | undefined) {
  if (!value) return "-";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function mapRawTypeLabel(type?: string | null) {
  switch (type) {
    case "piece_earning":
      return "مستحق تنفيذ قطعة";
    case "stage_earning":
      return "دخل تنفيذ مرحلة";
    case "bonus":
      return "مكافأة";
    case "advance":
      return "سلفة";
    case "deduction":
      return "خصم";
    case "payout":
      return "صرف";
    case "salary":
      return "راتب";
    case "adjustment":
      return "تسوية";
    default:
      return type || "حركة مالية";
  }
}

function monthLabel(month: string) {
  const labels: Record<string, string> = {
    "1": "يناير",
    "2": "فبراير",
    "3": "مارس",
    "4": "أبريل",
    "5": "مايو",
    "6": "يونيو",
    "7": "يوليو",
    "8": "أغسطس",
    "9": "سبتمبر",
    "10": "أكتوبر",
    "11": "نوفمبر",
    "12": "ديسمبر",
  };

  return labels[month] || month;
}

function currentFilterLabel(params: {
  preset: WalletFilterPreset;
  year: string;
  month: string;
  fromDate: string;
  toDate: string;
}) {
  if (params.fromDate || params.toDate) return "مدى تاريخ";
  if (params.year && params.month) {
    return `${monthLabel(params.month)} ${params.year}`;
  }
  if (params.year) return `سنة ${params.year}`;

  const preset = presetOptions.find((x) => x.value === params.preset);
  return preset?.label || "الكل";
}

function toDateInputValue(date?: Date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function ProductionWalletPage() {
  const currentYear = new Date().getFullYear();
  const years = useMemo(
    () => Array.from({ length: 3 }, (_, i) => String(currentYear - i)),
    [currentYear],
  );

  const [data, setData] = useState<WalletApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] =
    useState<WalletTransaction | null>(null);

  const [preset, setPreset] = useState<WalletFilterPreset>("this_month");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const fromDate = useMemo(
    () => toDateInputValue(dateRange?.from),
    [dateRange?.from],
  );
  const toDate = useMemo(
    () => toDateInputValue(dateRange?.to),
    [dateRange?.to],
  );

  async function loadWallet(options?: { append?: boolean }) {
    const append = options?.append === true;

    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set(
        "offset",
        String(append ? (data?.transactions?.length ?? 0) : 0),
      );
      params.set("preset", preset);

      if (year) params.set("year", year);
      if (month) params.set("month", month);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const res = await fetch(`/api/production/wallet?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const json = (await res
        .json()
        .catch(() => null)) as WalletApiResponse | null;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "FAILED_TO_LOAD_WALLET");
      }

      setData((prev) => {
        if (!append) return json;

        return {
          ...json,
          transactions: [
            ...(prev?.transactions ?? []),
            ...(json.transactions ?? []),
          ],
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "FAILED_TO_LOAD_WALLET");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    loadWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, year, month, fromDate, toDate]);

  const summary = data?.summary ?? null;
  const transactions = useMemo(
    () => data?.transactions ?? [],
    [data?.transactions],
  );
  const pagination = data?.pagination;
  const hasMore = !!pagination?.hasMore;

  const activeFilterLabel = currentFilterLabel({
    preset,
    year,
    month,
    fromDate,
    toDate,
  });

  function handlePresetChange(nextPreset: WalletFilterPreset) {
    setPreset(nextPreset);
    setYear("");
    setMonth("");
    setDateRange(undefined);
  }

  function clearFilters() {
    setPreset("all");
    setYear("");
    setMonth("");
    setDateRange(undefined);
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="flex items-center gap-3 text-slate-700">
          <Loader2 className="h-5 w-5 animate-spin" />
          جاري تحميل المحفظة...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="mb-2 text-base font-black text-slate-900">
          تعذر تحميل المحفظة
        </div>
        <div className="text-sm text-red-600">{error}</div>
        <button
          type="button"
          onClick={() => loadWallet()}
          className="mt-4 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <section className="rounded-[30px] bg-[linear-gradient(135deg,#0f172a,#1d4ed8,#22c55e)] p-5 text-white shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-white/70">رصيدك الحالي</div>
              <div className="mt-2 text-3xl font-black">
                {formatNumber(summary?.balance)} ر.س
              </div>
              <div className="mt-2 text-sm text-white/80">
                {formatUpdatedAt(summary?.updatedAt)}
              </div>
            </div>

            <div className="rounded-2xl bg-white/10 p-3">
              <Wallet2 className="h-6 w-6" />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-600">لك</div>
              <ArrowUpLeft className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {formatNumber(summary?.totalCredit)}
            </div>
            <div className="mt-1 text-xs text-slate-500">إجمالي المستحقات</div>
          </div>

          <div className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-600">عليك</div>
              <ArrowDownLeft className="h-4 w-4 text-rose-500" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {formatNumber(summary?.totalDebit)}
            </div>
            <div className="mt-1 text-xs text-slate-500">سلف وخصومات</div>
          </div>

          <div className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-600">مكافآت</div>
              <BadgePercent className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {formatNumber(summary?.totalBonus)}
            </div>
            <div className="mt-1 text-xs text-slate-500">هذا الشهر</div>
          </div>

          <div className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-600">الصرف</div>
              <HandCoins className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {formatNumber(summary?.totalPayout)}
            </div>
            <div className="mt-1 text-xs text-slate-500">تم صرفه سابقًا</div>
          </div>
        </section>

        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-base font-black text-slate-900">
              آخر الحركات
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
              {activeFilterLabel}
            </div>
          </div>

          <div className="mb-4 space-y-3 rounded-2xl bg-slate-50 p-3">
            <div className="overflow-x-auto">
              <div className="flex min-w-max gap-2">
                {presetOptions.map((option) => {
                  const active = preset === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handlePresetChange(option.value)}
                      className={`rounded-full px-3 py-2 text-xs font-bold transition ${
                        active
                          ? "bg-slate-900 text-white"
                          : "bg-white text-slate-700 ring-1 ring-slate-200"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600">
                  السنة
                </label>
                <select
                  value={year}
                  onChange={(e) => {
                    setYear(e.target.value);
                    if (!e.target.value) setMonth("");
                    setPreset("all");
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                >
                  <option value="">الكل</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600">
                  الشهر
                </label>
                <select
                  value={month}
                  onChange={(e) => {
                    setMonth(e.target.value);
                    setPreset("all");
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                >
                  <option value="">الكل</option>
                  {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(
                    (m) => (
                      <option key={m} value={m}>
                        {monthLabel(m)}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="col-span-2">
                <label className="mb-1 block text-xs font-bold text-slate-600">
                  من تاريخ إلى تاريخ
                </label>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start rounded-2xl border-slate-200 bg-white px-3 py-2 text-right font-normal"
                    >
                      <CalendarIcon className="ml-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "yyyy/MM/dd")} -{" "}
                            {format(dateRange.to, "yyyy/MM/dd")}
                          </>
                        ) : (
                          format(dateRange.from, "yyyy/MM/dd")
                        )
                      ) : (
                        <span className="text-slate-500">اختر مدى التاريخ</span>
                      )}
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={(range) => {
                        setDateRange(range);
                        setPreset("all");
                      }}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                يتم عرض {transactions.length} من أصل{" "}
                {formatNumber(data?.pagination?.total ?? 0)} حركة
              </div>

              <button
                type="button"
                onClick={clearFilters}
                className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200"
              >
                تصفير الفلاتر
              </button>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              لا توجد حركات مالية ضمن هذا النطاق
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {transactions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedTransaction(item)}
                    className="flex w-full items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-right transition hover:bg-slate-100"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                          item.type === "plus"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {item.type === "plus" ? (
                          <ArrowUpLeft className="h-5 w-5" />
                        ) : (
                          <ArrowDownLeft className="h-5 w-5" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="truncate font-bold text-slate-900">
                          {item.title}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                          {item.subtitle ? <span>{item.subtitle}</span> : null}
                          <span>{item.time}</span>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`shrink-0 text-sm font-black ${
                        item.type === "plus"
                          ? "text-emerald-700"
                          : "text-rose-700"
                      }`}
                    >
                      {item.amount}
                    </div>
                  </button>
                ))}
              </div>

              {hasMore ? (
                <button
                  type="button"
                  onClick={() => loadWallet({ append: true })}
                  disabled={loadingMore}
                  className="mt-4 flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري تحميل المزيد...
                    </>
                  ) : (
                    "تحميل 20 نتيجة أخرى"
                  )}
                </button>
              ) : transactions.length > 0 ? (
                <div className="mt-4 text-center text-xs text-slate-500">
                  تم عرض جميع النتائج
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>

      <Drawer
        open={!!selectedTransaction}
        onOpenChange={(open) => {
          if (!open) setSelectedTransaction(null);
        }}
      >
        <DrawerContent>
          <DrawerHeader className="text-right">
            <DrawerTitle>
              {selectedTransaction?.title || "تفاصيل الحركة"}
            </DrawerTitle>
            <DrawerDescription>بيانات وتفاصيل الحركة المالية</DrawerDescription>
          </DrawerHeader>

          <div className="space-y-3 px-4 pb-6">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs text-slate-500">المبلغ</div>
              <div
                className={`mt-2 text-lg font-black ${
                  selectedTransaction?.type === "plus"
                    ? "text-emerald-700"
                    : "text-rose-700"
                }`}
              >
                {selectedTransaction?.amount || "-"}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="grid gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="text-sm text-slate-500">عنوان الحركة</div>
                  <div className="text-right text-sm font-bold text-slate-900">
                    {selectedTransaction?.title || "-"}
                  </div>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div className="text-sm text-slate-500">نوع الحركة</div>
                  <div className="text-right text-sm font-bold text-slate-900">
                    {mapRawTypeLabel(selectedTransaction?.rawType)}
                  </div>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div className="text-sm text-slate-500">الوقت المختصر</div>
                  <div className="text-right text-sm font-bold text-slate-900">
                    {selectedTransaction?.time || "-"}
                  </div>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div className="text-sm text-slate-500">التاريخ الكامل</div>
                  <div className="text-right text-sm font-bold text-slate-900">
                    {formatFullDate(selectedTransaction?.createdAt)}
                  </div>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div className="text-sm text-slate-500">قيمة الحركة</div>
                  <div className="text-right text-sm font-bold text-slate-900">
                    {formatNumber(
                      Math.abs(selectedTransaction?.rawAmount || 0),
                    )}{" "}
                    ر.س
                  </div>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div className="text-sm text-slate-500">اتجاه الحركة</div>
                  <div className="text-right text-sm font-bold text-slate-900">
                    {selectedTransaction?.type === "plus" ? "إضافة" : "خصم"}
                  </div>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div className="text-sm text-slate-500">رقم الحركة</div>
                  <div className="max-w-[70%] break-all text-right text-sm font-bold text-slate-900">
                    {selectedTransaction?.id || "-"}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="mb-2 text-sm text-slate-500">التفاصيل</div>
              <div className="text-sm font-bold text-slate-900">
                {selectedTransaction?.note ||
                  selectedTransaction?.subtitle ||
                  selectedTransaction?.title ||
                  "-"}
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
