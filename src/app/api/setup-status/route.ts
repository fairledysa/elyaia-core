// FILE: src/app/api/setup-status/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireTenant } from "@/lib/tenant/requireTenant";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sb = await createSupabaseServerClient();
    const { data } = await sb.auth.getUser();

    if (!data?.user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { tenantId } = await requireTenant({
      userId: data.user.id,
      sb,
    });

    const admin = createSupabaseAdminClient();

    const [
      stagesQ,
      employeesQ,
      materialsQ,
      productsQ,
      productStagesQ,
      productMaterialsQ,
      ordersQ,
      printBatchesQ,
    ] = await Promise.all([
      admin
        .from("stages")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("archived", false),

      admin
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("active", true),

      admin
        .from("materials")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId),

      admin
        .from("salla_products")
        .select("id, salla_installations!inner(tenant_id)", {
          count: "exact",
          head: true,
        })
        .eq("salla_installations.tenant_id", tenantId),

      admin
        .from("product_stages")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId),

      admin
        .from("product_materials")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId),

      admin
        .from("salla_orders")
        .select("id, salla_installations!inner(tenant_id)", {
          count: "exact",
          head: true,
        })
        .eq("salla_installations.tenant_id", tenantId),

      admin
        .from("print_batches")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId),
    ]);

    const errors = [
      stagesQ.error,
      employeesQ.error,
      materialsQ.error,
      productsQ.error,
      productStagesQ.error,
      productMaterialsQ.error,
      ordersQ.error,
      printBatchesQ.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: errors.map((e: any) => e.message).join(" | "),
        },
        { status: 500 },
      );
    }

    const status = {
      stages: (stagesQ.count ?? 0) > 0,
      employees: (employeesQ.count ?? 0) > 0,
      materials: (materialsQ.count ?? 0) > 0,
      products: (productsQ.count ?? 0) > 0,
      productSettings:
        (productStagesQ.count ?? 0) > 0 && (productMaterialsQ.count ?? 0) > 0,
      orders: (ordersQ.count ?? 0) > 0,
      printBatches: (printBatchesQ.count ?? 0) > 0,
    };

    return NextResponse.json({
      ok: true,
      status,
      counts: {
        stages: stagesQ.count ?? 0,
        employees: employeesQ.count ?? 0,
        materials: materialsQ.count ?? 0,
        products: productsQ.count ?? 0,
        productStages: productStagesQ.count ?? 0,
        productMaterials: productMaterialsQ.count ?? 0,
        orders: ordersQ.count ?? 0,
        printBatches: printBatchesQ.count ?? 0,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Internal server error",
      },
      { status: 500 },
    );
  }
}