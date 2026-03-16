// FILE: src/app/api/products/matrix/import/status/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant/requireTenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sb = await createSupabaseServerClient();
    const { data: u } = await sb.auth.getUser();

    if (!u?.user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { tenantId } = await requireTenant({ userId: u.user.id, sb });
    const admin = createSupabaseAdminClient();

    const q = await admin
      .from("sync_jobs")
      .select(
        "id, tenant_id, installation_id, type, job_type, status, total, processed, created_at, started_at, finished_at, last_error, trace",
      )
      .eq("tenant_id", tenantId)
      .eq("job_type", "products_matrix_import")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (q.error) {
      return NextResponse.json(
        { ok: false, error: q.error.message },
        { status: 500 },
      );
    }

    const job = q.data || null;
    const total = Number(job?.total ?? 0);
    const processed = Number(job?.processed ?? 0);

    const progress =
      total > 0 ? Math.max(0, Math.min(100, Math.round((processed / total) * 100))) : 0;

    return NextResponse.json({
      ok: true,
      job,
      progress,
      total,
      processed,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Internal server error",
      },
      { status: 500 },
    );
  }
}