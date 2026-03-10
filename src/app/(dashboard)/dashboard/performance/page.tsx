// FILE: src/app/(dashboard)/dashboard/performance/page.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  CalendarDays,
  Filter,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";

type SelectItem = {
  id: string;
  name: string;
};

type EmployeeItem = {
  id: string;
  userId: string;
  name: string;
  active: boolean | null;
  stageId: string | null;
  stageName: string | null;
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
  filters?: {
    from: string | null;
    to: string | null;
    employeeId: string | null;
    stageId: string | null;
    active: string;
    month?: string | null;
  };
  summary?: {
    totalCompleted: number;
    avgQualityScore: number;
    warningsCount: number;
    rewardsCount: number;
    employeesCount: number;
  };
  charts?: {
    completedByStage: Array<{ stage: string; value: number }>;
    qualityByStage: Array<{ stage: string; value: number }>;
    behaviorByStage: Array<{
      stage: string;
      warnings: number;
      rewards: number;
    }>;
    employeesRanking: Array<{
      employeeId: string;
      name: string;
      score: number;
      completedCount: number;
      qualityScore: number;
      warningCount: number;
      rewardCount: number;
    }>;
    employeeMonthlyProduction?: Array<{
      day: number;
      label: string;
      value: number;
    }>;
  };
  employeeMonthlyProduction?: {
    employeeId: string;
    employeeName: string;
    month: string;
    total: number;
    series: Array<{ day: number; label: string; value: number }>;
  } | null;
  employees?: EmployeeItem[];
  stages?: SelectItem[];
  ranking?: Array<{
    employeeId: string;
    userId: string;
    name: string;
    completedCount: number;
    qualityScore: number;
    warningCount: number;
    rewardCount: number;
    score: number;
  }>;
};

function formatNumber(value: number | null | undefined) {
  const safe = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("ar-SA", {
    maximumFractionDigits: 2,
  }).format(safe);
}

function defaultMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function PerformancePage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [employeeId, setEmployeeId] = useState("all");
  const [stageId, setStageId] = useState("all");
  const [active, setActive] = useState("all");
  const [month, setMonth] = useState(defaultMonthValue());

  const queryString = useMemo(() => {
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    if (employeeId !== "all") query.set("employeeId", employeeId);
    if (stageId !== "all") query.set("stageId", stageId);
    if (active !== "all") query.set("active", active);
    if (month) query.set("month", month);
    return query.toString();
  }, [from, to, employeeId, stageId, active, month]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/finance/performance?${queryString}`, {
        method: "GET",
        cache: "no-store",
      });

      const json = (await res.json().catch(() => null)) as ApiResponse | null;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "FAILED_TO_LOAD_PERFORMANCE");
      }

      setData(json);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "FAILED_TO_LOAD_PERFORMANCE",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const showMonthlyProduction = employeeId !== "all";

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">تقرير الأداء</h1>
            <p className="text-sm text-muted-foreground">
              متابعة الإنتاج والجودة والتنبيهات والمكافآت وترتيب الموظفين
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              <RefreshCw className="h-4 w-4" />
              تحديث
            </button>

            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
            >
              <Filter className="h-4 w-4" />
              تطبيق الفلاتر
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="h-11 rounded-xl border bg-background px-3 text-sm outline-none"
          >
            <option value="all">كل الموظفين</option>
            {(data?.employees ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <select
            value={stageId}
            onChange={(e) => setStageId(e.target.value)}
            className="h-11 rounded-xl border bg-background px-3 text-sm outline-none"
          >
            <option value="all">كل المراحل</option>
            {(data?.stages ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <select
            value={active}
            onChange={(e) => setActive(e.target.value)}
            className="h-11 rounded-xl border bg-background px-3 text-sm outline-none"
          >
            <option value="all">الكل</option>
            <option value="active">نشط</option>
            <option value="inactive">غير نشط</option>
          </select>

          <input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            type="date"
            className="h-11 rounded-xl border bg-background px-3 text-sm outline-none"
          />

          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            type="date"
            className="h-11 rounded-xl border bg-background px-3 text-sm outline-none"
          />

          <input
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            type="month"
            className="h-11 rounded-xl border bg-background px-3 text-sm outline-none"
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="إجمالي الإنتاج"
          value={loading ? "..." : formatNumber(data?.summary?.totalCompleted)}
          hint="عدد القطع المنفذة"
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <StatCard
          title="متوسط الجودة"
          value={loading ? "..." : formatNumber(data?.summary?.avgQualityScore)}
          hint="متوسط تقييم الجودة"
          icon={<Trophy className="h-4 w-4" />}
        />
        <StatCard
          title="التنبيهات"
          value={loading ? "..." : formatNumber(data?.summary?.warningsCount)}
          hint="كل التنبيهات المسجلة"
          icon={<ShieldAlert className="h-4 w-4" />}
        />
        <StatCard
          title="المكافآت"
          value={loading ? "..." : formatNumber(data?.summary?.rewardsCount)}
          hint="إشادات ومكافآت"
          icon={<Sparkles className="h-4 w-4" />}
        />
        <StatCard
          title="الموظفون"
          value={loading ? "..." : formatNumber(data?.summary?.employeesCount)}
          hint="عدد الموظفين في التقرير"
          icon={<Users className="h-4 w-4" />}
        />
      </div>

      {showMonthlyProduction ? (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold">الإنتاج طول الشهر</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {data?.employeeMonthlyProduction?.employeeName || "الموظف"} •{" "}
                  {data?.employeeMonthlyProduction?.month || month}
                </p>
              </div>

              <div className="flex items-center gap-2 text-2xl font-bold">
                <CalendarDays className="h-5 w-5 text-muted-foreground" />
                {loading
                  ? "..."
                  : formatNumber(data?.employeeMonthlyProduction?.total)}
              </div>
            </div>
          </div>

          <div className="p-4">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={data?.employeeMonthlyProduction?.series ?? []}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="الإنتاج حسب المرحلة"
          subtitle="عدد التنفيذ في كل مرحلة"
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data?.charts?.completedByStage ?? []}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="stage" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="الجودة حسب المرحلة" subtitle="متوسط جودة كل مرحلة">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data?.charts?.qualityByStage ?? []}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="stage" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="التنبيهات والمكافآت حسب المرحلة"
          subtitle="مقارنة سريعة للسلوك والأداء"
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data?.charts?.behaviorByStage ?? []}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="stage" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="warnings" name="التنبيهات" radius={[6, 6, 0, 0]} />
              <Bar dataKey="rewards" name="المكافآت" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="ترتيب الموظفين" subtitle="ترتيب عام حسب السكور">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data?.charts?.employeesRanking ?? []}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="score" name="السكور" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-bold">جدول ترتيب الموظفين</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            الترتيب يعتمد على الإنتاج والجودة والمكافآت والتنبيهات
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-right font-medium">#</th>
                <th className="px-4 py-3 text-right font-medium">الموظف</th>
                <th className="px-4 py-3 text-right font-medium">السكور</th>
                <th className="px-4 py-3 text-right font-medium">الإنتاج</th>
                <th className="px-4 py-3 text-right font-medium">الجودة</th>
                <th className="px-4 py-3 text-right font-medium">التنبيهات</th>
                <th className="px-4 py-3 text-right font-medium">المكافآت</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr className="border-t">
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    جاري التحميل...
                  </td>
                </tr>
              ) : (data?.ranking ?? []).length > 0 ? (
                (data?.ranking ?? []).map((item, index) => (
                  <tr
                    key={item.employeeId}
                    className="border-t hover:bg-muted/20"
                  >
                    <td className="px-4 py-3">{index + 1}</td>
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3 font-bold">
                      {formatNumber(item.score)}
                    </td>
                    <td className="px-4 py-3">
                      {formatNumber(item.completedCount)}
                    </td>
                    <td className="px-4 py-3">
                      {formatNumber(item.qualityScore)}
                    </td>
                    <td className="px-4 py-3 text-red-600">
                      {formatNumber(item.warningCount)}
                    </td>
                    <td className="px-4 py-3 text-green-600">
                      {formatNumber(item.rewardCount)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-t">
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-muted-foreground"
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

function StatCard({
  title,
  value,
  hint,
  icon,
}: {
  title: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm text-muted-foreground">{title}</div>
        <div className="rounded-full border p-2 text-muted-foreground">
          {icon}
        </div>
      </div>
      <div className="mt-4 text-3xl font-bold tracking-tight">{value}</div>
      <div className="mt-2 text-sm text-muted-foreground">{hint}</div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
