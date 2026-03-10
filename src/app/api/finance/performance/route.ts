// FILE: src/app/api/finance/performance/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireTenant } from "@/lib/tenant/requireTenant";

export const runtime = "nodejs";

type StageRow = {
  id: string;
  name: string;
  sort_order: number;
};

type StageEventRow = {
  id: string;
  stage_id: string;
  user_id: string;
  created_at: string | null;
};

type ReviewRow = {
  id: string;
  employee_id: string;
  stage_id: string | null;
  rating: "excellent" | "good" | "needs_improvement" | "poor";
  score: number | null;
  created_at: string | null;
};

type WarningRow = {
  id: string;
  employee_id: string;
  stage_id: string | null;
  warning_type: string;
  created_at: string | null;
};

type RewardRow = {
  id: string;
  employee_id: string;
  stage_id: string | null;
  reward_type: string;
  created_at: string | null;
};

type EmployeeRow = {
  id: string;
  user_id: string;
  active: boolean | null;
  stage_id: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

function toIsoStart(value: string | null) {
  if (!value) return null;
  return `${value}T00:00:00.000Z`;
}

function toIsoEnd(value: string | null) {
  if (!value) return null;
  return `${value}T23:59:59.999Z`;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function avg(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function scoreFromRating(value: string | null | undefined) {
  if (value === "excellent") return 100;
  if (value === "good") return 80;
  if (value === "needs_improvement") return 60;
  if (value === "poor") return 40;
  return 0;
}

function mapWarningType(value: string | null | undefined) {
  if (value === "lateness") return "تأخير";
  if (value === "quality") return "جودة";
  if (value === "behavior") return "سلوك";
  if (value === "absence") return "غياب";
  if (value === "other") return "أخرى";
  return value || "-";
}

function mapRewardType(value: string | null | undefined) {
  if (value === "praise") return "إشادة";
  if (value === "commitment") return "التزام";
  if (value === "discipline") return "انضباط";
  if (value === "speed") return "سرعة";
  if (value === "quality") return "جودة";
  if (value === "bonus") return "مكافأة";
  if (value === "other") return "أخرى";
  return value || "-";
}

function getMonthBounds(monthValue: string | null) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();

  if (monthValue && /^\d{4}-\d{2}$/.test(monthValue)) {
    year = Number(monthValue.slice(0, 4));
    month = Number(monthValue.slice(5, 7)) - 1;
  }

  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  return {
    monthKey: `${year}-${String(month + 1).padStart(2, "0")}`,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    daysInMonth: new Date(Date.UTC(year, month + 1, 0)).getUTCDate(),
  };
}

function dayFromIso(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCDate();
}

export async function GET(req: NextRequest) {
  try {
    const sb = await createSupabaseServerClient();
    const admin = createSupabaseAdminClient();

    const {
      data: { user },
      error: userError,
    } = await sb.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const { tenantId } = await requireTenant({ userId: user.id, sb });

    const searchParams = req.nextUrl.searchParams;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const employeeId = searchParams.get("employeeId");
    const stageId = searchParams.get("stageId");
    const active = searchParams.get("active");
    const month = searchParams.get("month");

    const fromIso = toIsoStart(from);
    const toIso = toIsoEnd(to);
    const monthBounds = getMonthBounds(month);

    const [
      { data: stages, error: stagesError },
      { data: employees, error: employeesError },
    ] = await Promise.all([
      admin
        .from("stages")
        .select("id, name, sort_order")
        .eq("tenant_id", tenantId)
        .eq("archived", false)
        .order("sort_order", { ascending: true }),
      admin
        .from("employees")
        .select("id, user_id, active, stage_id")
        .eq("tenant_id", tenantId),
    ]);

    if (stagesError) {
      return NextResponse.json(
        { ok: false, error: stagesError.message },
        { status: 500 },
      );
    }

    if (employeesError) {
      return NextResponse.json(
        { ok: false, error: employeesError.message },
        { status: 500 },
      );
    }

    let filteredEmployees = (employees ?? []) as EmployeeRow[];

    if (active === "active") {
      filteredEmployees = filteredEmployees.filter(
        (item) => item.active === true,
      );
    } else if (active === "inactive") {
      filteredEmployees = filteredEmployees.filter(
        (item) => item.active === false,
      );
    }

    if (employeeId) {
      filteredEmployees = filteredEmployees.filter(
        (item) => item.id === employeeId,
      );
    }

    const employeeIds = filteredEmployees.map((item) => item.id);
    const userIds = filteredEmployees.map((item) => item.user_id);

    if (!employeeIds.length || !userIds.length) {
      return NextResponse.json({
        ok: true,
        filters: {
          from: from || null,
          to: to || null,
          employeeId: employeeId || null,
          stageId: stageId || null,
          active: active || "all",
          month: monthBounds.monthKey,
        },
        charts: {
          completedByStage: [],
          qualityByStage: [],
          behaviorByStage: [],
          warningsByType: [],
          rewardsByType: [],
          employeesRanking: [],
          employeeMonthlyProduction: [],
        },
        summary: {
          totalCompleted: 0,
          avgQualityScore: 0,
          warningsCount: 0,
          rewardsCount: 0,
          employeesCount: 0,
        },
        employeeMonthlyProduction: null,
        employees: [],
        stages: ((stages ?? []) as StageRow[]).map((item) => ({
          id: item.id,
          name: item.name,
        })),
        ranking: [],
      });
    }

    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    if (profilesError) {
      return NextResponse.json(
        { ok: false, error: profilesError.message },
        { status: 500 },
      );
    }

    let stageEventsQuery = admin
      .from("stage_events")
      .select("id, stage_id, user_id, created_at")
      .eq("tenant_id", tenantId)
      .in("user_id", userIds);

    let reviewsQuery = admin
      .from("employee_reviews")
      .select("id, employee_id, stage_id, rating, score, created_at")
      .eq("tenant_id", tenantId)
      .in("employee_id", employeeIds);

    let warningsQuery = admin
      .from("employee_warnings")
      .select("id, employee_id, stage_id, warning_type, created_at")
      .eq("tenant_id", tenantId)
      .in("employee_id", employeeIds);

    let rewardsQuery = admin
      .from("employee_rewards")
      .select("id, employee_id, stage_id, reward_type, created_at")
      .eq("tenant_id", tenantId)
      .in("employee_id", employeeIds);

    if (stageId) {
      stageEventsQuery = stageEventsQuery.eq("stage_id", stageId);
      reviewsQuery = reviewsQuery.eq("stage_id", stageId);
      warningsQuery = warningsQuery.eq("stage_id", stageId);
      rewardsQuery = rewardsQuery.eq("stage_id", stageId);
    }

    if (fromIso) {
      stageEventsQuery = stageEventsQuery.gte("created_at", fromIso);
      reviewsQuery = reviewsQuery.gte("created_at", fromIso);
      warningsQuery = warningsQuery.gte("created_at", fromIso);
      rewardsQuery = rewardsQuery.gte("created_at", fromIso);
    }

    if (toIso) {
      stageEventsQuery = stageEventsQuery.lte("created_at", toIso);
      reviewsQuery = reviewsQuery.lte("created_at", toIso);
      warningsQuery = warningsQuery.lte("created_at", toIso);
      rewardsQuery = rewardsQuery.lte("created_at", toIso);
    }

    const [
      { data: stageEvents, error: stageEventsError },
      { data: reviews, error: reviewsError },
      { data: warnings, error: warningsError },
      { data: rewards, error: rewardsError },
    ] = await Promise.all([
      stageEventsQuery,
      reviewsQuery,
      warningsQuery,
      rewardsQuery,
    ]);

    if (stageEventsError) {
      return NextResponse.json(
        { ok: false, error: stageEventsError.message },
        { status: 500 },
      );
    }

    if (reviewsError) {
      return NextResponse.json(
        { ok: false, error: reviewsError.message },
        { status: 500 },
      );
    }

    if (warningsError) {
      return NextResponse.json(
        { ok: false, error: warningsError.message },
        { status: 500 },
      );
    }

    if (rewardsError) {
      return NextResponse.json(
        { ok: false, error: rewardsError.message },
        { status: 500 },
      );
    }

    const stageRows = (stages ?? []) as StageRow[];
    const profileRows = (profiles ?? []) as ProfileRow[];
    const employeeRows = filteredEmployees;
    const stageEventRows = (stageEvents ?? []) as StageEventRow[];
    const reviewRows = (reviews ?? []) as ReviewRow[];
    const warningRows = (warnings ?? []) as WarningRow[];
    const rewardRows = (rewards ?? []) as RewardRow[];

    const stageMap = new Map(stageRows.map((item) => [item.id, item]));
    const profileMap = new Map(profileRows.map((item) => [item.id, item]));
    const employeeByUserId = new Map(
      employeeRows.map((item) => [item.user_id, item]),
    );

    const employeeStatsMap = new Map<
      string,
      {
        employeeId: string;
        userId: string;
        name: string;
        completedCount: number;
        qualityScores: number[];
        warningCount: number;
        rewardCount: number;
      }
    >();

    function ensureEmployeeStatByEmployeeId(targetEmployeeId: string) {
      const employee = employeeRows.find(
        (item) => item.id === targetEmployeeId,
      );
      if (!employee) return null;

      const profile = profileMap.get(employee.user_id);

      if (!employeeStatsMap.has(targetEmployeeId)) {
        employeeStatsMap.set(targetEmployeeId, {
          employeeId: employee.id,
          userId: employee.user_id,
          name: profile?.full_name ?? "بدون اسم",
          completedCount: 0,
          qualityScores: [],
          warningCount: 0,
          rewardCount: 0,
        });
      }

      return employeeStatsMap.get(targetEmployeeId)!;
    }

    const stageStatsMap = new Map<
      string,
      {
        stageId: string;
        stageName: string;
        sortOrder: number;
        completedCount: number;
        qualityScores: number[];
        warningCount: number;
        rewardCount: number;
      }
    >();

    function ensureStageStat(targetStageId: string) {
      const stage = stageMap.get(targetStageId);
      const stageName = stage?.name ?? "مرحلة";
      const sortOrder = stage?.sort_order ?? 999999;

      if (!stageStatsMap.has(targetStageId)) {
        stageStatsMap.set(targetStageId, {
          stageId: targetStageId,
          stageName,
          sortOrder,
          completedCount: 0,
          qualityScores: [],
          warningCount: 0,
          rewardCount: 0,
        });
      }

      return stageStatsMap.get(targetStageId)!;
    }

    const warningsByTypeMap = new Map<string, number>();
    const rewardsByTypeMap = new Map<string, number>();

    for (const event of stageEventRows) {
      const employee = employeeByUserId.get(event.user_id);
      if (!employee) continue;

      const employeeStat = ensureEmployeeStatByEmployeeId(employee.id);
      if (employeeStat) {
        employeeStat.completedCount += 1;
      }

      const stageStat = ensureStageStat(event.stage_id);
      stageStat.completedCount += 1;
    }

    for (const review of reviewRows) {
      const employeeStat = ensureEmployeeStatByEmployeeId(review.employee_id);
      const reviewScore =
        typeof review.score === "number" && Number.isFinite(review.score)
          ? Number(review.score)
          : scoreFromRating(review.rating);

      if (employeeStat) {
        employeeStat.qualityScores.push(reviewScore);
      }

      if (review.stage_id) {
        const stageStat = ensureStageStat(review.stage_id);
        stageStat.qualityScores.push(reviewScore);
      }
    }

    for (const warning of warningRows) {
      const employeeStat = ensureEmployeeStatByEmployeeId(warning.employee_id);
      if (employeeStat) {
        employeeStat.warningCount += 1;
      }

      if (warning.stage_id) {
        const stageStat = ensureStageStat(warning.stage_id);
        stageStat.warningCount += 1;
      }

      warningsByTypeMap.set(
        warning.warning_type,
        (warningsByTypeMap.get(warning.warning_type) ?? 0) + 1,
      );
    }

    for (const reward of rewardRows) {
      const employeeStat = ensureEmployeeStatByEmployeeId(reward.employee_id);
      if (employeeStat) {
        employeeStat.rewardCount += 1;
      }

      if (reward.stage_id) {
        const stageStat = ensureStageStat(reward.stage_id);
        stageStat.rewardCount += 1;
      }

      rewardsByTypeMap.set(
        reward.reward_type,
        (rewardsByTypeMap.get(reward.reward_type) ?? 0) + 1,
      );
    }

    const stagePerformance = Array.from(stageStatsMap.values())
      .map((item) => ({
        stageId: item.stageId,
        stageName: item.stageName,
        sortOrder: item.sortOrder,
        completedCount: item.completedCount,
        qualityScore: round2(avg(item.qualityScores)),
        warningCount: item.warningCount,
        rewardCount: item.rewardCount,
      }))
      .sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.stageName.localeCompare(b.stageName, "ar");
      });

    const employeesRanking = Array.from(employeeStatsMap.values())
      .map((item) => {
        const qualityScore = round2(avg(item.qualityScores));
        const score = round2(
          item.completedCount * 0.5 +
            qualityScore * 0.35 +
            item.rewardCount * 5 -
            item.warningCount * 5,
        );

        return {
          employeeId: item.employeeId,
          userId: item.userId,
          name: item.name,
          completedCount: item.completedCount,
          qualityScore,
          warningCount: item.warningCount,
          rewardCount: item.rewardCount,
          score,
        };
      })
      .sort((a, b) => b.score - a.score);

    const totalCompleted = stagePerformance.reduce(
      (sum, item) => sum + item.completedCount,
      0,
    );

    const avgQualityScore = round2(
      avg(
        stagePerformance
          .map((item) => item.qualityScore)
          .filter((item) => item > 0),
      ),
    );

    let employeeMonthlyProduction: {
      employeeId: string;
      employeeName: string;
      month: string;
      total: number;
      series: Array<{ day: number; label: string; value: number }>;
    } | null = null;

    if (employeeId && employeeId !== "all") {
      const selectedEmployee = employeeRows.find(
        (item) => item.id === employeeId,
      );

      if (selectedEmployee) {
        let monthlyQuery = admin
          .from("stage_events")
          .select("id, created_at, user_id, stage_id")
          .eq("tenant_id", tenantId)
          .eq("user_id", selectedEmployee.user_id)
          .gte("created_at", monthBounds.startIso)
          .lte("created_at", monthBounds.endIso);

        if (stageId) {
          monthlyQuery = monthlyQuery.eq("stage_id", stageId);
        }

        const { data: monthlyEvents, error: monthlyError } = await monthlyQuery;

        if (monthlyError) {
          return NextResponse.json(
            { ok: false, error: monthlyError.message },
            { status: 500 },
          );
        }

        const series = Array.from(
          { length: monthBounds.daysInMonth },
          (_, index) => ({
            day: index + 1,
            label: `${index + 1}/${monthBounds.monthKey.slice(5, 7)}`,
            value: 0,
          }),
        );

        for (const item of (monthlyEvents ?? []) as StageEventRow[]) {
          const day = dayFromIso(item.created_at);
          if (!day || !series[day - 1]) continue;
          series[day - 1].value += 1;
        }

        employeeMonthlyProduction = {
          employeeId: selectedEmployee.id,
          employeeName:
            profileMap.get(selectedEmployee.user_id)?.full_name ?? "بدون اسم",
          month: monthBounds.monthKey,
          total: series.reduce((sum, item) => sum + item.value, 0),
          series,
        };
      }
    }

    return NextResponse.json({
      ok: true,
      filters: {
        from: from || null,
        to: to || null,
        employeeId: employeeId || null,
        stageId: stageId || null,
        active: active || "all",
        month: monthBounds.monthKey,
      },
      summary: {
        totalCompleted,
        avgQualityScore,
        warningsCount: warningRows.length,
        rewardsCount: rewardRows.length,
        employeesCount: employeeRows.length,
      },
      charts: {
        completedByStage: stagePerformance.map((item) => ({
          stage: item.stageName,
          value: item.completedCount,
        })),
        qualityByStage: stagePerformance.map((item) => ({
          stage: item.stageName,
          value: item.qualityScore,
        })),
        behaviorByStage: stagePerformance.map((item) => ({
          stage: item.stageName,
          warnings: item.warningCount,
          rewards: item.rewardCount,
        })),
        warningsByType: Array.from(warningsByTypeMap.entries()).map(
          ([type, value]) => ({
            type,
            label: mapWarningType(type),
            value,
          }),
        ),
        rewardsByType: Array.from(rewardsByTypeMap.entries()).map(
          ([type, value]) => ({
            type,
            label: mapRewardType(type),
            value,
          }),
        ),
        employeesRanking: employeesRanking.map((item) => ({
          employeeId: item.employeeId,
          name: item.name,
          score: item.score,
          completedCount: item.completedCount,
          qualityScore: item.qualityScore,
          warningCount: item.warningCount,
          rewardCount: item.rewardCount,
        })),
        employeeMonthlyProduction: employeeMonthlyProduction?.series ?? [],
      },
      employeeMonthlyProduction,
      employees: employeeRows.map((item) => ({
        id: item.id,
        userId: item.user_id,
        name: profileMap.get(item.user_id)?.full_name ?? "بدون اسم",
        active: item.active ?? null,
        stageId: item.stage_id ?? null,
        stageName: item.stage_id
          ? (stageMap.get(item.stage_id)?.name ?? null)
          : null,
      })),
      stages: stageRows.map((item) => ({
        id: item.id,
        name: item.name,
      })),
      stagePerformance: stagePerformance.map((item) => ({
        stageId: item.stageId,
        stageName: item.stageName,
        completedCount: item.completedCount,
        qualityScore: item.qualityScore,
        warningCount: item.warningCount,
        rewardCount: item.rewardCount,
      })),
      ranking: employeesRanking,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
