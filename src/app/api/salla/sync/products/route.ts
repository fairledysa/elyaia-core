// FILE: src/app/api/salla/sync/products/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireTenant } from "@/lib/tenant/requireTenant";
import { sallaFetch } from "@/lib/salla/client";

export const runtime = "nodejs";

type SallaPaginatedResponse<T> = {
  data?: T[];
  pagination?: {
    current_page?: number;
    last_page?: number;
    total?: number;
    per_page?: number;
    has_more_pages?: boolean;
  };
};

function normalizeProduct(p: any, installationId: string) {
  const pid = p?.id != null ? String(p.id) : null;
  if (!pid) return null;

  const name = p?.name ?? p?.title ?? null;
  const sku = p?.sku ?? null;
  const price = p?.price?.amount ?? p?.price ?? null;
  const currency = p?.price?.currency ?? p?.currency ?? null;
  const status = p?.status?.slug ?? p?.status ?? null;
  const imageUrl =
    p?.images?.[0]?.url ??
    p?.image?.url ??
    p?.thumbnail?.url ??
    p?.thumbnail ??
    null;

  return {
    installation_id: installationId,
    salla_product_id: pid,
    name: name ? String(name) : null,
    sku: sku ? String(sku) : null,
    price: price != null && price !== "" ? Number(price) : null,
    currency: currency ? String(currency) : null,
    status: status ? String(status) : null,
    image_url: imageUrl ? String(imageUrl) : null,
    raw: p,
    updated_at: new Date().toISOString(),
  };
}

async function updateJob(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  jobId: string,
  patch: Record<string, any>,
) {
  const r = await admin.from("sync_jobs").update(patch).eq("id", jobId);
  if (r.error) throw r.error;
}

export async function POST() {
  const trace = `sync-products-${Date.now()}`;
  let jobId: string | null = null;

  try {
    const sb = await createSupabaseServerClient();
    const { data: u, error: uErr } = await sb.auth.getUser();

    if (uErr || !u?.user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized", trace },
        { status: 401 },
      );
    }

    const { tenantId, role } = await requireTenant({ userId: u.user.id, sb });
    if (role !== "owner") {
      return NextResponse.json(
        { ok: false, error: "Forbidden", trace },
        { status: 403 },
      );
    }

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
        { ok: false, error: inst.error.message, where: "installation", trace },
        { status: 500 },
      );
    }

    if (!inst.data?.id) {
      return NextResponse.json(
        { ok: false, error: "No active installation", trace },
        { status: 400 },
      );
    }

    const installationId = String(inst.data.id);

    const runningJob = await admin
      .from("sync_jobs")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("installation_id", installationId)
      .eq("job_type", "products")
      .eq("status", "running")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (runningJob.error) {
      return NextResponse.json(
        { ok: false, error: runningJob.error.message, where: "running_job", trace },
        { status: 500 },
      );
    }

    if (runningJob.data?.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "هناك مزامنة منتجات تعمل الآن",
          jobId: runningJob.data.id,
          trace,
        },
        { status: 409 },
      );
    }

    const jobInsert = await admin
      .from("sync_jobs")
      .insert({
        tenant_id: tenantId,
        installation_id: installationId,
        job_type: "products",
        status: "running",
        total: 0,
        processed: 0,
        started_at: new Date().toISOString(),
        trace,
      })
      .select("id")
      .single();

    if (jobInsert.error) {
      return NextResponse.json(
        { ok: false, error: jobInsert.error.message, where: "job_insert", trace },
        { status: 500 },
      );
    }

    jobId = String(jobInsert.data.id);

    const perPage = 50;
    let page = 1;
    let total = 0;
    let processed = 0;
    let productsUpserted = 0;

    while (true) {
      const res = await sallaFetch<SallaPaginatedResponse<any>>(
        `/admin/v2/products?per_page=${perPage}&page=${page}`,
        installationId,
      );

      const products: any[] = Array.isArray(res?.data) ? res.data : [];

      if (page === 1) {
        total = Number(res?.pagination?.total ?? 0);
        await updateJob(admin, jobId, {
          total,
          processed: 0,
        });
      }

      if (!products.length) break;

      const rows = products
        .map((p) => normalizeProduct(p, installationId))
        .filter(Boolean) as any[];

      if (rows.length) {
        const up = await admin
          .from("salla_products")
          .upsert(rows, { onConflict: "installation_id,salla_product_id" });

        if (up.error) {
          throw new Error(up.error.message);
        }

        productsUpserted += rows.length;
      }

      processed += products.length;

      await updateJob(admin, jobId, {
        total,
        processed,
      });

      const currentPage = Number(res?.pagination?.current_page ?? page);
      const lastPage = Number(res?.pagination?.last_page ?? currentPage);
      const hasMore =
        Boolean(res?.pagination?.has_more_pages) || currentPage < lastPage;

      if (!hasMore) break;
      page += 1;
    }

    await updateJob(admin, jobId, {
      status: "success",
      total,
      processed,
      finished_at: new Date().toISOString(),
      last_error: null,
    });

    return NextResponse.json({
      ok: true,
      tenantId,
      installationId,
      jobId,
      productsUpserted,
      total,
      processed,
      trace,
    });
  } catch (e: any) {
    const admin = createSupabaseAdminClient();

    if (jobId) {
      try {
        await updateJob(admin, jobId, {
          status: "failed",
          finished_at: new Date().toISOString(),
          last_error: e?.message || "sync-products failed",
        });
      } catch {}
    }

    console.error("[sync-products] error", { trace, message: e?.message, e });

    return NextResponse.json(
      { ok: false, error: e?.message || "sync-products failed", jobId, trace },
      { status: 500 },
    );
  }
}