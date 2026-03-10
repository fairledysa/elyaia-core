// FILE: src/app/api/products/materials/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant/requireTenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function mustString(v: unknown) {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) throw new Error("Invalid input");
  return s;
}

function toSafeNumber(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: NextRequest) {
  try {
    const productId = mustString(req.nextUrl.searchParams.get("productId"));

    const sb = await createSupabaseServerClient();
    const { data: u } = await sb.auth.getUser();

    if (!u?.user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { tenantId } = await requireTenant({ userId: u.user.id, sb });

    const { data, error } = await sb
      .from("product_materials")
      .select("id, material_id, qty_per_piece, materials(name)")
      .eq("tenant_id", tenantId)
      .eq("salla_product_id", productId);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, items: data || [] });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Invalid request",
      },
      { status: 400 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
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
    const productId = mustString(body.productId);
    const material_id = mustString(body.material_id);
    const qty_per_piece = toSafeNumber(body.qty_per_piece, 0);

    const admin = createSupabaseAdminClient();

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
      .select("id, material_id, qty_per_piece")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, item: data });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Invalid request",
      },
      { status: 400 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
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
    const productId = mustString(body.productId);
    const id = mustString(body.id);
    const qty_per_piece = toSafeNumber(body.qty_per_piece, 0);

    const admin = createSupabaseAdminClient();

    const { data, error } = await admin
      .from("product_materials")
      .update({ qty_per_piece })
      .eq("tenant_id", tenantId)
      .eq("salla_product_id", productId)
      .eq("id", id)
      .select("id, material_id, qty_per_piece")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, item: data });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Invalid request",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
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
    const productId = mustString(body.productId);
    const id = mustString(body.id);

    const admin = createSupabaseAdminClient();

    const { error } = await admin
      .from("product_materials")
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
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Invalid request",
      },
      { status: 400 },
    );
  }
}
