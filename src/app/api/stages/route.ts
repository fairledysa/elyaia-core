// FILE: src/app/api/stages/route.ts
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

export async function GET() {
  const sb = await createSupabaseServerClient();
  const { data } = await sb.auth.getUser();
  if (!data?.user)
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );

  const { tenantId } = await requireTenant({ userId: data.user.id, sb });

  const admin = createSupabaseAdminClient();
  const q = await admin
    .from("stages")
    .select(
      "id,name,sort_order,require_previous_complete,inventory_deduct_enabled,archived,created_at",
    )
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true });

  if (q.error)
    return NextResponse.json(
      { ok: false, error: q.error.message },
      { status: 500 },
    );

  return NextResponse.json({ ok: true, items: q.data || [] });
}

export async function POST(req: Request) {
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

  const name = String(body?.name || "").trim();
  if (!name)
    return NextResponse.json(
      { ok: false, error: "Missing name" },
      { status: 400 },
    );

  const require_previous_complete =
    body?.require_previous_complete === false ? false : true;
  const inventory_deduct_enabled = body?.inventory_deduct_enabled === true;

  const admin = createSupabaseAdminClient();

  // next sort_order
  const mx = await admin
    .from("stages")
    .select("sort_order")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSort = (mx.data?.sort_order ?? 0) + 1;

  const ins = await admin
    .from("stages")
    .insert({
      tenant_id: tenantId,
      name,
      sort_order: nextSort,
      require_previous_complete,
      inventory_deduct_enabled,
      archived: false,
    })
    .select(
      "id,name,sort_order,require_previous_complete,inventory_deduct_enabled,archived,created_at",
    )
    .single();

  if (ins.error)
    return NextResponse.json(
      { ok: false, error: ins.error.message },
      { status: 500 },
    );

  return NextResponse.json({ ok: true, item: ins.data });
}
