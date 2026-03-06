// FILE: src/app/api/materials/move/route.ts
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
function mustNumber(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error("Invalid input");
  return n;
}

export async function POST(req: NextRequest) {
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
  const delta = mustNumber(body.delta);
  const move_type = String(body.move_type || "adjust");
  const unit_cost = body.unit_cost == null ? 0 : mustNumber(body.unit_cost);
  const note =
    body.note == null ? null : String(body.note || "").trim() || null;

  const admin = createSupabaseAdminClient();

  const rpc = await admin.rpc("inventory_apply_move", {
    p_tenant_id: tenantId,
    p_material_id: material_id,
    p_delta: delta,
    p_move_type: move_type,
    p_unit_cost: unit_cost,
    p_note: note,
    p_created_by: u.user.id,
    p_stage_event_id: null,
  });

  if (rpc.error) {
    const msg = rpc.error.message || "Move failed";
    const status = msg.toLowerCase().includes("insufficient") ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }

  // return fresh material row
  const { data: updated, error: e2 } = await admin
    .from("materials")
    .select("id,name,unit,on_hand,unit_cost,reorder_level,allow_negative")
    .eq("tenant_id", tenantId)
    .eq("id", material_id)
    .single();

  if (e2)
    return NextResponse.json({ ok: false, error: e2.message }, { status: 500 });

  return NextResponse.json({ ok: true, item: updated });
}
