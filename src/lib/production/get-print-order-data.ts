// FILE: src/lib/production/get-print-order-data.ts

import type { SupabaseClient } from "@supabase/supabase-js";

type OrderRow = {
  id: string;
  installation_id: string;
  salla_order_id: string;
  order_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  raw: any;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  salla_item_id: string | null;
  sku: string | null;
  name: string | null;
  quantity: number;
  price: number | null;
  raw: any;
};

type ProductionItemRow = {
  id: string;
  order_id: string;
  salla_item_id: string | null;
  quantity_index: number;
  qr_code: string;
  status: string | null;
};

type SallaProductRow = {
  salla_product_id: string;
  sku: string | null;
};

type MaterialJoinRow = {
  salla_product_id: string;
  qty_per_piece: number | null;
  materials:
    | {
        name: string | null;
        unit: string | null;
      }
    | {
        name: string | null;
        unit: string | null;
      }[]
    | null;
};

export type PrintCardItem = {
  productionItemId: string;
  qrCode: string;
  quantityIndex: number;
  status: string | null;

  orderId: string;
  orderNumber: string | null;
  sallaOrderId: string | null;

  customerName: string | null;
  customerPhone: string | null;
  customerCity: string | null;

  itemName: string | null;
  sku: string | null;
  imageUrl: string | null;

  sizeLabel: string | null;
  optionsText: string | null;
  customerNotes: string | null;

  materialName: string | null;
  materialQtyPerPiece: number | null;
  materialUnit: string | null;
};

export type PrintOrderData = {
  orderId: string;
  orderNumber: string | null;
  sallaOrderId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerCity: string | null;
  cards: PrintCardItem[];
};

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function pickFirstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

function pickFromPaths(obj: any, paths: string[]): string | null {
  for (const path of paths) {
    const parts = path.split(".");
    let current: any = obj;

    for (const part of parts) {
      if (!current) break;
      current = current[part];
    }

    const value = pickFirstString(current);
    if (value) return value;
  }

  return null;
}

function extractImageUrl(raw: any): string | null {
  return pickFromPaths(raw, [
    "image.url",
    "image",
    "product.image.url",
    "product.image",
    "thumbnail.url",
    "thumbnail",
  ]);
}

function getOptionValue(option: any): string | null {
  if (!option) return null;

  if (typeof option.value === "object" && option.value?.name) {
    return String(option.value.name);
  }

  if (typeof option.value === "string") {
    return option.value;
  }

  if (option?.display_value) {
    return String(option.display_value);
  }

  if (option?.option_value) {
    return String(option.option_value);
  }

  return null;
}

function extractSizeLabel(raw: any): string | null {
  const options = Array.isArray(raw?.options) ? raw.options : [];

  for (const option of options) {
    const name = pickFirstString(option?.name, option?.label);
    const value = getOptionValue(option);

    if (name && value && /size|مقاس/i.test(name)) {
      return value;
    }
  }

  return null;
}

function extractOptionsText(raw: any): string | null {
  const options = Array.isArray(raw?.options) ? raw.options : [];

  const parts: string[] = [];

  for (const option of options) {
    const name = pickFirstString(option?.name, option?.label);
    const value = getOptionValue(option);

    if (name && value) {
      parts.push(`${name}: ${value}`);
    }
  }

  if (parts.length === 0) return null;

  return parts.join(" / ");
}

function extractCustomerNotes(raw: any): string | null {
  const direct = pickFromPaths(raw, [
    "notes",
    "note",
    "customer_note",
    "comment",
  ]);

  if (direct) return direct;

  const options = Array.isArray(raw?.options) ? raw.options : [];

  for (const option of options) {
    const name = pickFirstString(option?.name);
    const value = getOptionValue(option);

    if (name && value && /ملاح|note|تعليق/i.test(name)) {
      return value;
    }
  }

  return null;
}

function extractCustomerCity(orderRaw: any): string | null {
  return pickFromPaths(orderRaw, [
    "customer.city",
    "shipping.address.city",
    "shipping.city",
    "address.city",
    "billing_address.city",
  ]);
}

function extractRawProductId(raw: any): string | null {
  return pickFromPaths(raw, ["product.id", "product_id", "id"]);
}

