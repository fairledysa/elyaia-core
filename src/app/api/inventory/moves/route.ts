// FILE: src/app/api/inventory/moves/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant/requireTenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sb = await createSupabaseServerClient();
  const { data: u } = await sb.auth.getUser();
  if (!u?.user)
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );

  const { tenantId } = await requireTenant({ userId: u.user.id, sb });

  const url = new URL(req.url);
  const materialId = (url.searchParams.get("material_id") || "").trim();
  const limitRaw = Number(url.searchParams.get("limit") || 50);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 200)
    : 50;

  const admin = createSupabaseAdminClient();

  let q = admin
    .from("inventory_moves")
    .select(
      "id,material_id,quantity,move_type,unit_cost,total_cost,note,created_at,created_by,materials(name,unit)",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (materialId) q = q.eq("material_id", materialId);

  const r = await q;
  if (r.error)
    return NextResponse.json(
      { ok: false, error: r.error.message },
      { status: 500 },
    );

  return NextResponse.json({ ok: true, items: r.data || [] });
}
