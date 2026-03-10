// FILE: src/app/api/stages/move/route.ts
import { NextRequest, NextResponse } from "next/server";
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

function mustString(v: unknown) {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) throw new Error("Invalid input");
  return s;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = mustString(body?.id);
    const dir = body?.dir === "down" ? "down" : "up";

    const sb = await createSupabaseServerClient();
    const { data } = await sb.auth.getUser();

    if (!data?.user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { tenantId, role } = await requireTenant({
      userId: data.user.id,
      sb,
    });
    const forb = mustOwner(role);
    if (forb) return forb;

    const admin = createSupabaseAdminClient();

    const cur = await admin
      .from("stages")
      .select("id, sort_order, archived")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .single();

    if (cur.error) {
      return NextResponse.json(
        { ok: false, error: cur.error.message },
        { status: 500 },
      );
    }

    if (cur.data.archived) {
      return NextResponse.json(
        { ok: false, error: "لا يمكن ترتيب مرحلة مؤرشفة" },
        { status: 400 },
      );
    }

    const neighbor = await admin
      .from("stages")
      .select("id, sort_order")
      .eq("tenant_id", tenantId)
      .eq("archived", false)
      .order("sort_order", { ascending: true });

    if (neighbor.error) {
      return NextResponse.json(
        { ok: false, error: neighbor.error.message },
        { status: 500 },
      );
    }

    const list = neighbor.data || [];
    const idx = list.findIndex((x) => x.id === id);
    const j = dir === "up" ? idx - 1 : idx + 1;

    if (idx < 0 || j < 0 || j >= list.length) {
      return NextResponse.json({ ok: true });
    }

    const a = list[idx];
    const b = list[j];

    const u1 = await admin
      .from("stages")
      .update({ sort_order: b.sort_order })
      .eq("tenant_id", tenantId)
      .eq("id", a.id);

    if (u1.error) {
      return NextResponse.json(
        { ok: false, error: u1.error.message },
        { status: 500 },
      );
    }

    const u2 = await admin
      .from("stages")
      .update({ sort_order: a.sort_order })
      .eq("tenant_id", tenantId)
      .eq("id", b.id);

    if (u2.error) {
      return NextResponse.json(
        { ok: false, error: u2.error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
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
