// FILE: src/app/api/orders/[orderId]/production-items/route.ts

import { NextRequest, NextResponse } from "next/server";
import { buildProductionItemsForOrder } from "@/lib/production/build-production-items";
import { getPrintOrderData } from "@/lib/production/get-print-order-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

export async function POST(_req: NextRequest, ctx: RouteContext) {
  try {
    const { orderId } = await ctx.params;

    const supabase = await createSupabaseServerClient();
    const admin = createSupabaseAdminClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { data: membership, error: membershipError } = await supabase
      .from("tenant_members")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .in("role", ["owner", "admin"])
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

    const buildResult = await buildProductionItemsForOrder({
      supabase: admin,
      tenantId: membership.tenant_id,
      orderId,
    });

    const printData = await getPrintOrderData({
      supabase: admin,
      tenantId: membership.tenant_id,
      orderId,
    });

    return NextResponse.json({
      ok: true,
      orderId,
      created: buildResult.created,
      skipped: buildResult.skipped,
      items: printData.cards,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";

    if (message === "ORDER_NOT_FOUND") {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
