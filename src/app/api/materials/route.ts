// FILE: src/app/api/materials/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant/requireTenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

  const admin = createSupabaseAdminClient();
  const q = await admin
    .from("materials")
    .select("id,name,unit,on_hand,unit_cost,reorder_level,allow_negative")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });

  if (q.error)
    return NextResponse.json(
      { ok: false, error: q.error.message },
      { status: 500 },
    );

  return NextResponse.json({ ok: true, items: q.data || [] });
}

export async function POST(req: Request) {
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
  const name = String(body?.name || "").trim();
  if (!name)
    return NextResponse.json(
      { ok: false, error: "Missing name" },
      { status: 400 },
    );

  const unit = String(body?.unit || "m").trim() || "m";
  const unit_cost = Number(body?.unit_cost ?? 0);

  const admin = createSupabaseAdminClient();

  const ins = await admin
    .from("materials")
    .insert({
      tenant_id: tenantId,
      name,
      unit,
      unit_cost: Number.isFinite(unit_cost) ? unit_cost : 0,
      on_hand: 0,
      reorder_level: 0,
      allow_negative: false,
    })
    .select("id,name,unit,on_hand,unit_cost,reorder_level,allow_negative")
    .single();

  if (ins.error)
    return NextResponse.json(
      { ok: false, error: ins.error.message },
      { status: 500 },
    );

  return NextResponse.json({ ok: true, item: ins.data });
}
