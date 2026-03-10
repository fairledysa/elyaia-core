// FILE: src/app/(production)/production-login/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  BadgeAlert,
  CalendarDays,
  ChartColumn,
  CircleDollarSign,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  UserRound,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartItem = {
  day: string;
  production: number;
};

type ReviewRecentItem = {
  score: number | null;
  rating: "excellent" | "good" | "needs_improvement" | "poor";
  created_at: string;
  note: string | null;
  reason: string | null;
};

type WarningRecentItem = {
  id: string;
  warning_type: "lateness" | "quality" | "behavior" | "absence" | "other";
  severity: "low" | "medium" | "high";
  note: string | null;
  reason: string | null;
  created_at: string;
};

type RewardRecentItem = {
  id: string;
  reward_type:
    | "praise"
    | "commitment"
    | "discipline"
    | "speed"
    | "quality"
    | "bonus"
    | "other";
  note: string | null;
  reason: string | null;
  created_at: string;
};

type DashboardResponse = {
  ok?: boolean;
  error?: string;
  worker: {
    employeeId: string;
    userId: string;
    name: string;
    phone: string | null;
    email: string | null;
    stageName: string;
    active: boolean;
  };
  summary: {
    todayProduction: number;
    weekProduction: number;
    monthProduction: number;
    totalProduction: number;
    avgQuality: number;
    totalWarnings: number;
    totalRewards: number;
    highWarnings: number;
    walletBalance: number;
    overallScore: number;
    overallLabel: string;
    productionTarget: number;
    bestDay: {
      day: string;
      production: number;
    };
  };
  chart: ChartItem[];
  quality: {
    average: number;
    counts: {
      excellent: number;
      good: number;
      needs_improvement: number;
      poor: number;
    };
    recent: ReviewRecentItem[];
  };
  warnings: {
    counts: {
      total: number;
      high: number;
      quality: number;
      behavior: number;
      lateness: number;
      absence: number;
      other: number;
    };
    recent: WarningRecentItem[];
  };
  rewards: {
    counts: {
      total: number;
      praise: number;
      quality: number;
      speed: number;
      commitment: number;
      discipline: number;
      bonus: number;
      other: number;
    };
    recent: RewardRecentItem[];
  };
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ar-SA").format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function warningTypeLabel(type: WarningRecentItem["warning_type"]) {
  switch (type) {
    case "lateness":
      return "تأخير";
    case "quality":
      return "جودة";
    case "behavior":
      return "سلوك";
    case "absence":
      return "غياب";
    default:
      return "أخرى";
  }
}

function rewardTypeLabel(type: RewardRecentItem["reward_type"]) {
  switch (type) {
    case "praise":
      return "إشادة";
    case "commitment":
      return "التزام";
    case "discipline":
      return "انضباط";
    case "speed":
      return "سرعة";
    case "quality":
      return "جودة";
    case "bonus":
      return "مكافأة";
    default:
      return "أخرى";
  }
}

function reviewRatingLabel(type: ReviewRecentItem["rating"]) {
  switch (type) {
    case "excellent":
      return "ممتاز";
    case "good":
      return "جيد";
    case "needs_improvement":
      return "يحتاج تحسين";
    case "poor":
      return "ضعيف";
    default:
      return type;
  }
}

function scoreColor(score: number) {
  if (score >= 90) return "bg-emerald-500";
  if (score >= 75) return "bg-blue-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-rose-500";
}

function SmallStatCard({
  title,
  value,
  sub,
  icon,
}: {
  title: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div className="rounded-2xl bg-white/10 p-2 text-white">{icon}</div>
      </div>
      <div className="text-xs text-white/65">{title}</div>
      <div className="mt-2 text-xl font-black text-white">{value}</div>
      <div className="mt-1 text-[11px] leading-5 text-white/50">{sub}</div>
    </div>
  );
}

