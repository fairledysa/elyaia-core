// FILE: src/app/api/production/wallet/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type EmployeeRow = {
  id: string;
  active: boolean | null;
};

type WalletMoveRow = {
  id: string;
  type: string;
  amount: number;
  created_at: string | null;
  note: string | null;
};

type WalletFilterPreset =
  | "all"
  | "today"
  | "7d"
  | "this_month"
  | "last_month"
  | "this_year";

function formatAmount(value: number) {
  return new Intl.NumberFormat("ar-SA", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatRelativeArabic(dateValue: string | null | undefined) {
  if (!dateValue) return "-";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "الآن";
  if (diffMin < 60) return `قبل ${diffMin} دقيقة`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `قبل ${diffHours} ساعة`;

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");

  return `${y}-${m}-${d} ${h}:${min}`;
}

function mapMoveTypeLabel(type: string) {
  switch (type) {
    case "piece_earning":
      return "مستحق تنفيذ قطعة";
    case "stage_earning":
      return "دخل تنفيذ مرحلة";
    case "bonus":
      return "مكافأة";
    case "advance":
      return "سلفة";
    case "deduction":
      return "خصم";
    case "payout":
      return "صرف";
    case "salary":
      return "راتب";
    case "adjustment":
      return "تسوية";
    default:
      return type || "حركة مالية";
  }
}

function moveDirection(type: string, amount: number): "plus" | "minus" {
  if (type === "advance" || type === "deduction" || amount < 0) {
    return "minus";
  }
  return "plus";
}

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function toIso(date: Date) {
  return date.toISOString();
}

function applyPresetRange(preset: WalletFilterPreset): {
  from?: string;
  to?: string;
} {
  const now = new Date();

  if (preset === "today") {
    return {
      from: toIso(startOfDay(now)),
      to: toIso(endOfDay(now)),
    };
  }

  if (preset === "7d") {
    const from = startOfDay(new Date(now));
    from.setDate(from.getDate() - 6);

    return {
      from: toIso(from),
      to: toIso(endOfDay(now)),
    };
  }

  if (preset === "this_month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = endOfDay(new Date(now));

    return {
      from: toIso(from),
      to: toIso(to),
    };
  }

  if (preset === "last_month") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));

    return {
      from: toIso(from),
      to: toIso(to),
    };
  }

  if (preset === "this_year") {
    const from = new Date(now.getFullYear(), 0, 1);
    const to = endOfDay(new Date(now));

    return {
      from: toIso(from),
      to: toIso(to),
    };
  }

  return {};
}

