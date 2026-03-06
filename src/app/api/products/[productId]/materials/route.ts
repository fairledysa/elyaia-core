// FILE: src/app/api/products/[productId]/materials/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant/requireTenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function mustString(v: any) {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) throw new Error("Invalid input");
  return s;
}

export async function GET(
  _: NextRequest,
  ctx: { params: Promise<{ productId: string }> },
) {
  const { productId } = await ctx.params;

  const sb = await createSupabaseServerClient();
  const { data: u } = await sb.auth.getUser();
  if (!u?.user)
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );

  const { tenantId } = await requireTenant({ userId: u.user.id, sb });

  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("product_materials")
    .select(
      "id,material_id,qty_per_piece,updated_at,materials(name,on_hand,allow_negative,reorder_level)",
    )
    .eq("tenant_id", tenantId)
    .eq("salla_product_id", productId)
    .order("updated_at", { ascending: true });

  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );

  return NextResponse.json({ ok: true, items: data || [] });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ productId: string }> },
) {
  const { productId } = await ctx.params;

  const sb = await createSupabaseServerClient();
  const { data: u } = await sb.auth.getUser();
  if (!u?.user)
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );

  const { tenantId, role } = await requireTenant({ userId: u.user.id, sb });
  if (role !== "owner")
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 },
    );

  const body = await req.json().catch(() => ({}) as any);
  const material_id = mustString(body.material_id);
  const qty_per_piece =
    body.qty_per_piece == null ? 0 : Number(body.qty_per_piece);

  const admin = createSupabaseAdminClient();

  // مهم: هذا يعتمد على وجود UNIQUE(tenant_id,salla_product_id,material_id)
  const { data, error } = await admin
    .from("product_materials")
    .upsert(
      {
        tenant_id: tenantId,
        salla_product_id: productId,
        material_id,
        qty_per_piece,
      },
      { onConflict: "tenant_id,salla_product_id,material_id" },
    )
    .select("id,material_id,qty_per_piece,updated_at")
    .single();

  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );

  return NextResponse.json({ ok: true, item: data });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ productId: string }> },
) {
  const { productId } = await ctx.params;

  const sb = await createSupabaseServerClient();
  const { data: u } = await sb.auth.getUser();
  if (!u?.user)
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );

  const { tenantId, role } = await requireTenant({ userId: u.user.id, sb });
  if (role !== "owner")
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 },
    );

  const body = await req.json().catch(() => ({}) as any);
  const id = mustString(body.id);
  const qty_per_piece =
    body.qty_per_piece == null ? 0 : Number(body.qty_per_piece);

  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("product_materials")
    .update({ qty_per_piece, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("salla_product_id", productId)
    .eq("id", id)
    .select("id,material_id,qty_per_piece,updated_at")
    .single();

  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );

  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ productId: string }> },
) {
  const { productId } = await ctx.params;

  const sb = await createSupabaseServerClient();
  const { data: u } = await sb.auth.getUser();
  if (!u?.user)
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );

  const { tenantId, role } = await requireTenant({ userId: u.user.id, sb });
  if (role !== "owner")
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 },
    );

  const body = await req.json().catch(() => ({}) as any);
  const id = mustString(body.id);

  const admin = createSupabaseAdminClient();

  const { error } = await admin
    .from("product_materials")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("salla_product_id", productId)
    .eq("id", id);

  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );

  return NextResponse.json({ ok: true, deleted: true });
}
