// FILE: src/app/(dashboard)/dashboard/orders/print-batches/[batchId]/page.tsx

import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import PrintBatchButton from "@/components/orders/print-batch-button";

type BatchRow = {
  id: string;
  tenant_id: string;
  batch_date: string;
  batch_no: number;
  total_orders: number;
  total_items: number;
  status: string;
};

type ProductionItemRow = {
  id: string;
  order_id: string;
  salla_item_id: string | null;
  quantity_index: number;
  qr_code: string;
  print_sequence: number | null;
  status: string | null;
};

type OrderRow = {
  id: string;
  installation_id: string;
  salla_order_id: string;
  order_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: string;
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

type ProductRow = {
  id: string;
  installation_id: string;
  salla_product_id: string;
  name: string | null;
  sku: string | null;
  image_url: string | null;
  raw: any;
};

type ProductMaterialRow = {
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

type PrintCard = {
  productionItemId: string;
  qrCode: string;
  quantityIndex: number;
  totalPiecesInOrder: number;
  printSequence: number | null;

  orderNumber: string | null;
  sallaOrderId: string | null;
  orderDate: string | null;

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

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

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
      if (current == null) {
        current = undefined;
        break;
      }
      current = current[part];
    }

    const found = pickFirstString(current);
    if (found) return found;
  }

  return null;
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

  if (option?.text) {
    return String(option.text);
  }

  return null;
}

function extractProductId(raw: any): string | null {
  return pickFromPaths(raw, [
    "product.id",
    "product_id",
    "item.product.id",
    "item.product_id",
    "id",
  ]);
}

function extractProductName(
  raw: any,
  product?: ProductRow | null,
): string | null {
  return (
    pickFromPaths(raw, [
      "name",
      "product.name",
      "product_title",
      "title",
      "item.name",
    ]) ||
    product?.name ||
    null
  );
}

function extractSku(raw: any, product?: ProductRow | null): string | null {
  return (
    pickFromPaths(raw, ["sku", "product.sku", "variant.sku", "item.sku"]) ||
    product?.sku ||
    null
  );
}

function extractImageUrl(
  orderItemRaw: any,
  product?: ProductRow | null,
): string | null {
  const fromOrderItem = pickFromPaths(orderItemRaw, [
    "image.url",
    "image",
    "product.image.url",
    "product.image",
    "product.thumbnail.url",
    "product.thumbnail",
    "thumbnail.url",
    "thumbnail",
    "thumb.url",
    "thumb",
    "cover.url",
    "cover",
  ]);

  if (fromOrderItem) return fromOrderItem;
  if (product?.image_url) return product.image_url;

  const productRaw = asRecord(product?.raw);
  return pickFromPaths(productRaw, [
    "image.url",
    "image",
    "thumbnail.url",
    "thumbnail",
    "main_image.url",
    "main_image",
  ]);
}

function extractSizeLabel(raw: any): string | null {
  const options = Array.isArray(raw?.options) ? raw.options : [];

  for (const option of options) {
    const name = pickFirstString(option?.name, option?.label, option?.title);
    const value = getOptionValue(option);

    if (name && value && /size|مقاس/i.test(name)) {
      return value;
    }
  }

  return null;
}

function extractOptionsText(raw: any): string | null {
  const options = Array.isArray(raw?.options) ? raw.options : [];
  if (!options.length) return null;

  const parts = options
    .map((option: any) => {
      const name = pickFirstString(option?.name, option?.label, option?.title);
      const value = getOptionValue(option);

      if (!name || !value) return null;
      if (/size|مقاس/i.test(name)) return null;

      return `${name}: ${value}`;
    })
    .filter(Boolean) as string[];

  return parts.length ? parts.join(" + ") : null;
}

function extractCustomerNotes(raw: any): string | null {
  const direct = pickFromPaths(raw, [
    "notes",
    "note",
    "customer_note",
    "comment",
    "message",
    "special_instruction",
    "special_instructions",
  ]);
  if (direct) return direct;

  const options = Array.isArray(raw?.options) ? raw.options : [];
  for (const option of options) {
    const name = pickFirstString(option?.name, option?.label, option?.title);
    const value = getOptionValue(option);

    if (name && value && /ملاح|note|instruction|تعليق/i.test(name)) {
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
    "customer.address.city",
    "customer.city_name",
  ]);
}

