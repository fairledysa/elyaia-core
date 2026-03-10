//src/app/api/production/dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type EmployeeRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  stage_id: string | null;
  monthly_target: number | null;
  has_monthly_target: boolean | null;
  active: boolean | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

type StageRow = {
  id: string;
  name: string;
};

type StageEventRow = {
  created_at: string | null;
  stage_id: string | null;
};

type ReviewRow = {
  score: number | null;
  rating: "excellent" | "good" | "needs_improvement" | "poor";
  created_at: string;
  note: string | null;
  reason: string | null;
};

type WarningRow = {
  id: string;
  warning_type: "lateness" | "quality" | "behavior" | "absence" | "other";
  severity: "low" | "medium" | "high";
  note: string | null;
  reason: string | null;
  created_at: string;
};

type RewardRow = {
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

type WalletMoveRow = {
  amount: number | null;
  type: string | null;
  note: string | null;
  created_at: string | null;
};

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function parseMonthParam(value: string | null) {
  if (!value) return new Date();

  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return new Date();

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;

  if (
    Number.isNaN(year) ||
    Number.isNaN(monthIndex) ||
    monthIndex < 0 ||
    monthIndex > 11
  ) {
    return new Date();
  }

  return new Date(year, monthIndex, 1);
}

function normalizeWalletAmount(type: string | null, amount: number | null) {
  const numericAmount = Number(amount ?? 0);
  const normalizedType = String(type ?? "")
    .toLowerCase()
    .trim();

  const negativeTypes = new Set([
    "debit",
    "deduct",
    "deduction",
    "withdraw",
    "withdrawal",
    "payout",
    "cash_out",
    "penalty",
    "fine",
    "purchase",
    "expense",
  ]);

  const positiveTypes = new Set([
    "credit",
    "bonus",
    "reward",
    "deposit",
    "topup",
    "top_up",
    "salary",
    "commission",
    "incentive",
    "refund",
  ]);

  if (negativeTypes.has(normalizedType)) {
    return -Math.abs(numericAmount);
  }

  if (positiveTypes.has(normalizedType)) {
    return Math.abs(numericAmount);
  }

  return numericAmount;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select(
        "id, tenant_id, user_id, stage_id, monthly_target, has_monthly_target, active",
      )
      .eq("user_id", user.id)
      .maybeSingle<EmployeeRow>();

    if (employeeError || !employee) {
      return NextResponse.json(
        { error: "تعذر العثور على بيانات العامل" },
        { status: 404 },
      );
    }

    const [{ data: profile }, { data: stage }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, phone, email")
        .eq("id", user.id)
        .maybeSingle<ProfileRow>(),
      employee.stage_id
        ? supabase
            .from("stages")
            .select("id, name")
            .eq("id", employee.stage_id)
            .maybeSingle<StageRow>()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const selectedMonth = parseMonthParam(
      req.nextUrl.searchParams.get("month"),
    );
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);

    const now = new Date();
    const weekStart = startOfWeek(now);
    const todayStart = startOfDay(now);

    const isCurrentMonth =
      now.getFullYear() === selectedMonth.getFullYear() &&
      now.getMonth() === selectedMonth.getMonth();

    const [
      { data: monthEventsRaw, error: monthEventsError },
      { data: allEventsRaw, error: allEventsError },
      { data: reviewsRaw, error: reviewsError },
      { data: warningsRaw, error: warningsError },
      { data: rewardsRaw, error: rewardsError },
      { data: walletRaw, error: walletError },
    ] = await Promise.all([
      supabase
        .from("stage_events")
        .select("created_at, stage_id")
        .eq("tenant_id", employee.tenant_id)
        .eq("user_id", user.id)
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", monthEnd.toISOString())
        .order("created_at", { ascending: true }),
      supabase
        .from("stage_events")
        .select("created_at, stage_id")
        .eq("tenant_id", employee.tenant_id)
        .eq("user_id", user.id),
      supabase
        .from("employee_reviews")
        .select("score, rating, created_at, note, reason")
        .eq("tenant_id", employee.tenant_id)
        .eq("employee_id", employee.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("employee_warnings")
        .select("id, warning_type, severity, note, reason, created_at")
        .eq("tenant_id", employee.tenant_id)
        .eq("employee_id", employee.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("employee_rewards")
        .select("id, reward_type, note, reason, created_at")
        .eq("tenant_id", employee.tenant_id)
        .eq("employee_id", employee.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("wallet_moves")
        .select("amount, type, note, created_at")
        .eq("tenant_id", employee.tenant_id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (
      monthEventsError ||
      allEventsError ||
      reviewsError ||
      warningsError ||
      rewardsError ||
      walletError
    ) {
      return NextResponse.json(
        { error: "تعذر تحميل بيانات لوحة العامل" },
        { status: 500 },
      );
    }

    const monthEvents = (monthEventsRaw ?? []) as StageEventRow[];
    const allEvents = (allEventsRaw ?? []) as StageEventRow[];
    const reviews = (reviewsRaw ?? []) as ReviewRow[];
    const warnings = (warningsRaw ?? []) as WarningRow[];
    const rewards = (rewardsRaw ?? []) as RewardRow[];
    const walletMoves = (walletRaw ?? []) as WalletMoveRow[];

    const monthProduction = monthEvents.length;

    const weekProduction = isCurrentMonth
      ? monthEvents.filter((item) => {
          if (!item.created_at) return false;
          return new Date(item.created_at) >= weekStart;
        }).length
      : 0;

    const todayProduction = isCurrentMonth
      ? monthEvents.filter((item) => {
          if (!item.created_at) return false;
          return new Date(item.created_at) >= todayStart;
        }).length
      : 0;

    const totalProduction = allEvents.length;

    const daysInMonth = monthEnd.getDate();
    const chartMap = new Map<number, number>();

    for (let day = 1; day <= daysInMonth; day += 1) {
      chartMap.set(day, 0);
    }

    for (const event of monthEvents) {
      if (!event.created_at) continue;
      const day = new Date(event.created_at).getDate();
      chartMap.set(day, (chartMap.get(day) ?? 0) + 1);
    }

    const monthlyChart = Array.from(chartMap.entries()).map(([day, count]) => ({
      day: String(day),
      production: count,
    }));

    const bestDay = monthlyChart.reduce(
      (acc, item) => (item.production > acc.production ? item : acc),
      { day: "-", production: 0 },
    );

    const avgQuality =
      reviews.length > 0
        ? Math.round(
            reviews.reduce((sum, item) => sum + Number(item.score ?? 0), 0) /
              reviews.length,
          )
        : 0;

    const reviewCounts = {
      excellent: reviews.filter((r) => r.rating === "excellent").length,
      good: reviews.filter((r) => r.rating === "good").length,
      needs_improvement: reviews.filter((r) => r.rating === "needs_improvement")
        .length,
      poor: reviews.filter((r) => r.rating === "poor").length,
    };

    const warningCounts = {
      total: warnings.length,
      high: warnings.filter((w) => w.severity === "high").length,
      quality: warnings.filter((w) => w.warning_type === "quality").length,
      behavior: warnings.filter((w) => w.warning_type === "behavior").length,
      lateness: warnings.filter((w) => w.warning_type === "lateness").length,
      absence: warnings.filter((w) => w.warning_type === "absence").length,
      other: warnings.filter((w) => w.warning_type === "other").length,
    };

    const rewardCounts = {
      total: rewards.length,
      praise: rewards.filter((r) => r.reward_type === "praise").length,
      quality: rewards.filter((r) => r.reward_type === "quality").length,
      speed: rewards.filter((r) => r.reward_type === "speed").length,
      commitment: rewards.filter((r) => r.reward_type === "commitment").length,
      discipline: rewards.filter((r) => r.reward_type === "discipline").length,
      bonus: rewards.filter((r) => r.reward_type === "bonus").length,
      other: rewards.filter((r) => r.reward_type === "other").length,
    };

    const walletBalance = walletMoves.reduce((sum, item) => {
      return sum + normalizeWalletAmount(item.type, item.amount);
    }, 0);

    const productionTarget =
      employee.has_monthly_target && employee.monthly_target
        ? Math.max(1, Number(employee.monthly_target))
        : 100;

    const productionRatio = clamp(monthProduction / productionTarget, 0, 1.5);
    const productionScore = clamp(Math.round(productionRatio * 40), 0, 40);

    const qualityScore = clamp(Math.round((avgQuality / 100) * 30), 0, 30);
    const rewardsScore = clamp(rewardCounts.total * 3, 0, 15);
    const warningPenalty = clamp(
      warningCounts.total * 2 + warningCounts.high * 2,
      0,
      15,
    );

    const overallScore = clamp(
      productionScore + qualityScore + rewardsScore - warningPenalty,
      0,
      100,
    );

    let overallLabel = "يحتاج تحسين";
    if (overallScore >= 90) overallLabel = "ممتاز";
    else if (overallScore >= 75) overallLabel = "جيد جدًا";
    else if (overallScore >= 60) overallLabel = "جيد";

    return NextResponse.json({
      ok: true,
      filters: {
        month: `${selectedMonth.getFullYear()}-${String(
          selectedMonth.getMonth() + 1,
        ).padStart(2, "0")}`,
        isCurrentMonth,
      },
      worker: {
        employeeId: employee.id,
        userId: user.id,
        name: profile?.full_name ?? "العامل",
        phone: profile?.phone ?? null,
        email: profile?.email ?? null,
        stageName: stage?.name ?? "غير محدد",
        active: employee.active ?? true,
      },
      summary: {
        todayProduction,
        weekProduction,
        monthProduction,
        totalProduction,
        avgQuality,
        totalWarnings: warningCounts.total,
        totalRewards: rewardCounts.total,
        highWarnings: warningCounts.high,
        walletBalance,
        overallScore,
        overallLabel,
        productionTarget,
        bestDay,
      },
      scoreBreakdown: {
        productionScore,
        qualityScore,
        rewardsScore,
        warningPenalty,
      },
      chart: monthlyChart,
      quality: {
        average: avgQuality,
        counts: reviewCounts,
        recent: reviews.slice(0, 5),
      },
      warnings: {
        counts: warningCounts,
        recent: warnings.slice(0, 5),
      },
      rewards: {
        counts: rewardCounts,
        recent: rewards.slice(0, 5),
      },
      wallet: {
        balance: walletBalance,
        recent: walletMoves.slice(0, 5),
      },
    });
  } catch (error) {
    console.error("production dashboard error", error);
    return NextResponse.json(
      { error: "خطأ غير متوقع أثناء تحميل لوحة العامل" },
      { status: 500 },
    );
  }
}
