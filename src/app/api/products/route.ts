// FILE: src/app/api/products/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant/requireTenant";

export const runtime = "nodejs";

export async function GET() {
  const sb = await createSupabaseServerClient();
  const { data: u } = await sb.auth.getUser();
  if (!u?.user)
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );

  const { tenantId } = await requireTenant({ userId: u.user.id, sb });

  // جلب منتجات سلة التابعة لهذا tenant عبر installation_id -> salla_installations.tenant_id
  const { data, error } = await sb
    .from("salla_products")
    .select(
      "id, salla_product_id, name, sku, price, currency, status, image_url, updated_at, salla_installations!inner(tenant_id)",
    )
    .eq("salla_installations.tenant_id", tenantId)
    .order("updated_at", { ascending: false });

  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );

  const items =
    (data || []).map((r: any) => ({
      id: r.id,
      salla_product_id: r.salla_product_id,
      name: r.name,
      sku: r.sku,
      price: r.price,
      currency: r.currency,
      status: r.status,
      image_url: r.image_url,
      updated_at: r.updated_at,
    })) || [];

  return NextResponse.json({ ok: true, items });
}