function applyWalletFilters<T extends { gte: Function; lte: Function }>(
  query: T,
  params: {
    preset: WalletFilterPreset;
    year: number | null;
    month: number | null;
    from: string | null;
    to: string | null;
  },
) {
  let q = query;
  const presetRange = applyPresetRange(params.preset);

  if (presetRange.from) {
    q = q.gte("created_at", presetRange.from) as T;
  }

  if (presetRange.to) {
    q = q.lte("created_at", presetRange.to) as T;
  }

  if (params.year && params.month) {
    const from = new Date(params.year, params.month - 1, 1);
    const to = endOfDay(new Date(params.year, params.month, 0));

    q = q.gte("created_at", toIso(from)) as T;
    q = q.lte("created_at", toIso(to)) as T;
  } else if (params.year) {
    const from = new Date(params.year, 0, 1);
    const to = endOfDay(new Date(params.year, 11, 31));

    q = q.gte("created_at", toIso(from)) as T;
    q = q.lte("created_at", toIso(to)) as T;
  }

  if (params.from) {
    const from = new Date(params.from);
    if (!Number.isNaN(from.getTime())) {
      q = q.gte("created_at", toIso(startOfDay(from))) as T;
    }
  }

  if (params.to) {
    const to = new Date(params.to);
    if (!Number.isNaN(to.getTime())) {
      q = q.lte("created_at", toIso(endOfDay(to))) as T;
    }
  }

  return q;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const admin = createSupabaseAdminClient();
    const searchParams = req.nextUrl.searchParams;

    const limit = Math.min(
      parsePositiveInt(searchParams.get("limit"), 20),
      100,
    );
    const offset = parsePositiveInt(searchParams.get("offset"), 0);

    const presetParam = searchParams.get("preset");
    const preset: WalletFilterPreset =
      presetParam === "today" ||
      presetParam === "7d" ||
      presetParam === "this_month" ||
      presetParam === "last_month" ||
      presetParam === "this_year"
        ? presetParam
        : "all";

    const yearValue = searchParams.get("year");
    const monthValue = searchParams.get("month");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const year = yearValue ? Number(yearValue) : null;
    const month = monthValue ? Number(monthValue) : null;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { data: membership, error: membershipError } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      return NextResponse.json(
        { error: membershipError.message },
        { status: 500 },
      );
    }

    if (!membership?.tenant_id) {
      return NextResponse.json({ error: "TENANT_NOT_FOUND" }, { status: 403 });
    }

    const tenantId = membership.tenant_id;

    const { data: employee, error: employeeError } = await admin
      .from("employees")
      .select("id, active")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .maybeSingle<EmployeeRow>();

    if (employeeError) {
      return NextResponse.json(
        { error: employeeError.message },
        { status: 500 },
      );
    }

    if (!employee?.active) {
      return NextResponse.json(
        { error: "EMPLOYEE_NOT_ACTIVE" },
        { status: 403 },
      );
    }

    let rowsQuery = admin
      .from("wallet_moves")
      .select("id, type, amount, created_at, note", { count: "exact" })
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id);

    rowsQuery = applyWalletFilters(rowsQuery, {
      preset,
      year: Number.isFinite(year) ? year : null,
      month: Number.isFinite(month) ? month : null,
      from,
      to,
    });

    const {
      data: walletMoves,
      error: walletMovesError,
      count,
    } = await rowsQuery
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (walletMovesError) {
      return NextResponse.json(
        { error: walletMovesError.message },
        { status: 500 },
      );
    }

    let summaryQuery = admin
      .from("wallet_moves")
      .select("type, amount, created_at")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id);

    summaryQuery = applyWalletFilters(summaryQuery, {
      preset,
      year: Number.isFinite(year) ? year : null,
      month: Number.isFinite(month) ? month : null,
      from,
      to,
    });

    const { data: summaryRows, error: summaryError } = await summaryQuery.order(
      "created_at",
      { ascending: false },
    );

    if (summaryError) {
      return NextResponse.json(
        { error: summaryError.message },
        { status: 500 },
      );
    }

    const rows = (walletMoves ?? []) as WalletMoveRow[];

    let totalCredit = 0;
    let totalDebit = 0;
    let totalBonus = 0;
    let totalPayout = 0;

    for (const row of summaryRows ?? []) {
      const amountAbs = Math.abs(Number(row.amount || 0));
      const direction = moveDirection(row.type, Number(row.amount || 0));

      if (direction === "plus") {
        totalCredit += amountAbs;
      } else {
        totalDebit += amountAbs;
      }

      if (row.type === "bonus") {
        totalBonus += amountAbs;
      }

      if (row.type === "payout") {
        totalPayout += amountAbs;
      }
    }

    const balance = totalCredit - totalDebit;
    const updatedAt =
      (summaryRows && summaryRows.length > 0
        ? summaryRows[0].created_at
        : null) ?? null;

    const transactions = rows.map((row) => {
      const amountAbs = Math.abs(Number(row.amount || 0));
      const direction = moveDirection(row.type, Number(row.amount || 0));
      const note = row.note?.trim() || null;

      return {
        id: row.id,
        title: note || mapMoveTypeLabel(row.type),
        subtitle: note ? mapMoveTypeLabel(row.type) : null,
        amount: `${direction === "plus" ? "+" : "-"} ${formatAmount(amountAbs)} ر.س`,
        type: direction,
        time: formatRelativeArabic(row.created_at),
        rawAmount: Number(row.amount || 0),
        rawType: row.type,
        note,
        createdAt: row.created_at,
      };
    });

    const total = count ?? 0;
    const hasMore = offset + rows.length < total;

    return NextResponse.json({
      ok: true,
      summary: {
        balance,
        totalCredit,
        totalDebit,
        totalBonus,
        totalPayout,
        updatedAt,
      },
      filters: {
        preset,
        year: Number.isFinite(year) ? year : null,
        month: Number.isFinite(month) ? month : null,
        from: from || null,
        to: to || null,
      },
      pagination: {
        total,
        limit,
        offset,
        hasMore,
      },
      transactions,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
