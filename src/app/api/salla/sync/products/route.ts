// FILE: src/app/api/salla/sync/products/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { requireTenant } from "@/lib/tenant/requireTenant";

export const runtime = "nodejs";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function sallaGet(url: string, accessToken: string) {
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const t = await r.text();

  if (!r.ok) {
    throw new Error(`Salla API error ${r.status}: ${t || "<empty body>"}`);
  }

  if (!t) {
    throw new Error("Salla API returned empty body");
  }

  try {
    return JSON.parse(t);
  } catch (e: any) {
    throw new Error(
      `Failed to parse Salla JSON: ${e?.message || e}. Body: ${t.slice(0, 500)}`,
    );
  }
}

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

export async function POST() {
  const trace = `sync-products-${Date.now()}`;

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

    const admin = supabaseAdmin();

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

    const installationId = inst.data.id;

    const tok = await admin
      .from("salla_tokens")
      .select("access_token")
      .eq("installation_id", installationId)
      .maybeSingle();

    if (tok.error) {
      return NextResponse.json(
        { ok: false, error: tok.error.message, where: "token", trace },
        { status: 500 },
      );
    }

    const accessToken = tok.data?.access_token;
    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: "Missing access_token", trace },
        { status: 400 },
      );
    }

    const allRows: any[] = [];
    let page = 1;
    const perPage = 50;

    while (true) {
      const url = `https://api.salla.dev/admin/v2/products?per_page=${perPage}&page=${page}`;
      const j = await sallaGet(url, accessToken);

      const products: any[] = Array.isArray(j?.data) ? j.data : [];
      if (!products.length) break;

      const rows = products
        .map((p) => normalizeProduct(p, installationId))
        .filter(Boolean) as any[];

      allRows.push(...rows);

      if (products.length < perPage) break;
      page += 1;
    }

    if (!allRows.length) {
      return NextResponse.json({
        ok: true,
        tenantId,
        installationId,
        productsUpserted: 0,
        trace,
      });
    }

    const up = await admin
      .from("salla_products")
      .upsert(allRows, { onConflict: "installation_id,salla_product_id" });

    if (up.error) {
      return NextResponse.json(
        { ok: false, error: up.error.message, where: "upsert", trace },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      tenantId,
      installationId,
      productsUpserted: allRows.length,
      trace,
    });
  } catch (e: any) {
    console.error("[sync-products] error", { trace, message: e?.message, e });
    return NextResponse.json(
      { ok: false, error: e?.message || "sync-products failed", trace },
      { status: 500 },
    );
  }
}
