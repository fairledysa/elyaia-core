// FILE: src/app/api/finance/employees/[employeeId]/actions/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireTenant } from "@/lib/tenant/requireTenant";

export const runtime = "nodejs";

type EmployeeRow = {
  id: string;
  user_id: string;
};

const ALLOWED_TYPES = new Set([
  "advance",
  "deduction",
  "payout",
  "bonus",
  "salary",
  "adjustment",
  "warning",
  "reward",
  "review",
]);

export async function POST(
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

    const { tenantId, role } = await requireTenant({ userId: user.id, sb });

    if (!["owner", "admin"].includes(role)) {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);

    const type = String(body?.type || "").trim();
    const rawAmount = Number(body?.amount ?? 0);
    const note = String(body?.note || "").trim();
    const stageId = body?.stageId ? String(body.stageId).trim() : null;
    const warningType = String(body?.warningType || "other").trim();
    const severity = String(body?.severity || "medium").trim();
    const rewardType = String(body?.rewardType || "other").trim();
    const rating = String(body?.rating || "good").trim();
    const rawScore = Number(body?.score ?? 0);

    if (!ALLOWED_TYPES.has(type)) {
      return NextResponse.json(
        { ok: false, error: "INVALID_TYPE" },
        { status: 400 },
      );
    }

    const { data: employee, error: employeeError } = await admin
      .from("employees")
      .select("id, user_id")
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

    if (
      [
        "advance",
        "deduction",
        "payout",
        "bonus",
        "salary",
        "adjustment",
      ].includes(type)
    ) {
      if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
        return NextResponse.json(
          { ok: false, error: "INVALID_AMOUNT" },
          { status: 400 },
        );
      }

      let amount = Math.abs(rawAmount);

      if (type === "advance" || type === "deduction" || type === "payout") {
        amount = -amount;
      }

      const { data: inserted, error: insertError } = await admin
        .from("wallet_moves")
        .insert({
          tenant_id: tenantId,
          user_id: employee.user_id,
          type,
          amount,
          note,
          reference_id: null,
        })
        .select("id, type, amount, created_at, note")
        .single();

      if (insertError) {
        return NextResponse.json(
          { ok: false, error: insertError.message },
          { status: 500 },
        );
      }

      if (type === "bonus") {
        const { error: rewardError } = await admin
          .from("employee_rewards")
          .insert({
            tenant_id: tenantId,
            employee_id: employee.id,
            stage_id: stageId,
            reward_type: "bonus",
            note: note || `مكافأة مالية بقيمة ${Math.abs(amount)}`,
            reason: "finance_bonus_action",
            issued_by: user.id,
          });

        if (rewardError) {
          return NextResponse.json(
            { ok: false, error: rewardError.message },
            { status: 500 },
          );
        }
      }

      if (type === "deduction") {
        if (body?.createWarning === true) {
          const { error: warningError } = await admin
            .from("employee_warnings")
            .insert({
              tenant_id: tenantId,
              employee_id: employee.id,
              stage_id: stageId,
              warning_type: warningType || "other",
              severity: severity || "medium",
              note: note || `تم تسجيل خصم مالي بقيمة ${Math.abs(amount)}`,
              reason: "finance_deduction_action",
              issued_by: user.id,
            });

          if (warningError) {
            return NextResponse.json(
              { ok: false, error: warningError.message },
              { status: 500 },
            );
          }
        }
      }

      const absAmount = Math.abs(amount);

      let title = "تنبيه";
      let text = "";
      let tone = "indigo";

      if (type === "bonus") {
        title = "مكافأة";
        text = `تم إضافة مكافأة بقيمة ${absAmount} ر.س إلى محفظتك`;
        tone = "emerald";
      }

      if (type === "salary") {
        title = "راتب";
        text = `تم إضافة راتب بقيمة ${absAmount} ر.س`;
        tone = "emerald";
      }

      if (type === "adjustment") {
        title = "تسوية";
        text = `تم تعديل محفظتك بمبلغ ${absAmount} ر.س`;
        tone = "violet";
      }

      if (type === "advance") {
        title = "سلفة";
        text = `تم تسجيل سلفة بقيمة ${absAmount} ر.س`;
        tone = "amber";
      }

      if (type === "deduction") {
        title = "خصم";
        text = `تم خصم ${absAmount} ر.س من محفظتك`;
        tone = "amber";
      }

      if (type === "payout") {
        title = "صرف";
        text = `تم صرف مبلغ ${absAmount} ر.س من محفظتك`;
        tone = "indigo";
      }

      await admin.from("notifications").insert({
        tenant_id: tenantId,
        user_id: employee.user_id,
        title,
        text,
        type: "wallet",
        tone,
      });

      return NextResponse.json({
        ok: true,
        item: inserted,
      });
    }

    if (type === "warning") {
      const { data: inserted, error: insertError } = await admin
        .from("employee_warnings")
        .insert({
          tenant_id: tenantId,
          employee_id: employee.id,
          stage_id: stageId,
          warning_type: warningType || "other",
          severity: severity || "medium",
          note,
          reason: "manual_warning",
          issued_by: user.id,
        })
        .select("id, created_at")
        .single();

      if (insertError) {
        return NextResponse.json(
          { ok: false, error: insertError.message },
          { status: 500 },
        );
      }

      await admin.from("notifications").insert({
        tenant_id: tenantId,
        user_id: employee.user_id,
        title: "تنبيه إداري",
        text: note || "تم تسجيل تنبيه عليك",
        type: "performance",
        tone: "amber",
      });

      return NextResponse.json({ ok: true, item: inserted });
    }

    if (type === "reward") {
      const { data: inserted, error: insertError } = await admin
        .from("employee_rewards")
        .insert({
          tenant_id: tenantId,
          employee_id: employee.id,
          stage_id: stageId,
          reward_type: rewardType || "other",
          note,
          reason: "manual_reward",
          issued_by: user.id,
        })
        .select("id, created_at")
        .single();

      if (insertError) {
        return NextResponse.json(
          { ok: false, error: insertError.message },
          { status: 500 },
        );
      }

      await admin.from("notifications").insert({
        tenant_id: tenantId,
        user_id: employee.user_id,
        title: "إشادة",
        text: note || "تم تسجيل إشادة لك",
        type: "performance",
        tone: "emerald",
      });

      return NextResponse.json({ ok: true, item: inserted });
    }

    if (type === "review") {
      const score =
        Number.isFinite(rawScore) && rawScore >= 0 && rawScore <= 100
          ? rawScore
          : rating === "excellent"
            ? 100
            : rating === "good"
              ? 80
              : rating === "needs_improvement"
                ? 60
                : 40;

      const { data: inserted, error: insertError } = await admin
        .from("employee_reviews")
        .insert({
          tenant_id: tenantId,
          employee_id: employee.id,
          stage_id: stageId,
          rating,
          score,
          note,
          reason: "manual_review",
          reviewed_by: user.id,
        })
        .select("id, created_at")
        .single();

      if (insertError) {
        return NextResponse.json(
          { ok: false, error: insertError.message },
          { status: 500 },
        );
      }

      await admin.from("notifications").insert({
        tenant_id: tenantId,
        user_id: employee.user_id,
        title: "تقييم إداري",
        text: note || "تم تحديث تقييمك الإداري",
        type: "performance",
        tone: "indigo",
      });

      return NextResponse.json({ ok: true, item: inserted });
    }

    return NextResponse.json(
      { ok: false, error: "INVALID_TYPE" },
      { status: 400 },
    );
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
