// FILE: src/app/api/stages/[id]/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant/requireTenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function mustOwner(role: string) {
  if (role !== "owner") {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 },
    );
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const sb = await createSupabaseServerClient();
  const { data } = await sb.auth.getUser();
  if (!data?.user)
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );

  const { tenantId, role } = await requireTenant({ userId: data.user.id, sb });
  const forb = mustOwner(role);
  if (forb) return forb;

  const body = await req.json().catch(() => ({}) as any);

  const patch: any = {};
  if (body?.name != null) patch.name = String(body.name).trim();
  if (body?.require_previous_complete != null)
    patch.require_previous_complete = !!body.require_previous_complete;
  if (body?.inventory_deduct_enabled != null)
    patch.inventory_deduct_enabled = !!body.inventory_deduct_enabled;
  if (body?.archived != null) patch.archived = !!body.archived;

  if (patch.name === "")
    return NextResponse.json(
      { ok: false, error: "Invalid name" },
      { status: 400 },
    );

  const admin = createSupabaseAdminClient();

  const upd = await admin
    .from("stages")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select(
      "id,name,sort_order,require_previous_complete,inventory_deduct_enabled,archived,created_at",
    )
    .single();

  if (upd.error)
    return NextResponse.json(
      { ok: false, error: upd.error.message },
      { status: 500 },
    );

  return NextResponse.json({ ok: true, item: upd.data });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const sb = await createSupabaseServerClient();
  const { data } = await sb.auth.getUser();
  if (!data?.user)
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );

  const { tenantId, role } = await requireTenant({ userId: data.user.id, sb });
  const forb = mustOwner(role);
  if (forb) return forb;

  const admin = createSupabaseAdminClient();

  // منع الحذف إذا لها تنفيذ
  const hasEvents = await admin
    .from("stage_events")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("stage_id", id)
    .limit(1)
    .maybeSingle();

  if (hasEvents.error && hasEvents.error.code !== "PGRST116") {
    // PGRST116 = no rows
    return NextResponse.json(
      { ok: false, error: hasEvents.error.message },
      { status: 500 },
    );
  }

  if (hasEvents.data?.id) {
    return NextResponse.json(
      { ok: false, error: "لا يمكن حذف مرحلة لها تنفيذ. استخدم الأرشفة." },
      { status: 400 },
    );
  }

  const del = await admin
    .from("stages")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (del.error)
    return NextResponse.json(
      { ok: false, error: del.error.message },
      { status: 500 },
    );

  return NextResponse.json({ ok: true, deleted: true });
}