export default function ProductionHomePage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/production/dashboard", {
          cache: "no-store",
        });

        const json = (await res.json()) as DashboardResponse;

        if (!res.ok) {
          throw new Error(json.error || "تعذر تحميل الصفحة");
        }

        if (!cancelled) {
          setData(json);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "حدث خطأ غير متوقع");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const progressWidth = useMemo(() => {
    return `${Math.max(0, Math.min(100, data?.summary.overallScore ?? 0))}%`;
  }, [data]);

  if (loading) {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.22),_transparent_28%),linear-gradient(180deg,#081122_0%,#0b1530_42%,#121d38_100%)] px-3 py-4 text-white"
      >
        <div className="mx-auto w-full max-w-md space-y-3">
          <div className="h-28 animate-pulse rounded-[28px] bg-white/10" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-28 animate-pulse rounded-[24px] bg-white/10" />
            <div className="h-28 animate-pulse rounded-[24px] bg-white/10" />
            <div className="h-28 animate-pulse rounded-[24px] bg-white/10" />
            <div className="h-28 animate-pulse rounded-[24px] bg-white/10" />
          </div>
          <div className="h-72 animate-pulse rounded-[28px] bg-white/10" />
          <div className="h-60 animate-pulse rounded-[28px] bg-white/10" />
          <div className="h-60 animate-pulse rounded-[28px] bg-white/10" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.22),_transparent_28%),linear-gradient(180deg,#081122_0%,#0b1530_42%,#121d38_100%)] px-3 py-6 text-white"
      >
        <div className="mx-auto w-full max-w-md rounded-[28px] border border-rose-400/30 bg-rose-500/10 p-6 text-center shadow-xl">
          <BadgeAlert className="mx-auto mb-3 h-10 w-10 text-rose-300" />
          <div className="text-lg font-black">تعذر تحميل لوحة العامل</div>
          <div className="mt-2 text-sm text-white/75">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.22),_transparent_28%),linear-gradient(180deg,#081122_0%,#0b1530_42%,#121d38_100%)] px-3 py-4 text-white"
    >
      <div className="mx-auto w-full max-w-md space-y-3">
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur">
          <div className="flex items-start gap-3">
            <div className="rounded-[22px] bg-white/10 p-3">
              <UserRound className="h-6 w-6 text-white" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-white/60">لوحة العامل</div>
              <div className="mt-1 truncate text-2xl font-black">
                {data.worker.name}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/80">
                  المرحلة: {data.worker.stageName}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/80">
                  الحالة: {data.worker.active ? "نشط" : "غير نشط"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-[22px] bg-white/10 p-3">
              <div className="text-[11px] text-white/60">إنتاج اليوم</div>
              <div className="mt-1 text-lg font-black">
                {formatNumber(data.summary.todayProduction)}
              </div>
            </div>

            <div className="rounded-[22px] bg-white/10 p-3">
              <div className="text-[11px] text-white/60">إنتاج الأسبوع</div>
              <div className="mt-1 text-lg font-black">
                {formatNumber(data.summary.weekProduction)}
              </div>
            </div>

            <div className="rounded-[22px] bg-white/10 p-3">
              <div className="text-[11px] text-white/60">إنتاج الشهر</div>
              <div className="mt-1 text-lg font-black">
                {formatNumber(data.summary.monthProduction)}
              </div>
            </div>

            <div className="rounded-[22px] bg-white/10 p-3">
              <div className="text-[11px] text-white/60">الرصيد</div>
              <div className="mt-1 text-sm font-black leading-6">
                {formatCurrency(data.summary.walletBalance)}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SmallStatCard
            title="إجمالي الإنتاج"
            value={formatNumber(data.summary.totalProduction)}
            sub="عدد القطع المنفذة"
            icon={<ChartColumn className="h-5 w-5" />}
          />
          <SmallStatCard
            title="متوسط الجودة"
            value={formatNumber(data.summary.avgQuality)}
            sub="متوسط تقييم الجودة"
            icon={<ShieldCheck className="h-5 w-5" />}
          />
          <SmallStatCard
            title="التنبيهات"
            value={formatNumber(data.summary.totalWarnings)}
            sub="كل التنبيهات المسجلة"
            icon={<AlertTriangle className="h-5 w-5" />}
          />
          <SmallStatCard
            title="المكافآت"
            value={formatNumber(data.summary.totalRewards)}
            sub="إشادات ومكافآت"
            icon={<Award className="h-5 w-5" />}
          />
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-white/80" />
            <div>
              <div className="text-lg font-black">الاسكور العام</div>
              <div className="text-[11px] text-white/60">
                هذا هو قلب العامل داخل النظام
              </div>
            </div>
          </div>

          <div className="rounded-[24px] bg-white/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-white/60">التقييم الحالي</div>
                <div className="mt-2 text-3xl font-black">
                  {formatNumber(data.summary.overallScore)}
                  <span className="text-base text-white/55"> / 100</span>
                </div>
                <div className="mt-2 text-sm text-white/80">
                  {data.summary.overallLabel}
                </div>
              </div>

              <div className="rounded-[20px] bg-white/10 p-3">
                <Star className="h-7 w-7 text-white" />
              </div>
            </div>

            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${scoreColor(
                  data.summary.overallScore,
                )}`}
                style={{ width: progressWidth }}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-[18px] bg-white/10 p-3">
                <div className="text-[11px] text-white/60">الهدف الشهري</div>
                <div className="mt-1 text-sm font-black">
                  {formatNumber(data.summary.productionTarget)} قطعة
                </div>
              </div>
              <div className="rounded-[18px] bg-white/10 p-3">
                <div className="text-[11px] text-white/60">تحذيرات عالية</div>
                <div className="mt-1 text-sm font-black">
                  {formatNumber(data.summary.highWarnings)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-white/80" />
            <div>
              <div className="text-lg font-black">الإنتاج الشهري</div>
              <div className="text-[11px] text-white/60">
                تقرير الشهر الكامل
              </div>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-[18px] bg-white/10 p-3">
              <div className="text-[11px] text-white/60">إنتاج اليوم</div>
              <div className="mt-1 text-base font-black">
                {formatNumber(data.summary.todayProduction)}
              </div>
            </div>
            <div className="rounded-[18px] bg-white/10 p-3">
              <div className="text-[11px] text-white/60">إنتاج الأسبوع</div>
              <div className="mt-1 text-base font-black">
                {formatNumber(data.summary.weekProduction)}
              </div>
            </div>
            <div className="rounded-[18px] bg-white/10 p-3">
              <div className="text-[11px] text-white/60">إنتاج الشهر</div>
              <div className="mt-1 text-base font-black">
                {formatNumber(data.summary.monthProduction)}
              </div>
            </div>
            <div className="rounded-[18px] bg-white/10 p-3">
              <div className="text-[11px] text-white/60">أفضل يوم</div>
              <div className="mt-1 text-base font-black">
                {data.summary.bestDay.day === "-"
                  ? "-"
                  : `يوم ${formatNumber(Number(data.summary.bestDay.day))}`}
              </div>
              <div className="mt-1 text-[11px] text-white/55">
                {formatNumber(data.summary.bestDay.production)} قطعة
              </div>
            </div>
          </div>

          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.chart}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.08)"
                />
                <XAxis
                  dataKey="day"
                  stroke="rgba(255,255,255,0.6)"
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.6)"
                  allowDecimals={false}
                  tick={{ fontSize: 10 }}
                  width={24}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 16,
                    color: "#fff",
                  }}
                />
                <Bar dataKey="production" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-white/80" />
            <div>
              <div className="text-lg font-black">الجودة</div>
              <div className="text-[11px] text-white/60">
                متوسط التقييم وتوزيع المراجعات
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[18px] bg-white/10 p-3">
              <div className="text-[11px] text-white/60">ممتاز</div>
              <div className="mt-1 text-lg font-black">
                {formatNumber(data.quality.counts.excellent)}
              </div>
            </div>
            <div className="rounded-[18px] bg-white/10 p-3">
              <div className="text-[11px] text-white/60">جيد</div>
              <div className="mt-1 text-lg font-black">
                {formatNumber(data.quality.counts.good)}
              </div>
            </div>
            <div className="rounded-[18px] bg-white/10 p-3">
              <div className="text-[11px] text-white/60">يحتاج تحسين</div>
              <div className="mt-1 text-lg font-black">
                {formatNumber(data.quality.counts.needs_improvement)}
              </div>
            </div>
            <div className="rounded-[18px] bg-white/10 p-3">
              <div className="text-[11px] text-white/60">ضعيف</div>
              <div className="mt-1 text-lg font-black">
                {formatNumber(data.quality.counts.poor)}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-300" />
            <div>
              <div className="text-lg font-black">التحذيرات والتنبيهات</div>
              <div className="text-[11px] text-white/60">
                آخر الملاحظات المسجلة
              </div>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-[18px] bg-white/10 p-3">
              <div className="text-[11px] text-white/60">تأخير</div>
              <div className="mt-1 text-lg font-black">
                {formatNumber(data.warnings.counts.lateness)}
              </div>
            </div>
            <div className="rounded-[18px] bg-white/10 p-3">
              <div className="text-[11px] text-white/60">جودة</div>
              <div className="mt-1 text-lg font-black">
                {formatNumber(data.warnings.counts.quality)}
              </div>
            </div>
            <div className="rounded-[18px] bg-white/10 p-3">
              <div className="text-[11px] text-white/60">سلوك</div>
              <div className="mt-1 text-lg font-black">
                {formatNumber(data.warnings.counts.behavior)}
              </div>
            </div>
            <div className="rounded-[18px] bg-white/10 p-3">
              <div className="text-[11px] text-white/60">غياب</div>
              <div className="mt-1 text-lg font-black">
                {formatNumber(data.warnings.counts.absence)}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {data.warnings.recent.length === 0 ? (
              <div className="rounded-[20px] bg-white/10 p-4 text-sm text-white/70">
                لا يوجد تحذيرات مسجلة حالياً.
              </div>
            ) : (
              data.warnings.recent.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[20px] border border-white/10 bg-white/10 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold">
                      {warningTypeLabel(item.warning_type)}
                    </div>
                    <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/75">
                      {item.severity === "high"
                        ? "عالي"
                        : item.severity === "medium"
                          ? "متوسط"
                          : "منخفض"}
                    </div>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-white/75">
                    {item.reason || item.note || "لا يوجد وصف إضافي"}
                  </div>
                  <div className="mt-2 text-[11px] text-white/50">
                    {formatDate(item.created_at)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur">
          <div className="mb-4 flex items-center gap-2">
            <Award className="h-5 w-5 text-emerald-300" />
            <div>
              <div className="text-lg font-black">الحوافز والمكافآت</div>
              <div className="text-[11px] text-white/60">
                آخر الإشادات والمكافآت
              </div>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-[18px] bg-white/10 p-3">
              <div className="text-[11px] text-white/60">إشادة</div>
              <div className="mt-1 text-lg font-black">
                {formatNumber(data.rewards.counts.praise)}
              </div>
            </div>
            <div className="rounded-[18px] bg-white/10 p-3">
              <div className="text-[11px] text-white/60">جودة</div>
              <div className="mt-1 text-lg font-black">
                {formatNumber(data.rewards.counts.quality)}
              </div>
            </div>
            <div className="rounded-[18px] bg-white/10 p-3">
              <div className="text-[11px] text-white/60">سرعة</div>
              <div className="mt-1 text-lg font-black">
                {formatNumber(data.rewards.counts.speed)}
              </div>
            </div>
            <div className="rounded-[18px] bg-white/10 p-3">
              <div className="text-[11px] text-white/60">التزام</div>
              <div className="mt-1 text-lg font-black">
                {formatNumber(data.rewards.counts.commitment)}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {data.rewards.recent.length === 0 ? (
              <div className="rounded-[20px] bg-white/10 p-4 text-sm text-white/70">
                لا توجد مكافآت أو حوافز مسجلة حالياً.
              </div>
            ) : (
              data.rewards.recent.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[20px] border border-white/10 bg-white/10 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold">
                      {rewardTypeLabel(item.reward_type)}
                    </div>
                    <div className="rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] text-emerald-200">
                      حافز
                    </div>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-white/75">
                    {item.reason || item.note || "لا يوجد وصف إضافي"}
                  </div>
                  <div className="mt-2 text-[11px] text-white/50">
                    {formatDate(item.created_at)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {data.quality.recent.length > 0 && (
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-white/80" />
              <div>
                <div className="text-lg font-black">آخر تقييمات الجودة</div>
                <div className="text-[11px] text-white/60">
                  أحدث مراجعات الجودة للعامل
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {data.quality.recent.map((item, index) => (
                <div
                  key={`${item.created_at}-${index}`}
                  className="rounded-[20px] border border-white/10 bg-white/10 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold">
                      {reviewRatingLabel(item.rating)}
                    </div>
                    <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/75">
                      {formatNumber(Number(item.score ?? 0))} / 100
                    </div>
                  </div>

                  <div className="mt-2 text-sm leading-6 text-white/75">
                    {item.reason || item.note || "لا يوجد وصف إضافي"}
                  </div>

                  <div className="mt-2 text-[11px] text-white/50">
                    {formatDate(item.created_at)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur">
          <div className="mb-4 flex items-center gap-2">
            <CircleDollarSign className="h-5 w-5 text-white/80" />
            <div>
              <div className="text-lg font-black">ملخص سريع</div>
              <div className="text-[11px] text-white/60">
                صورة شاملة عن وضع العامل
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[18px] bg-white/10 p-3">
              <div className="text-[11px] text-white/60">الرصيد الحالي</div>
              <div className="mt-1 text-sm font-black leading-6">
                {formatCurrency(data.summary.walletBalance)}
              </div>
            </div>

            <div className="rounded-[18px] bg-white/10 p-3">
              <div className="text-[11px] text-white/60">الاسكور الحالي</div>
              <div className="mt-1 text-base font-black">
                {formatNumber(data.summary.overallScore)} / 100
              </div>
            </div>

            <div className="rounded-[18px] bg-white/10 p-3">
              <div className="text-[11px] text-white/60">متوسط الجودة</div>
              <div className="mt-1 text-base font-black">
                {formatNumber(data.summary.avgQuality)} / 100
              </div>
            </div>

            <div className="rounded-[18px] bg-white/10 p-3">
              <div className="text-[11px] text-white/60">التحذيرات العالية</div>
              <div className="mt-1 text-base font-black">
                {formatNumber(data.summary.highWarnings)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
