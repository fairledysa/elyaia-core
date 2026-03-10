// FILE: src/app/api/finance/employees/[employeeId]/route.ts

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
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

type StageRow = {
  id: string;
  name: string;
};

type WalletMoveRow = {
  user_id: string;
  type: string;
  amount: number;
  created_at: string | null;
};

type StageEventRow = {
  user_id: string;
};

function isCredit(type: string, amount: number) {
  if (amount > 0) return true;
  return type === "stage_earning" || type === "bonus" || type === "salary";
}

function isDebit(type: string, amount: number) {
  if (amount < 0) return true;
  return type === "advance" || type === "deduction";
}

function isPayout(type: string) {
  return type === "payout";
}

export async function GET(
  _req: NextRequest,
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
      .select("id, user_id, stage_id, active, pay_type")
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

    const [
      { data: profile },
      { data: stage },
      { data: moves },
      { data: events },
    ] = await Promise.all([
      admin
        .from("profiles")
        .select("id, full_name, phone")
        .eq("id", employee.user_id)
        .maybeSingle<ProfileRow>(),
      employee.stage_id
        ? admin
            .from("stages")
            .select("id, name")
            .eq("id", employee.stage_id)
            .maybeSingle<StageRow>()
        : Promise.resolve({ data: null, error: null }),
      admin
        .from("wallet_moves")
        .select("user_id, type, amount, created_at")
        .eq("tenant_id", tenantId)
        .eq("user_id", employee.user_id),
      admin
        .from("stage_events")
        .select("user_id")
        .eq("tenant_id", tenantId)
        .eq("user_id", employee.user_id),
    ]);

    let credit = 0;
    let debit = 0;
    let payout = 0;
    let lastMoveAt: string | null = null;

    for (const move of (moves ?? []) as WalletMoveRow[]) {
      const amount = Number(move.amount || 0);
      const abs = Math.abs(amount);

      if (isPayout(move.type)) {
        payout += abs;
      } else if (isCredit(move.type, amount)) {
        credit += abs;
      } else if (isDebit(move.type, amount)) {
        debit += abs;
      }

      if (!lastMoveAt || (move.created_at && move.created_at > lastMoveAt)) {
        lastMoveAt = move.created_at;
      }
    }

    const balance = credit - debit - payout;

    return NextResponse.json({
      ok: true,
      employee: {
        employeeId: employee.id,
        userId: employee.user_id,
        name: profile?.full_name ?? null,
        phone: profile?.phone ?? null,
        stageName: stage?.name ?? null,
        payType: employee.pay_type ?? null,
        active: employee.active ?? null,
        completedCount: ((events ?? []) as StageEventRow[]).length,
        credit,
        debit,
        payout,
        balance,
        lastMoveAt,
      },
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
