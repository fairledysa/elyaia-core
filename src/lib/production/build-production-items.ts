// FILE: src/lib/production/build-production-items.ts

import { SupabaseClient } from "@supabase/supabase-js";

type OrderRow = {
  id: string;
  salla_order_id: string | null;
  order_number: string | null;
};

type OrderItemRow = {
  id: string;
  salla_item_id: string | null;
  quantity: number;
  name: string | null;
};

type BuildResult = {
  created: number;
  skipped: number;
  items: Array<{
    id: string;
    order_id: string;
    salla_item_id: string | null;
    quantity_index: number;
    qr_code: string;
    status: string | null;
  }>;
};

function normalizePart(value: string | null | undefined, fallback: string) {
  if (!value || !value.trim()) return fallback;
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 50) || fallback;
}

function buildQrCode(params: {
  tenantId: string;
  orderId: string;
  sallaItemId: string | null;
  quantityIndex: number;
}) {
  const orderPart = normalizePart(params.orderId, "order");
  const itemPart = normalizePart(params.sallaItemId, "item");
  return `PI-${orderPart}-${itemPart}-${params.quantityIndex}`;
}

export async function buildProductionItemsForOrder(params: {
  supabase: SupabaseClient;
  tenantId: string;
  orderId: string;
}): Promise<BuildResult> {
  const { supabase, tenantId, orderId } = params;

  const { data: order, error: orderError } = await supabase
    .from("salla_orders")
    .select("id, salla_order_id, order_number")
    .eq("id", orderId)
    .single<OrderRow>();

  if (orderError || !order) {
    throw new Error("ORDER_NOT_FOUND");
  }

  const { data: orderItems, error: itemsError } = await supabase
    .from("salla_order_items")
    .select("id, salla_item_id, quantity, name")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  if (!orderItems || orderItems.length === 0) {
    return {
      created: 0,
      skipped: 0,
      items: [],
    };
  }

  const rowsToInsert: Array<{
    tenant_id: string;
    order_id: string;
    salla_item_id: string | null;
    quantity_index: number;
    qr_code: string;
    status: string;
  }> = [];

  for (const item of orderItems as OrderItemRow[]) {
    const qty = Math.max(1, Number(item.quantity || 0));

    for (let i = 1; i <= qty; i += 1) {
      rowsToInsert.push({
        tenant_id: tenantId,
        order_id: orderId,
        salla_item_id: item.salla_item_id ?? item.id,
        quantity_index: i,
        qr_code: buildQrCode({
          tenantId,
          orderId,
          sallaItemId: item.salla_item_id ?? item.id,
          quantityIndex: i,
        }),
        status: "pending",
      });
    }
  }

  if (rowsToInsert.length === 0) {
    return {
      created: 0,
      skipped: 0,
      items: [],
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("production_items")
    .upsert(rowsToInsert, {
      onConflict: "order_id,salla_item_id,quantity_index",
      ignoreDuplicates: true,
    })
    .select("id, order_id, salla_item_id, quantity_index, qr_code, status");

  if (insertError) {
    throw new Error(insertError.message);
  }

  const { data: allItems, error: allItemsError } = await supabase
    .from("production_items")
    .select("id, order_id, salla_item_id, quantity_index, qr_code, status")
    .eq("tenant_id", tenantId)
    .eq("order_id", orderId)
    .order("quantity_index", { ascending: true });

  if (allItemsError) {
    throw new Error(allItemsError.message);
  }

  const createdCount = inserted?.length ?? 0;
  const totalExpected = rowsToInsert.length;

  return {
    created: createdCount,
    skipped: Math.max(0, totalExpected - createdCount),
    items: allItems ?? [],
  };
}
