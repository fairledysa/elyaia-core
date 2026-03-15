// FILE: src/app/api/salla/sync/products/status/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireTenant } from "@/lib/tenant/requireTenant";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sb = await createSupabaseServerClient();
    const { data: u, error: uErr } = await sb.auth.getUser();

    if (uErr || !u?.user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { tenantId } = await requireTenant({ userId: u.user.id, sb });
    const admin = createSupabaseAdminClient();

    const inst = await admin
      .from("salla_installations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (inst.error) {
      return NextResponse.json(
        { ok: false, error: inst.error.message, where: "installation" },
        { status: 500 },
      );
    }

    if (!inst.data?.id) {
      return NextResponse.json(
        { ok: false, error: "No active installation" },
        { status: 400 },
      );
    }

    const installationId = String(inst.data.id);

    const job = await admin
      .from("sync_jobs")
      .select(
        "id, tenant_id, installation_id, job_type, status, total, processed, started_at, finished_at, last_error, trace",
      )
      .eq("tenant_id", tenantId)
      .eq("installation_id", installationId)
      .eq("job_type", "products")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (job.error) {
      return NextResponse.json(
        { ok: false, error: job.error.message, where: "job" },
        { status: 500 },
      );
    }

    const row = job.data;

    if (!row) {
      return NextResponse.json({
        ok: true,
        job: null,
        progress: 0,
      });
    }

    const total = Number(row.total ?? 0);
    const processed = Number(row.processed ?? 0);
    const progress =
      total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

    return NextResponse.json({
      ok: true,
      job: row,
      progress,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to load sync status" },
      { status: 500 },
    );
  }
}