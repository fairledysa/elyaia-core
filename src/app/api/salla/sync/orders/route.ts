//src/app/api/salla/sync/orders/route.ts
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
  if (!r.ok) throw new Error(`Salla API error ${r.status}: ${t}`);
  return JSON.parse(t);
}

export async function POST() {
  // 1) verify logged-in user
  const sb = await createSupabaseServerClient();
  const { data: u } = await sb.auth.getUser();
  if (!u?.user)
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );

  // 2) resolve tenant
  const { tenantId, role } = await requireTenant({ userId: u.user.id, sb });
  if (role !== "owner")
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 },
    );

  // 3) admin reads installation + token
  const admin = supabaseAdmin();

  const inst = await admin
    .from("salla_installations")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (inst.error)
    return NextResponse.json(
      { ok: false, error: inst.error.message },
      { status: 500 },
    );
  if (!inst.data?.id)
    return NextResponse.json(
      { ok: false, error: "No active installation" },
      { status: 400 },
    );

  const installationId = inst.data.id;

  const tok = await admin
    .from("salla_tokens")
    .select("access_token")
    .eq("installation_id", installationId)
    .maybeSingle();

  if (tok.error)
    return NextResponse.json(
      { ok: false, error: tok.error.message },
      { status: 500 },
    );
  const accessToken = tok.data?.access_token;
  if (!accessToken)
    return NextResponse.json(
      { ok: false, error: "Missing access_token" },
      { status: 400 },
    );

  // 4) fetch orders
  const j = await sallaGet(
    "https://api.salla.dev/admin/v2/orders?per_page=50",
    accessToken,
  );
  const orders: any[] = Array.isArray(j?.data) ? j.data : [];

  // 5) upsert orders
  const mappedOrders = orders
    .map((o) => {
      const sallaOrderId = String(o?.id ?? "");
      if (!sallaOrderId) return null;

      const status = o?.status?.slug ?? o?.status?.name ?? o?.status ?? null;
      const total =
        o?.total?.amount ??
        o?.total_amount ??
        o?.amounts?.total?.amount ??
        null;
      const currency = o?.currency ?? o?.amounts?.total?.currency ?? null;

      const customerName = o?.customer?.name ?? o?.customer_name ?? null;
      const customerPhone =
        o?.customer?.mobile ?? o?.customer?.phone ?? o?.customer_phone ?? null;

      return {
        installation_id: installationId,
        salla_order_id: sallaOrderId,
        order_number: o?.order_number ? String(o.order_number) : null,
        status: status ? String(status) : null,
        currency: currency ? String(currency) : null,
        total_amount: total != null ? Number(total) : null,
        customer_name: customerName ? String(customerName) : null,
        customer_phone: customerPhone ? String(customerPhone) : null,
        raw: o,
        updated_at: new Date().toISOString(),
      };
    })
    .filter(Boolean) as any[];

  if (!mappedOrders.length) {
    return NextResponse.json({
      ok: true,
      tenantId,
      installationId,
      ordersUpserted: 0,
      itemsInserted: 0,
    });
  }

  const up = await admin
    .from("salla_orders")
    .upsert(mappedOrders, { onConflict: "installation_id,salla_order_id" })
    .select("id,salla_order_id");

  if (up.error)
    return NextResponse.json(
      { ok: false, error: up.error.message },
      { status: 500 },
    );

  const orderIdBySalla = new Map<string, string>();
  for (const r of up.data || [])
    orderIdBySalla.set(String(r.salla_order_id), String(r.id));

  // 6) items: delete then insert (بسيط وموثوق)
  let itemsInserted = 0;

  for (const o of orders) {
    const sallaOrderId = String(o?.id ?? "");
    const orderId = orderIdBySalla.get(sallaOrderId);
    if (!orderId) continue;

    const items: any[] = Array.isArray(o?.items) ? o.items : [];
    await admin.from("salla_order_items").delete().eq("order_id", orderId);

    if (!items.length) continue;

    const mappedItems = items.map((it) => ({
      order_id: orderId,
      salla_item_id: it?.id != null ? String(it.id) : null,
      sku: it?.sku != null ? String(it.sku) : null,
      name: it?.name ?? it?.product?.name ?? null,
      quantity: it?.quantity != null ? Number(it.quantity) : 1,
      price:
        it?.amounts?.total?.amount ?? it?.price?.amount ?? it?.price ?? null,
      raw: it,
      created_at: new Date().toISOString(),
    }));

    const ins = await admin.from("salla_order_items").insert(mappedItems);
    if (ins.error)
      return NextResponse.json(
        { ok: false, error: ins.error.message },
        { status: 500 },
      );
    itemsInserted += mappedItems.length;
  }

  return NextResponse.json({
    ok: true,
    tenantId,
    installationId,
    ordersUpserted: mappedOrders.length,
    itemsInserted,
  });
}
