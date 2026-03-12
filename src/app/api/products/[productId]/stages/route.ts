// FILE: src/app/api/products/[productId]/stages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant/requireTenant";

export const runtime = "nodejs";

function mustString(v: unknown) {
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

  if (!u?.user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { tenantId } = await requireTenant({ userId: u.user.id, sb });

  const { data: productStageRows, error: productStagesError } = await sb
    .from("product_stages")
    .select("id, stage_id, enabled, payout_amount, sort_order")
    .eq("tenant_id", tenantId)
    .eq("salla_product_id", productId)
    .order("sort_order", { ascending: true });

  if (productStagesError) {
    return NextResponse.json(
      { ok: false, error: productStagesError.message },
      { status: 500 },
    );
  }

  const stageIds = Array.from(
    new Set(
      (productStageRows || []).map((row) => row.stage_id).filter(Boolean),
    ),
  );

  let stageMap = new Map<
    string,
    {
      id: string;
      name: string;
      require_previous_complete: boolean;
      inventory_deduct_enabled: boolean;
      archived: boolean;
    }
  >();

  if (stageIds.length > 0) {
    const { data: stagesRows, error: stagesError } = await sb
      .from("stages")
      .select(
        "id, name, require_previous_complete, inventory_deduct_enabled, archived",
      )
      .eq("tenant_id", tenantId)
      .in("id", stageIds);

    if (stagesError) {
      return NextResponse.json(
        { ok: false, error: stagesError.message },
        { status: 500 },
      );
    }

    stageMap = new Map(
      (stagesRows || []).map((row) => [
        row.id,
        {
          id: row.id,
          name: row.name,
          require_previous_complete: row.require_previous_complete ?? false,
          inventory_deduct_enabled: row.inventory_deduct_enabled ?? false,
          archived: row.archived ?? false,
        },
      ]),
    );
  }

  const items = (productStageRows || []).map((row) => ({
    id: row.id,
    stage_id: row.stage_id,
    enabled: row.enabled,
    payout_amount: row.payout_amount,
    sort_order: row.sort_order,
    stages: stageMap.get(row.stage_id) || null,
  }));

  return NextResponse.json({ ok: true, items });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ productId: string }> },
) {
  const { productId } = await ctx.params;

  const sb = await createSupabaseServerClient();
  const { data: u } = await sb.auth.getUser();

  if (!u?.user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { tenantId, role } = await requireTenant({ userId: u.user.id, sb });

  if (role !== "owner") {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  const body = await req.json();
  const stage_id = mustString(body.stage_id);

  const enabled = body.enabled == null ? true : Boolean(body.enabled);
  const payout_amount =
    body.payout_amount == null ? null : Number(body.payout_amount);
  const sort_order = body.sort_order == null ? 0 : Number(body.sort_order);

  const { data, error } = await sb
    .from("product_stages")
    .upsert(
      {
        tenant_id: tenantId,
        salla_product_id: productId,
        stage_id,
        enabled,
        payout_amount,
        sort_order,
      },
      { onConflict: "tenant_id,salla_product_id,stage_id" },
    )
    .select("id, stage_id, enabled, payout_amount, sort_order")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, item: data });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ productId: string }> },
) {
  const { productId } = await ctx.params;

  const sb = await createSupabaseServerClient();
  const { data: u } = await sb.auth.getUser();

  if (!u?.user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { tenantId, role } = await requireTenant({ userId: u.user.id, sb });

  if (role !== "owner") {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  const body = await req.json();
  const id = mustString(body.id);

  const patch: Record<string, unknown> = {};

  if (body.enabled != null) {
    patch.enabled = Boolean(body.enabled);
  }

  if (body.payout_amount !== undefined) {
    patch.payout_amount =
      body.payout_amount == null ? null : Number(body.payout_amount);
  }

  if (body.sort_order != null) {
    patch.sort_order = Number(body.sort_order);
  }

  const { data, error } = await sb
    .from("product_stages")
    .update(patch)
    .eq("tenant_id", tenantId)
    .eq("salla_product_id", productId)
    .eq("id", id)
    .select("id, stage_id, enabled, payout_amount, sort_order")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ productId: string }> },
) {
  const { productId } = await ctx.params;

  const sb = await createSupabaseServerClient();
  const { data: u } = await sb.auth.getUser();

  if (!u?.user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { tenantId, role } = await requireTenant({ userId: u.user.id, sb });

  if (role !== "owner") {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  const body = await req.json();
  const id = mustString(body.id);

  const { error } = await sb
    .from("product_stages")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("salla_product_id", productId)
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, deleted: true });
}
