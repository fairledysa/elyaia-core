// FILE: src/app/api/finance/payouts/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireTenant } from "@/lib/tenant/requireTenant";

export const runtime = "nodejs";

type EmployeeRow = {
  user_id: string;
};

export async function POST(req: NextRequest) {
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

    const { tenantId } = await requireTenant({
      userId: user.id,
      sb,
    });

    const body = await req.json().catch(() => null);
    const employeeId = String(body?.employeeId || "").trim();
    const amount = Number(body?.amount ?? 0);

    if (!employeeId) {
      return NextResponse.json(
        { ok: false, error: "EMPLOYEE_ID_REQUIRED" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { ok: false, error: "INVALID_AMOUNT" },
        { status: 400 },
      );
    }

    const { data: employee, error: employeeError } = await admin
      .from("employees")
      .select("user_id")
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

    const { error: insertError } = await admin.from("wallet_moves").insert({
      tenant_id: tenantId,
      user_id: employee.user_id,
      type: "payout",
      amount: -Math.abs(amount),
    });

    if (insertError) {
      return NextResponse.json(
        { ok: false, error: insertError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
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
