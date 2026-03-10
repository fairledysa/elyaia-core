// FILE: src/app/api/finance/employees/[employeeId]/moves/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireTenant } from "@/lib/tenant/requireTenant";

export const runtime = "nodejs";

type EmployeeRow = {
  id: string;
  user_id: string;
};

type WalletMoveRow = {
  id: string;
  type: string;
  amount: number;
  created_at: string | null;
  reference_id: string | null;
  note: string | null;
};

function toIsoStart(value: string | null) {
  if (!value) return null;
  return `${value}T00:00:00.000Z`;
}

function toIsoEnd(value: string | null) {
  if (!value) return null;
  return `${value}T23:59:59.999Z`;
}

function moveDirection(type: string, amount: number): "plus" | "minus" {
  if (type === "advance" || type === "deduction" || type === "payout") {
    return "minus";
  }
  if (amount < 0) return "minus";
  return "plus";
}

function moveLabel(type: string) {
  if (type === "stage_earning") return "دخل مرحلة";
  if (type === "bonus") return "مكافأة";
  if (type === "advance") return "سلفة";
  if (type === "deduction") return "خصم";
  if (type === "payout") return "صرف";
  if (type === "salary") return "راتب";
  if (type === "adjustment") return "تسوية";
  return type || "-";
}

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

    const searchParams = req.nextUrl.searchParams;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const fromIso = toIsoStart(from);
    const toIso = toIsoEnd(to);

    let query = admin
      .from("wallet_moves")
      .select("id, type, amount, created_at, reference_id, note")
      .eq("tenant_id", tenantId)
      .eq("user_id", employee.user_id)
      .order("created_at", { ascending: false });

    if (fromIso) query = query.gte("created_at", fromIso);
    if (toIso) query = query.lte("created_at", toIso);

    const { data: moves, error: movesError } = await query;

    if (movesError) {
      return NextResponse.json(
        { ok: false, error: movesError.message },
        { status: 500 },
      );
    }

    const items = ((moves ?? []) as WalletMoveRow[]).map((move) => ({
      id: move.id,
      createdAt: move.created_at,
      type: move.type,
      amount: Number(move.amount || 0),
      direction: moveDirection(move.type, Number(move.amount || 0)),
      label: moveLabel(move.type),
      note:
        move.note ?? (move.reference_id ? `مرجع: ${move.reference_id}` : "-"),
    }));

    return NextResponse.json({
      ok: true,
      items,
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
