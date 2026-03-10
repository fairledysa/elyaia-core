// FILE: src/app/api/finance/warnings/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireTenant } from "@/lib/tenant/requireTenant";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;

    const sb = await createSupabaseServerClient();
    const admin = createSupabaseAdminClient();

    const {
      data: { user },
      error: userError,
    } = await sb.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const { tenantId, role } = await requireTenant({ userId: user.id, sb });

    if (!["owner", "admin"].includes(role)) {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);

    const employee_id = String(body?.employee_id || "").trim();
    const stage_id = body?.stage_id ? String(body.stage_id).trim() : null;
    const warning_type = String(body?.warning_type || "other").trim();
    const severity = String(body?.severity || "medium").trim();
    const note = String(body?.note || "").trim() || null;
    const reason = String(body?.reason || "").trim() || null;

    if (!employee_id) {
      return NextResponse.json(
        { ok: false, error: "MISSING_EMPLOYEE_ID" },
        { status: 400 },
      );
    }

    const { data, error } = await admin
      .from("employee_warnings")
      .update({
        employee_id,
        stage_id,
        warning_type,
        severity,
        note,
        reason,
        issued_by: user.id,
      })
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .select("id")
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
        error: error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;

    const sb = await createSupabaseServerClient();
    const admin = createSupabaseAdminClient();

    const {
      data: { user },
      error: userError,
    } = await sb.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const { tenantId, role } = await requireTenant({ userId: user.id, sb });

    if (!["owner", "admin"].includes(role)) {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403 },
      );
    }

    const { error } = await admin
      .from("employee_warnings")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
