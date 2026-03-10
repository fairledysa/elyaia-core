// FILE: src/app/api/finance/employees/route.ts

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
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const fromIso = toIsoStart(from);
    const toIso = toIsoEnd(to);

    const { data: employees, error: employeesError } = await admin
      .from("employees")
      .select("id, user_id, stage_id, active, pay_type")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (employeesError) {
      return NextResponse.json(
        { ok: false, error: employeesError.message },
        { status: 500 },
      );
    }

    const employeeRows = (employees ?? []) as EmployeeRow[];
    const userIds = [...new Set(employeeRows.map((e) => e.user_id))];
    const stageIds = [
      ...new Set(employeeRows.map((e) => e.stage_id).filter(Boolean)),
    ] as string[];

    const [profilesResult, stagesResult] = await Promise.all([
      userIds.length
        ? admin
            .from("profiles")
            .select("id, full_name, phone")
            .in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
      stageIds.length
        ? admin.from("stages").select("id, name").in("id", stageIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (profilesResult.error) {
      return NextResponse.json(
        { ok: false, error: profilesResult.error.message },
        { status: 500 },
      );
    }

    if (stagesResult.error) {
      return NextResponse.json(
        { ok: false, error: stagesResult.error.message },
        { status: 500 },
      );
    }

    let walletQuery = admin
      .from("wallet_moves")
      .select("user_id, type, amount, created_at")
      .eq("tenant_id", tenantId);

    let stageEventsQuery = admin
      .from("stage_events")
      .select("user_id")
      .eq("tenant_id", tenantId);

    if (userIds.length) {
      walletQuery = walletQuery.in("user_id", userIds);
      stageEventsQuery = stageEventsQuery.in("user_id", userIds);
    }

    if (fromIso) {
      walletQuery = walletQuery.gte("created_at", fromIso);
      stageEventsQuery = stageEventsQuery.gte("created_at", fromIso);
    }

    if (toIso) {
      walletQuery = walletQuery.lte("created_at", toIso);
      stageEventsQuery = stageEventsQuery.lte("created_at", toIso);
    }

    const [
      { data: moves, error: movesError },
      { data: stageEvents, error: stageEventsError },
    ] = await Promise.all([walletQuery, stageEventsQuery]);

    if (movesError) {
      return NextResponse.json(
        { ok: false, error: movesError.message },
        { status: 500 },
      );
    }

    if (stageEventsError) {
      return NextResponse.json(
        { ok: false, error: stageEventsError.message },
        { status: 500 },
      );
    }

    const profileMap = new Map(
      ((profilesResult.data ?? []) as ProfileRow[]).map((p) => [p.id, p]),
    );

    const stageMap = new Map(
      ((stagesResult.data ?? []) as StageRow[]).map((s) => [s.id, s]),
    );

    const moveGroups = new Map<
      string,
      {
        credit: number;
        debit: number;
        payout: number;
        lastMoveAt: string | null;
      }
    >();

    for (const move of (moves ?? []) as WalletMoveRow[]) {
      const key = move.user_id;

      const current = moveGroups.get(key) ?? {
        credit: 0,
        debit: 0,
        payout: 0,
        lastMoveAt: null,
      };

      const amount = Number(move.amount || 0);
      const abs = Math.abs(amount);

      if (isPayout(move.type)) {
        current.payout += abs;
      } else if (isCredit(move.type, amount)) {
        current.credit += abs;
      } else if (isDebit(move.type, amount)) {
        current.debit += abs;
      }

      if (
        !current.lastMoveAt ||
        (move.created_at && move.created_at > current.lastMoveAt)
      ) {
        current.lastMoveAt = move.created_at;
      }

      moveGroups.set(key, current);
    }

    const eventCountMap = new Map<string, number>();
    for (const event of (stageEvents ?? []) as StageEventRow[]) {
      eventCountMap.set(
        event.user_id,
        (eventCountMap.get(event.user_id) ?? 0) + 1,
      );
    }

    const items = employeeRows
      .map((employee) => {
        const profile = profileMap.get(employee.user_id);
        const stage = employee.stage_id
          ? stageMap.get(employee.stage_id)
          : null;

        const movesData = moveGroups.get(employee.user_id) ?? {
          credit: 0,
          debit: 0,
          payout: 0,
          lastMoveAt: null,
        };

        const balance = movesData.credit - movesData.debit - movesData.payout;

        return {
          employeeId: employee.id,
          userId: employee.user_id,
          name: profile?.full_name ?? null,
          phone: profile?.phone ?? null,
          stageName: stage?.name ?? null,
          payType: employee.pay_type ?? null,
          active: employee.active ?? null,
          completedCount: eventCountMap.get(employee.user_id) ?? 0,
          credit: movesData.credit,
          debit: movesData.debit,
          payout: movesData.payout,
          balance,
          lastMoveAt: movesData.lastMoveAt,
        };
      })
      .filter((item) => {
        if (!search) return true;

        return (
          (item.name || "").toLowerCase().includes(search) ||
          (item.phone || "").toLowerCase().includes(search) ||
          (item.stageName || "").toLowerCase().includes(search)
        );
      })
      .sort((a, b) => b.balance - a.balance);

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
