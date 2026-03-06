// FILE: src/app/api/products/matrix/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant/requireTenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  const sb = await createSupabaseServerClient();
  const { data: u } = await sb.auth.getUser();
  if (!u?.user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { tenantId } = await requireTenant({ userId: u.user.id, sb });
  const admin = createSupabaseAdminClient();

  // 1) Products
  const p = await admin
    .from("salla_products")
    .select(
      "salla_product_id, name, sku, image_url, salla_installations!inner(tenant_id)",
    )
    .eq("salla_installations.tenant_id", tenantId)
    .order("name", { ascending: true });

  if (p.error) {
    return NextResponse.json(
      { ok: false, error: p.error.message },
      { status: 500 },
    );
  }

  const products =
    (p.data || []).map((r: any) => ({
      salla_product_id: r.salla_product_id,
      name: r.name,
      sku: r.sku,
      image_url: r.image_url,
    })) || [];

  // 2) Stages
  const s = await admin
    .from("stages")
    .select("id, name, sort_order")
    .eq("tenant_id", tenantId)
    .eq("archived", false)
    .order("sort_order", { ascending: true });

  if (s.error) {
    return NextResponse.json(
      { ok: false, error: s.error.message },
      { status: 500 },
    );
  }

  // 3) Product stage settings (حسب اللي تستخدمه أنت في الحفظ /api/products/[productId]/stages)
  const set = await admin
    .from("product_stages")
    .select("id, salla_product_id, stage_id, enabled, payout_amount")
    .eq("tenant_id", tenantId);

  if (set.error) {
    return NextResponse.json(
      { ok: false, error: set.error.message },
      { status: 500 },
    );
  }

  const settings =
    (set.data || []).map((r: any) => ({
      id: r.id,
      salla_product_id: r.salla_product_id,
      stage_id: r.stage_id,
      enabled: !!r.enabled,
      payout_amount: r.payout_amount,
    })) || [];

  // 4) Materials (هذا هو "المخزون" اللي تبي يظهر في الماتريكس كاختيار قماش)
  const m = await admin
    .from("materials")
    .select("id, name, on_hand, reorder_level, allow_negative")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });

  if (m.error) {
    return NextResponse.json(
      { ok: false, error: m.error.message },
      { status: 500 },
    );
  }

  const materials = (m.data || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    // لو تبي تعرض الرصيد في الـ dropdown لاحقاً
    on_hand: r.on_hand,
    reorder_level: r.reorder_level,
    allow_negative: r.allow_negative,
  }));

  // 5) Product -> Material mapping (قماش/كمية لكل قطعة)
  const pm = await admin
    .from("product_materials")
    .select("id, salla_product_id, material_id, qty_per_piece")
    .eq("tenant_id", tenantId);

  if (pm.error) {
    return NextResponse.json(
      { ok: false, error: pm.error.message },
      { status: 500 },
    );
  }

  const productMaterials =
    (pm.data || []).map((r: any) => ({
      id: r.id,
      salla_product_id: r.salla_product_id,
      material_id: r.material_id,
      qty_per_piece: r.qty_per_piece,
    })) || [];

  return NextResponse.json({
    ok: true,
    products,
    stages: s.data || [],
    settings,
    materials,
    productMaterials,
  });
}
