// FILE: src/app/api/products/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant/requireTenant";

export const runtime = "nodejs";

function parsePositiveInt(value: string | null, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

export async function GET(req: Request) {
  const sb = await createSupabaseServerClient();

  const { data: u } = await sb.auth.getUser();
  if (!u?.user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { tenantId } = await requireTenant({ userId: u.user.id, sb });

  const url = new URL(req.url);
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const limit = parsePositiveInt(url.searchParams.get("limit"), 20);

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await sb
    .from("salla_products")
    .select(
      "id, salla_product_id, name, sku, price, currency, status, image_url, updated_at, salla_installations!inner(tenant_id)",
      { count: "exact" },
    )
    .eq("salla_installations.tenant_id", tenantId)
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

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

  const total = count || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return NextResponse.json({
    ok: true,
    items,
    page,
    limit,
    total,
    totalPages,
  });
}