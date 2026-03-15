// FILE: src/app/api/salla/sync/orders/route.ts

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireTenant } from "@/lib/tenant/requireTenant";
import { sallaFetch, sallaFetchAllPages } from "@/lib/salla/client";

export const runtime = "nodejs";

type SallaOrder = any;
type SallaOrderItem = any;

export async function POST() {
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
        { ok: false, error: inst.error.message },
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

    // ✅ يجلب كل الطلبات من جميع الصفحات
    const orders = await sallaFetchAllPages<SallaOrder>(
      "/admin/v2/orders?per_page=50",
      installationId,
    );

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

        const customerName =
          o?.customer?.first_name || o?.customer?.last_name
            ? `${o?.customer?.first_name ?? ""} ${o?.customer?.last_name ?? ""}`.trim()
            : (o?.customer?.name ?? o?.customer_name ?? null);

        const customerPhone =
          o?.customer?.mobile ?? o?.customer?.phone ?? o?.customer_phone ?? null;

        return {
          installation_id: installationId,
          salla_order_id: sallaOrderId,
          order_number: o?.reference_id != null ? String(o.reference_id) : null,
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

    const up = await admin
      .from("salla_orders")
      .upsert(mappedOrders, { onConflict: "installation_id,salla_order_id" })
      .select("id,salla_order_id");

    if (up.error) {
      return NextResponse.json(
        { ok: false, error: up.error.message },
        { status: 500 },
      );
    }

    const orderIdBySalla = new Map<string, string>();

    for (const r of up.data || []) {
      orderIdBySalla.set(String(r.salla_order_id), String(r.id));
    }

    let itemsInserted = 0;

    for (const o of orders) {
      const sallaOrderId = String(o?.id ?? "");
      const orderId = orderIdBySalla.get(sallaOrderId);

      if (!orderId) continue;

      const itemsRes = await sallaFetch<{ data?: SallaOrderItem[] }>(
        `/admin/v2/orders/items?order_id=${encodeURIComponent(sallaOrderId)}`,
        installationId,
      );

      const items: SallaOrderItem[] = Array.isArray(itemsRes?.data)
        ? itemsRes.data
        : [];

      const del = await admin
        .from("salla_order_items")
        .delete()
        .eq("order_id", orderId);

      if (del.error) {
        return NextResponse.json(
          { ok: false, error: del.error.message },
          { status: 500 },
        );
      }

      if (!items.length) continue;

      const mappedItems = items.map((it) => ({
        order_id: orderId,
        salla_item_id: it?.id != null ? String(it.id) : null,
        sku: it?.sku != null ? String(it.sku) : null,
        name: it?.name ?? null,
        quantity: it?.quantity != null ? Number(it.quantity) : 1,
        price:
          it?.amounts?.price_without_tax?.amount ??
          it?.amounts?.total?.amount ??
          it?.price?.amount ??
          it?.price ??
          null,
        raw: it,
        created_at: new Date().toISOString(),
      }));

      const ins = await admin.from("salla_order_items").insert(mappedItems);

      if (ins.error) {
        return NextResponse.json(
          { ok: false, error: ins.error.message },
          { status: 500 },
        );
      }

      itemsInserted += mappedItems.length;
    }

    return NextResponse.json({
      ok: true,
      tenantId,
      installationId,
      ordersUpserted: mappedOrders.length,
      itemsInserted,
    });
  } catch (e: any) {
    console.error("[salla:sync:orders] error", e);

    return NextResponse.json(
      { ok: false, error: e?.message || "Orders sync failed" },
      { status: 500 },
    );
  }
}