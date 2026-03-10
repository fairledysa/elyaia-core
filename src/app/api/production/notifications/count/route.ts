// FILE: src/app/api/production/notifications/count/route.ts

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const admin = createSupabaseAdminClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const { data: membership } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!membership?.tenant_id) {
      return NextResponse.json(
        { ok: false, error: "TENANT_NOT_FOUND" },
        { status: 403 },
      );
    }

    const tenantId = membership.tenant_id;

    const { count, error } = await admin
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .is("read_at", null); // ← فقط غير المقروء

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      count: count ?? 0,
    });
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
