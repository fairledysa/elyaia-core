// FILE: src/app/api/finance/employees/[employeeId]/performance/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireTenant } from "@/lib/tenant/requireTenant";

export const runtime = "nodejs";

type EmployeeRow = {
  id: string;
  user_id: string;
  stage_id: string | null;
  active: boolean | null;
  pay_type: string | null;
  created_at: string | null;
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
  sort_order: number;
};

type StageEventRow = {
  id: string;
  stage_id: string;
  created_at: string | null;
};

type ReviewRow = {
  id: string;
  stage_id: string | null;
  rating: "excellent" | "good" | "needs_improvement" | "poor";
  score: number | null;
  note: string | null;
  reason: string | null;
  created_at: string | null;
};

type WarningRow = {
  id: string;
  stage_id: string | null;
  warning_type: string;
  severity: "low" | "medium" | "high" | null;
  note: string | null;
  reason: string | null;
  created_at: string | null;
};

type RewardRow = {
  id: string;
  stage_id: string | null;
  reward_type: string;
  note: string | null;
  reason: string | null;
  created_at: string | null;
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

function mapRatingLabel(value: string | null | undefined) {
  if (value === "excellent") return "ممتاز";
  if (value === "good") return "جيد";
  if (value === "needs_improvement") return "يحتاج تحسين";
  if (value === "poor") return "ضعيف";
  return "-";
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

function mapSeverity(value: string | null | undefined) {
  if (value === "low") return "منخفض";
  if (value === "medium") return "متوسط";
  if (value === "high") return "عالي";
  return "-";
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

type StageMetric = {
  stageId: string;
  stageName: string;
  sortOrder: number;
  completedCount: number;
  reviewScores: number[];
  warningCount: number;
  rewardCount: number;
};

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ employeeId: string }> },
) {
  try {
    const { employeeId } = await ctx.params;

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

    const { data: employee, error: employeeError } = await admin
      .from("employees")
      .select("id, user_id, stage_id, active, pay_type, created_at")
      .eq("tenant_id", tenantId)
      .eq("id", employeeId)
      .maybeSingle<EmployeeRow>();

    if (employeeError) {
      return NextResponse.json(
        { ok: false, error: employeeError.message },
        { status: 500 },
      );
    }

    if (!employee) {
      return NextResponse.json(
        { ok: false, error: "EMPLOYEE_NOT_FOUND" },
        { status: 404 },
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const fromIso = toIsoStart(from);
    const toIso = toIsoEnd(to);

    const [
      { data: profile, error: profileError },
      { data: stages, error: stagesError },
    ] = await Promise.all([
      admin
        .from("profiles")
        .select("id, full_name, phone, email")
        .eq("id", employee.user_id)
        .maybeSingle<ProfileRow>(),
      admin
        .from("stages")
        .select("id, name, sort_order")
        .eq("tenant_id", tenantId)
        .eq("archived", false)
        .order("sort_order", { ascending: true }),
    ]);

    if (profileError) {
      return NextResponse.json(
        { ok: false, error: profileError.message },
        { status: 500 },
      );
    }

    if (stagesError) {
      return NextResponse.json(
        { ok: false, error: stagesError.message },
        { status: 500 },
      );
    }

    let stageEventsQuery = admin
      .from("stage_events")
      .select("id, stage_id, created_at")
      .eq("tenant_id", tenantId)
      .eq("user_id", employee.user_id);

    let reviewsQuery = admin
      .from("employee_reviews")
      .select("id, stage_id, rating, score, note, reason, created_at")
      .eq("tenant_id", tenantId)
      .eq("employee_id", employee.id)
      .order("created_at", { ascending: false });

    let warningsQuery = admin
      .from("employee_warnings")
      .select("id, stage_id, warning_type, severity, note, reason, created_at")
      .eq("tenant_id", tenantId)
      .eq("employee_id", employee.id)
      .order("created_at", { ascending: false });

    let rewardsQuery = admin
      .from("employee_rewards")
      .select("id, stage_id, reward_type, note, reason, created_at")
      .eq("tenant_id", tenantId)
      .eq("employee_id", employee.id)
      .order("created_at", { ascending: false });

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
    const stageMap = new Map(stageRows.map((stage) => [stage.id, stage]));

    const metricsMap = new Map<string, StageMetric>();

    function ensureMetric(stageId: string) {
      const stage = stageMap.get(stageId);
      const stageName = stage?.name ?? "مرحلة";
      const sortOrder = stage?.sort_order ?? 999999;

      if (!metricsMap.has(stageId)) {
        metricsMap.set(stageId, {
          stageId,
          stageName,
          sortOrder,
          completedCount: 0,
          reviewScores: [],
          warningCount: 0,
          rewardCount: 0,
        });
      }

      return metricsMap.get(stageId)!;
    }

    for (const event of (stageEvents ?? []) as StageEventRow[]) {
      if (!event.stage_id) continue;
      const metric = ensureMetric(event.stage_id);
      metric.completedCount += 1;
    }

    for (const review of (reviews ?? []) as ReviewRow[]) {
      if (!review.stage_id) continue;
      const metric = ensureMetric(review.stage_id);
      const finalScore =
        typeof review.score === "number" && Number.isFinite(review.score)
          ? Number(review.score)
          : scoreFromRating(review.rating);
      metric.reviewScores.push(finalScore);
    }

    for (const warning of (warnings ?? []) as WarningRow[]) {
      if (!warning.stage_id) continue;
      const metric = ensureMetric(warning.stage_id);
      metric.warningCount += 1;
    }

    for (const reward of (rewards ?? []) as RewardRow[]) {
      if (!reward.stage_id) continue;
      const metric = ensureMetric(reward.stage_id);
      metric.rewardCount += 1;
    }

    const stagePerformance = Array.from(metricsMap.values())
      .map((item) => {
        const qualityScore = round2(avg(item.reviewScores));
        const reviewScore = qualityScore;

        return {
          stageId: item.stageId,
          stageName: item.stageName,
          sortOrder: item.sortOrder,
          completedCount: item.completedCount,
          qualityScore,
          warningCount: item.warningCount,
          rewardCount: item.rewardCount,
          reviewScore,
        };
      })
      .sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.stageName.localeCompare(b.stageName, "ar");
      });

    const totalCompleted = stagePerformance.reduce(
      (sum, item) => sum + item.completedCount,
      0,
    );

    const warningsCount = ((warnings ?? []) as WarningRow[]).length;
    const rewardsCount = ((rewards ?? []) as RewardRow[]).length;

    const avgQualityScore = round2(
      avg(
        stagePerformance
          .map((item) => item.qualityScore)
          .filter((value) => value > 0),
      ),
    );

    const bestStage =
      [...stagePerformance].sort((a, b) => {
        if (b.completedCount !== a.completedCount) {
          return b.completedCount - a.completedCount;
        }
        if (b.reviewScore !== a.reviewScore) {
          return b.reviewScore - a.reviewScore;
        }
        return a.sortOrder - b.sortOrder;
      })[0] ?? null;

    const lastReview = ((reviews ?? []) as ReviewRow[])[0] ?? null;

    const warningTypeMap = new Map<string, number>();
    for (const item of (warnings ?? []) as WarningRow[]) {
      const key = item.warning_type || "other";
      warningTypeMap.set(key, (warningTypeMap.get(key) ?? 0) + 1);
    }

    const rewardTypeMap = new Map<string, number>();
    for (const item of (rewards ?? []) as RewardRow[]) {
      const key = item.reward_type || "other";
      rewardTypeMap.set(key, (rewardTypeMap.get(key) ?? 0) + 1);
    }

    return NextResponse.json({
      ok: true,
      employee: {
        employeeId: employee.id,
        userId: employee.user_id,
        name: profile?.full_name ?? null,
        phone: profile?.phone ?? null,
        email: profile?.email ?? null,
        active: employee.active ?? null,
        payType: employee.pay_type ?? null,
        joinedAt: employee.created_at ?? null,
      },
      summary: {
        totalCompleted,
        avgQualityScore,
        warningsCount,
        rewardsCount,
        bestStageName: bestStage?.stageName ?? null,
        lastReviewRating: lastReview?.rating ?? null,
        lastReviewRatingLabel: mapRatingLabel(lastReview?.rating ?? null),
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
        warningsByType: Array.from(warningTypeMap.entries()).map(
          ([type, count]) => ({
            type,
            label: mapWarningType(type),
            value: count,
          }),
        ),
        rewardsByType: Array.from(rewardTypeMap.entries()).map(
          ([type, count]) => ({
            type,
            label: mapRewardType(type),
            value: count,
          }),
        ),
      },
      stagePerformance: stagePerformance.map((item) => ({
        stageId: item.stageId,
        stageName: item.stageName,
        completedCount: item.completedCount,
        qualityScore: item.qualityScore,
        warningCount: item.warningCount,
        rewardCount: item.rewardCount,
        reviewScore: item.reviewScore,
      })),
      reviews: ((reviews ?? []) as ReviewRow[]).map((item) => ({
        id: item.id,
        stageId: item.stage_id,
        stageName: item.stage_id
          ? (stageMap.get(item.stage_id)?.name ?? "مرحلة")
          : null,
        rating: item.rating,
        ratingLabel: mapRatingLabel(item.rating),
        score:
          typeof item.score === "number" && Number.isFinite(item.score)
            ? Number(item.score)
            : scoreFromRating(item.rating),
        note: item.note ?? null,
        reason: item.reason ?? null,
        createdAt: item.created_at,
      })),
      warnings: ((warnings ?? []) as WarningRow[]).map((item) => ({
        id: item.id,
        stageId: item.stage_id,
        stageName: item.stage_id
          ? (stageMap.get(item.stage_id)?.name ?? "مرحلة")
          : null,
        warningType: item.warning_type,
        warningTypeLabel: mapWarningType(item.warning_type),
        severity: item.severity ?? null,
        severityLabel: mapSeverity(item.severity),
        note: item.note ?? null,
        reason: item.reason ?? null,
        createdAt: item.created_at,
      })),
      rewards: ((rewards ?? []) as RewardRow[]).map((item) => ({
        id: item.id,
        stageId: item.stage_id,
        stageName: item.stage_id
          ? (stageMap.get(item.stage_id)?.name ?? "مرحلة")
          : null,
        rewardType: item.reward_type,
        rewardTypeLabel: mapRewardType(item.reward_type),
        note: item.note ?? null,
        reason: item.reason ?? null,
        createdAt: item.created_at,
      })),
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