function normalizeMaterialsRelation(
  materials: MaterialJoinRow["materials"],
): { name: string | null; unit: string | null } | null {
  if (!materials) return null;
  if (Array.isArray(materials)) return materials[0] ?? null;
  return materials;
}

export async function getPrintOrderData(params: {
  supabase: SupabaseClient;
  tenantId: string;
  orderId: string;
}): Promise<PrintOrderData> {
  const { supabase, tenantId, orderId } = params;

  const { data: order } = await supabase
    .from("salla_orders")
    .select(
      "id, installation_id, salla_order_id, order_number, customer_name, customer_phone, raw",
    )
    .eq("id", orderId)
    .single<OrderRow>();

  if (!order) throw new Error("ORDER_NOT_FOUND");

  const { data: orderItems } = await supabase
    .from("salla_order_items")
    .select("id, order_id, salla_item_id, sku, name, quantity, price, raw")
    .eq("order_id", orderId);

  const { data: productionItems } = await supabase
    .from("production_items")
    .select("id, order_id, salla_item_id, quantity_index, qr_code, status")
    .eq("tenant_id", tenantId)
    .eq("order_id", orderId);

  const { data: sallaProducts } = await supabase
    .from("salla_products")
    .select("salla_product_id, sku")
    .eq("installation_id", order.installation_id);

  const { data: materials } = await supabase
    .from("product_materials")
    .select(
      `
      salla_product_id,
      qty_per_piece,
      materials (
        name,
        unit
      )
    `,
    )
    .eq("tenant_id", tenantId);

  const productIdBySku = new Map<string, string>();

  for (const product of (sallaProducts ?? []) as SallaProductRow[]) {
    const sku = pickFirstString(product.sku);
    const productId = pickFirstString(product.salla_product_id);

    if (sku && productId && !productIdBySku.has(sku)) {
      productIdBySku.set(sku, productId);
    }
  }

  const materialMap = new Map<
    string,
    {
      materialName: string | null;
      materialQtyPerPiece: number | null;
      materialUnit: string | null;
    }
  >();

  for (const row of (materials ?? []) as MaterialJoinRow[]) {
    const productId = pickFirstString(row.salla_product_id);
    if (!productId || materialMap.has(productId)) continue;

    const material = normalizeMaterialsRelation(row.materials);

    materialMap.set(productId, {
      materialName: material?.name ?? null,
      materialQtyPerPiece: row.qty_per_piece ?? null,
      materialUnit: material?.unit ?? null,
    });
  }

  const itemMap = new Map<string, OrderItemRow>();

  for (const item of orderItems ?? []) {
    const key = item.salla_item_id ?? item.id;
    itemMap.set(key, item);
  }

  const orderRaw = asRecord(order.raw);

  const cards: PrintCardItem[] = (productionItems ?? []).map((p) => {
    const key = p.salla_item_id ?? "";
    const orderItem = itemMap.get(key);

    const raw = asRecord(orderItem?.raw);

    const sku = pickFirstString(orderItem?.sku);
    const rawProductId = extractRawProductId(raw);
    const mappedProductId =
      (sku ? productIdBySku.get(sku) : null) ?? rawProductId ?? null;

    const material = mappedProductId ? materialMap.get(mappedProductId) : null;

    return {
      productionItemId: p.id,
      qrCode: p.qr_code,
      quantityIndex: p.quantity_index,
      status: p.status,

      orderId: order.id,
      orderNumber: order.order_number,
      sallaOrderId: order.salla_order_id,

      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      customerCity: extractCustomerCity(orderRaw),

      itemName: orderItem?.name ?? null,
      sku: sku ?? null,
      imageUrl: extractImageUrl(raw),

      sizeLabel: extractSizeLabel(raw),
      optionsText: extractOptionsText(raw),
      customerNotes: extractCustomerNotes(raw),

      materialName: material?.materialName ?? null,
      materialQtyPerPiece: material?.materialQtyPerPiece ?? null,
      materialUnit: material?.materialUnit ?? null,
    };
  });

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    sallaOrderId: order.salla_order_id,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    customerCity: extractCustomerCity(orderRaw),
    cards,
  };
}
