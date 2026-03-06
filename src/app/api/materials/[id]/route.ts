// FILE: src/app/api/materials/[id]/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant/requireTenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

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

  const body = await req.json().catch(() => ({}));
  const patch: any = {};

  if (body?.name != null) patch.name = String(body.name).trim();
  if (body?.unit != null) patch.unit = String(body.unit || "m").trim() || "m";
  if (body?.unit_cost != null) patch.unit_cost = Number(body.unit_cost);

  if (body?.on_hand != null) patch.on_hand = Number(body.on_hand);
  if (body?.reorder_level != null)
    patch.reorder_level = Number(body.reorder_level);
  if (body?.allow_negative != null)
    patch.allow_negative = !!body.allow_negative;

  const admin = createSupabaseAdminClient();

  const up = await admin
    .from("materials")
    .update(patch)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .select("id,name,unit,on_hand,unit_cost,reorder_level,allow_negative")
    .single();

  if (up.error)
    return NextResponse.json(
      { ok: false, error: up.error.message },
      { status: 500 },
    );
  return NextResponse.json({ ok: true, item: up.data });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

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

  const admin = createSupabaseAdminClient();

  const del = await admin
    .from("materials")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (del.error)
    return NextResponse.json(
      { ok: false, error: del.error.message },
      { status: 500 },
    );
  return NextResponse.json({ ok: true });
}
