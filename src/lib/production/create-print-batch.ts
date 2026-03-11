// FILE: src/lib/production/create-print-batch.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildProductionItemsForOrder } from "@/lib/production/build-production-items";

type CreatePrintBatchParams = {
  admin: SupabaseClient;
  tenantId: string;
  userId: string;
  batchDate: string;
};

export async function createPrintBatch(params: CreatePrintBatchParams) {
  const { admin, tenantId, userId, batchDate } = params;

  const { data: installationIds, error: installationsError } = await admin
    .from("salla_installations")
    .select("id")
    .eq("tenant_id", tenantId);

  if (installationsError) {
    throw new Error("تعذر قراءة إعدادات ربط سلة");
  }

  const ids = (installationIds ?? []).map((x) => x.id);

  if (ids.length === 0) {
    throw new Error("لا يوجد ربط سلة مفعّل لهذا الحساب");
  }

  const { data: candidateOrders, error: ordersError } = await admin
    .from("salla_orders")
    .select("id, installation_id, status")
    .in("installation_id", ids)
    .in("status", ["pending", "under_review", "processing", "new"]);

  if (ordersError) {
    throw new Error("تعذر جلب الطلبات من قاعدة البيانات");
  }

  const orderIds = (candidateOrders ?? []).map((o) => o.id);

  if (orderIds.length === 0) {
    throw new Error("لا توجد طلبات معلّقة حاليًا");
  }

  const { data: alreadyLinked, error: linkedError } = await admin
    .from("print_batch_orders")
    .select("order_id")
    .eq("tenant_id", tenantId)
    .in("order_id", orderIds);

  if (linkedError) {
    throw new Error("تعذر التحقق من الطلبات المرتبطة بدفعات الطباعة");
  }

  const linkedSet = new Set((alreadyLinked ?? []).map((x) => x.order_id));
  const orders = (candidateOrders ?? []).filter((o) => !linkedSet.has(o.id));

  if (orders.length === 0) {
    throw new Error("لا توجد طلبات معلّقة غير مطبوعة لهذا اليوم");
  }

  const { data: lastBatch } = await admin
    .from("print_batches")
    .select("batch_no")
    .eq("tenant_id", tenantId)
    .eq("batch_date", batchDate)
    .order("batch_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextBatchNo = (lastBatch?.batch_no ?? 0) + 1;

  const { data: batch, error: batchError } = await admin
    .from("print_batches")
    .insert({
      tenant_id: tenantId,
      batch_date: batchDate,
      batch_no: nextBatchNo,
      status: "draft",
      created_by: userId,
    })
    .select("id, tenant_id, batch_date, batch_no, status")
    .single();

  if (batchError || !batch) {
    throw new Error("تعذر إنشاء دفعة الطباعة");
  }

  let totalOrders = 0;
  let totalItems = 0;
  let sequence = 1;

  for (const order of orders) {
    await buildProductionItemsForOrder({
      supabase: admin,
      tenantId,
      orderId: order.id,
    });

    const { data: freeItems, error: freeItemsError } = await admin
      .from("production_items")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("order_id", order.id)
      .is("print_batch_id", null)
      .order("quantity_index", { ascending: true });

    if (freeItemsError) {
      throw new Error("تعذر تجهيز عناصر الإنتاج للطباعة");
    }

    if (!freeItems || freeItems.length === 0) {
      continue;
    }

    const { error: linkOrderError } = await admin
      .from("print_batch_orders")
      .insert({
        tenant_id: tenantId,
        print_batch_id: batch.id,
        order_id: order.id,
      });

    if (linkOrderError) {
      throw new Error("تعذر ربط الطلب بدفعة الطباعة");
    }

    totalOrders += 1;
    totalItems += freeItems.length;

    for (const item of freeItems) {
      const { error: updateError } = await admin
        .from("production_items")
        .update({
          print_batch_id: batch.id,
          printed_at: new Date().toISOString(),
          print_sequence: sequence,
        })
        .eq("id", item.id);

      if (updateError) {
        throw new Error("تعذر تحديث عناصر الطباعة");
      }

      sequence += 1;
    }
  }

  if (totalOrders === 0 || totalItems === 0) {
    await admin.from("print_batches").delete().eq("id", batch.id);
    throw new Error("لا توجد عناصر جاهزة للطباعة في الطلبات الحالية");
  }

  const { error: finishError } = await admin
    .from("print_batches")
    .update({
      total_orders: totalOrders,
      total_items: totalItems,
      status: "ready",
    })
    .eq("id", batch.id);

  if (finishError) {
    throw new Error("تم إنشاء الدفعة لكن تعذر إنهاء تحديث حالتها");
  }

  return {
    batch: {
      ...batch,
      total_orders: totalOrders,
      total_items: totalItems,
      status: "ready",
    },
    totalOrders,
    totalItems,
  };
}
