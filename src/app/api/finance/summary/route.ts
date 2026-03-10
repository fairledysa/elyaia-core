// FILE: src/app/api/finance/summary/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireTenant } from "@/lib/tenant/requireTenant";

export const runtime = "nodejs";

type WalletMoveRow = {
  type: string;
  amount: number;
};

type EmployeeRow = {
  id: string;
};

function toIsoStart(value: string | null) {
  if (!value) return null;
  return `${value}T00:00:00.000Z`;
}

function toIsoEnd(value: string | null) {
  if (!value) return null;
  return `${value}T23:59:59.999Z`;
}

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

    let walletQuery = admin
      .from("wallet_moves")
      .select("type, amount")
      .eq("tenant_id", tenantId);

    const fromIso = toIsoStart(from);
    const toIso = toIsoEnd(to);

    if (fromIso) walletQuery = walletQuery.gte("created_at", fromIso);
    if (toIso) walletQuery = walletQuery.lte("created_at", toIso);

    const [
      { data: moves, error: movesError },
      { data: employees, error: employeesError },
    ] = await Promise.all([
      walletQuery,
      admin
        .from("employees")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("active", true),
    ]);

    if (movesError) {
      return NextResponse.json(
        { ok: false, error: movesError.message },
        { status: 500 },
      );
    }

    if (employeesError) {
      return NextResponse.json(
        { ok: false, error: employeesError.message },
        { status: 500 },
      );
    }

    let totalCredit = 0;
    let totalDebit = 0;
    let totalPayout = 0;

    for (const move of (moves ?? []) as WalletMoveRow[]) {
      const amount = Number(move.amount || 0);
      const abs = Math.abs(amount);

      if (isPayout(move.type)) {
        totalPayout += abs;
        continue;
      }

      if (isCredit(move.type, amount)) {
        totalCredit += abs;
        continue;
      }

      if (isDebit(move.type, amount)) {
        totalDebit += abs;
      }
    }

    const balance = totalCredit - totalDebit - totalPayout;

    return NextResponse.json({
      ok: true,
      summary: {
        totalCredit,
        totalDebit,
        totalPayout,
        balance,
        employeeCount: ((employees ?? []) as EmployeeRow[]).length,
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