function formatOrderDate(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeMaterialRelation(
  materials: ProductMaterialRow["materials"],
): { name: string | null; unit: string | null } | null {
  if (!materials) return null;
  if (Array.isArray(materials)) return materials[0] ?? null;
  return materials;
}

function formatMaterialUsage(
  qty: number | null,
  unit: string | null,
): string | null {
  if (qty == null) return null;
  if (!unit) return `${qty}`;
  return `${qty} ${unit}`;
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

export default async function Page({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: membership } = await supabase
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .in("role", ["owner", "admin"])
    .limit(1)
    .maybeSingle();

  if (!membership?.tenant_id) notFound();

  const { data: batch, error: batchError } = await admin
    .from("print_batches")
    .select(
      "id, tenant_id, batch_date, batch_no, total_orders, total_items, status",
    )
    .eq("id", batchId)
    .eq("tenant_id", membership.tenant_id)
    .single<BatchRow>();

  if (batchError || !batch) notFound();

  const { data: items, error: itemsError } = await admin
    .from("production_items")
    .select(
      "id, order_id, salla_item_id, quantity_index, qr_code, print_sequence, status",
    )
    .eq("tenant_id", membership.tenant_id)
    .eq("print_batch_id", batch.id)
    .order("print_sequence", { ascending: true })
    .order("quantity_index", { ascending: true });

  if (itemsError) throw new Error(itemsError.message);

  const productionItems = (items ?? []) as ProductionItemRow[];
  const orderIds = [...new Set(productionItems.map((x) => x.order_id))];

  const { data: orders } = orderIds.length
    ? await admin
        .from("salla_orders")
        .select(
          "id, installation_id, salla_order_id, order_number, customer_name, customer_phone, created_at, raw",
        )
        .in("id", orderIds)
    : { data: [] };

  const orderRows = (orders ?? []) as OrderRow[];
  const orderMap = new Map(orderRows.map((o) => [o.id, o]));

  const totalPiecesPerOrder = new Map<string, number>();
  for (const item of productionItems) {
    totalPiecesPerOrder.set(
      item.order_id,
      (totalPiecesPerOrder.get(item.order_id) ?? 0) + 1,
    );
  }

  const { data: orderItems } = orderIds.length
    ? await admin
        .from("salla_order_items")
        .select("id, order_id, salla_item_id, sku, name, quantity, price, raw")
        .in("order_id", orderIds)
    : { data: [] };

  const orderItemRows = (orderItems ?? []) as OrderItemRow[];

  const orderItemMap = new Map<string, OrderItemRow>();
  for (const item of orderItemRows) {
    const key = `${item.order_id}::${item.salla_item_id ?? item.id}`;
    orderItemMap.set(key, item);
  }

  const installationIds = [...new Set(orderRows.map((x) => x.installation_id))];

  const { data: products } = installationIds.length
    ? await admin
        .from("salla_products")
        .select(
          "id, installation_id, salla_product_id, name, sku, image_url, raw",
        )
        .in("installation_id", installationIds)
    : { data: [] };

  const productRows = (products ?? []) as ProductRow[];

  const productByInstallationAndSku = new Map<string, ProductRow>();
  const productByInstallationAndName = new Map<string, ProductRow>();
  const productByInstallationAndSallaId = new Map<string, ProductRow>();

  for (const product of productRows) {
    if (product.sku) {
      productByInstallationAndSku.set(
        `${product.installation_id}::${product.sku}`,
        product,
      );
    }
    if (product.name) {
      productByInstallationAndName.set(
        `${product.installation_id}::${product.name}`,
        product,
      );
    }
    if (product.salla_product_id) {
      productByInstallationAndSallaId.set(
        `${product.installation_id}::${product.salla_product_id}`,
        product,
      );
    }
  }

  const sallaProductIds = [
    ...new Set(
      productRows
        .map((product) => product.salla_product_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const { data: productMaterials } = sallaProductIds.length
    ? await admin
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
        .eq("tenant_id", membership.tenant_id)
        .in("salla_product_id", sallaProductIds)
    : { data: [] };

  const materialBySallaProductId = new Map<
    string,
    {
      materialName: string | null;
      materialQtyPerPiece: number | null;
      materialUnit: string | null;
    }
  >();

  for (const row of (productMaterials ?? []) as ProductMaterialRow[]) {
    if (
      !row.salla_product_id ||
      materialBySallaProductId.has(row.salla_product_id)
    ) {
      continue;
    }

    const material = normalizeMaterialRelation(row.materials);

    materialBySallaProductId.set(row.salla_product_id, {
      materialName: material?.name ?? null,
      materialQtyPerPiece: row.qty_per_piece ?? null,
      materialUnit: material?.unit ?? null,
    });
  }

  const cards: PrintCard[] = productionItems.map((item) => {
    const order = orderMap.get(item.order_id);
    const orderItem = orderItemMap.get(
      `${item.order_id}::${item.salla_item_id ?? ""}`,
    );

    const installationId = order?.installation_id ?? "";
    const itemRaw = asRecord(orderItem?.raw);
    const orderRaw = asRecord(order?.raw);
    const rawProductId = extractProductId(itemRaw);

    const product =
      (rawProductId
        ? productByInstallationAndSallaId.get(
            `${installationId}::${rawProductId}`,
          )
        : null) ??
      (orderItem?.sku
        ? productByInstallationAndSku.get(`${installationId}::${orderItem.sku}`)
        : null) ??
      (orderItem?.name
        ? productByInstallationAndName.get(
            `${installationId}::${orderItem.name}`,
          )
        : null) ??
      null;

    const itemName =
      orderItem?.name || extractProductName(itemRaw, product) || null;

    const sku = orderItem?.sku || extractSku(itemRaw, product) || null;

    const material = product
      ? materialBySallaProductId.get(product.salla_product_id)
      : null;

    return {
      productionItemId: item.id,
      qrCode: item.qr_code,
      quantityIndex: item.quantity_index,
      totalPiecesInOrder: totalPiecesPerOrder.get(item.order_id) ?? 1,
      printSequence: item.print_sequence,

      orderNumber: order?.order_number ?? null,
      sallaOrderId: order?.salla_order_id ?? null,
      orderDate: order?.created_at ?? null,

      customerName: order?.customer_name ?? null,
      customerPhone: order?.customer_phone ?? null,
      customerCity: extractCustomerCity(orderRaw),

      itemName,
      sku,
      imageUrl: extractImageUrl(itemRaw, product),
      sizeLabel: extractSizeLabel(itemRaw),
      optionsText: extractOptionsText(itemRaw),
      customerNotes: extractCustomerNotes(itemRaw),

      materialName: material?.materialName ?? null,
      materialQtyPerPiece: material?.materialQtyPerPiece ?? null,
      materialUnit: material?.materialUnit ?? null,
    };
  });

  const pages = chunkArray(cards, 4);

  return (
    <div className="min-h-screen bg-neutral-100 text-black" dir="rtl">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @page { size: A4 portrait; margin: 10mm; }
            @media print {
              html, body { background: #fff !important; }
              .no-print { display: none !important; }
              .print-wrap { max-width: none !important; padding: 0 !important; }
              .print-page { break-after: page; page-break-after: always; margin: 0 !important; min-height: 277mm !important; }
              .print-page:last-child { break-after: auto; page-break-after: auto; }
            }
          `,
        }}
      />

      <div className="no-print sticky top-0 z-10 border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="text-right">
            <div className="text-2xl font-bold">
              دفعة الطباعة #{batch.batch_no}
            </div>
            <div className="mt-1 text-sm text-neutral-500">
              التاريخ: {batch.batch_date} — الطلبات: {batch.total_orders} —
              القطع: {batch.total_items}
            </div>
          </div>

          <PrintBatchButton />
        </div>
      </div>

      <div className="print-wrap mx-auto max-w-[210mm] p-4 print:p-0">
        {cards.length === 0 ? (
          <div className="rounded-2xl border bg-white p-10 text-center">
            لا توجد قطع داخل هذه الدفعة
          </div>
        ) : (
          pages.map((page, pageIndex) => (
            <div
              key={pageIndex}
              className="print-page mb-4 grid min-h-[277mm] grid-cols-2 gap-4 bg-white p-4 print:mb-0 print:gap-3 print:p-0"
            >
              {page.map((card) => (
                <div
                  key={card.productionItemId}
                  className="flex h-[132mm] flex-col overflow-hidden rounded-2xl border border-neutral-300 bg-white"
                >
                  <div className="flex items-start justify-between border-b px-4 py-3">
                    <div className="text-right">
                      <div className="text-xs text-neutral-500">رقم الطلب</div>
                      <div className="font-bold">
                        {card.orderNumber || card.sallaOrderId || "-"}
                      </div>

                      <div className="mt-2 text-xs text-neutral-500">
                        تاريخ الطلب
                      </div>
                      <div className="font-medium">
                        {formatOrderDate(card.orderDate)}
                      </div>
                    </div>

                    <div className="text-left">
                      <div className="text-xs text-neutral-500">رقم القطعة</div>
                      <div className="font-bold">
                        #{card.quantityIndex}-{card.totalPiecesInOrder}
                      </div>
                    </div>
                  </div>

                  <div className="grid flex-1 grid-cols-[110px_1fr] gap-4 p-4">
                    <div className="flex h-[110px] w-[110px] items-center justify-center overflow-hidden rounded-xl border bg-neutral-50">
                      {card.imageUrl ? (
                        <img
                          src={card.imageUrl}
                          alt={card.itemName || "product"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="text-center text-xs text-neutral-400">
                          لا توجد صورة
                        </div>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-col gap-2 text-right">
                      {card.itemName && (
                        <div>
                          <div className="text-xs text-neutral-500">المنتج</div>
                          <div className="line-clamp-2 font-bold">
                            {card.itemName}
                          </div>
                        </div>
                      )}

                      {card.sizeLabel && (
                        <div>
                          <div className="text-xs text-neutral-500">المقاس</div>
                          <div className="font-medium">{card.sizeLabel}</div>
                        </div>
                      )}

                      {card.optionsText && (
                        <div>
                          <div className="text-xs text-neutral-500">
                            الخيارات
                          </div>
                          <div className="line-clamp-2 text-sm font-medium">
                            {card.optionsText}
                          </div>
                        </div>
                      )}

                      {(card.materialName ||
                        card.materialQtyPerPiece != null) && (
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <Field label="القماش" value={card.materialName} />
                          <Field
                            label="الاستهلاك"
                            value={formatMaterialUsage(
                              card.materialQtyPerPiece,
                              card.materialUnit,
                            )}
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <Field label="SKU" value={card.sku} />
                        <Field label="العميل" value={card.customerName} />
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <Field label="المدينة" value={card.customerCity} />
                      </div>

                      {card.customerNotes && (
                        <div className="text-sm">
                          <div className="text-xs text-neutral-500">
                            ملاحظات العميل
                          </div>
                          <div className="line-clamp-3 min-h-[48px] rounded-lg border bg-neutral-50 px-3 py-2">
                            {card.customerNotes}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t px-4 py-3">
                    <div className="grid grid-cols-[96px_1fr] items-end gap-4">
                      <div className="flex h-[96px] w-[96px] items-center justify-center rounded-xl border bg-white p-2">
                        <img
                          alt={card.qrCode}
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                            card.qrCode,
                          )}`}
                          className="h-full w-full"
                        />
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-neutral-500">
                          QR / الباركود
                        </div>
                        <div className="mt-1 break-all rounded-lg border bg-neutral-50 px-3 py-2 font-mono text-[11px] leading-5">
                          {card.qrCode}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {page.length < 4 &&
                Array.from({ length: 4 - page.length }).map((_, i) => (
                  <div
                    key={`empty-${pageIndex}-${i}`}
                    className="h-[132mm] rounded-2xl border border-dashed border-neutral-200 bg-white"
                  />
                ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
