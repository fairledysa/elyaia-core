// FILE: src/app/api/print-batches/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createPrintBatch } from "@/lib/production/create-print-batch";

export const runtime = "nodejs";

async function getMembership() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "UNAUTHORIZED", status: 401 as const };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .in("role", ["owner", "admin"])
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return { error: membershipError.message, status: 500 as const };
  }

  if (!membership?.tenant_id) {
    return { error: "TENANT_NOT_FOUND", status: 403 as const };
  }

  return {
    userId: user.id,
    tenantId: membership.tenant_id,
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getMembership();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const admin = createSupabaseAdminClient();
    const batchDate = req.nextUrl.searchParams.get("batchDate");

    const query = admin
      .from("print_batches")
      .select(
        "id, batch_date, batch_no, status, total_orders, total_items, created_at",
      )
      .eq("tenant_id", auth.tenantId)
      .order("batch_date", { ascending: false })
      .order("batch_no", { ascending: false });

    if (batchDate) {
      query.eq("batch_date", batchDate);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      batches: data ?? [],
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

export async function POST(req: NextRequest) {
  try {
    const auth = await getMembership();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const admin = createSupabaseAdminClient();
    const body = await req.json();
    const batchDate = body?.batchDate;

    if (!batchDate) {
      return NextResponse.json(
        { error: "BATCH_DATE_REQUIRED" },
        { status: 400 },
      );
    }

    const result = await createPrintBatch({
      admin,
      tenantId: auth.tenantId,
      userId: auth.userId,
      batchDate,
    });

    return NextResponse.json({
      ok: true,
      batch: result.batch,
      totalOrders: result.totalOrders,
      totalItems: result.totalItems,
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
