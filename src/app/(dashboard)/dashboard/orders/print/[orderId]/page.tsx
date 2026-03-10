"use client";

// FILE: src/app/(dashboard)/dashboard/orders/print/[orderId]/page.tsx

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Card = {
  id?: string;
  productionItemId?: string;
  qr_code?: string;
  qrCode?: string;
  quantity_index?: number;
  quantityIndex?: number;
  status?: string | null;
  order_id?: string;
  orderId?: string;
  salla_item_id?: string | null;
  sallaItemId?: string | null;
  orderNumber?: string | null;
  sallaOrderId?: string | null;
  itemName?: string | null;
  sku?: string | null;
  imageUrl?: string | null;
  sizeLabel?: string | null;
  optionsText?: string | null;
  customerName?: string | null;
  customerCity?: string | null;
  customerNotes?: string | null;
  materialName?: string | null;
  materialQtyPerPiece?: number | null;
  materialUnit?: string | null;
};

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function normalizeCard(card: Card) {
  return {
    productionItemId: card.productionItemId ?? card.id ?? "",
    qrCode: card.qrCode ?? card.qr_code ?? "",
    quantityIndex: card.quantityIndex ?? card.quantity_index ?? 0,
    status: card.status ?? null,
    orderId: card.orderId ?? card.order_id ?? "",
    sallaItemId: card.sallaItemId ?? card.salla_item_id ?? null,
    orderNumber: card.orderNumber ?? null,
    sallaOrderId: card.sallaOrderId ?? null,
    itemName: card.itemName ?? null,
    sku: card.sku ?? null,
    imageUrl: card.imageUrl ?? null,
    sizeLabel: card.sizeLabel ?? null,
    optionsText: card.optionsText ?? null,
    customerName: card.customerName ?? null,
    customerCity: card.customerCity ?? null,
    customerNotes: card.customerNotes ?? null,
    materialName: card.materialName ?? null,
    materialQtyPerPiece: card.materialQtyPerPiece ?? null,
    materialUnit: card.materialUnit ?? null,
  };
}

function formatMaterialUsage(
  qty: number | null,
  unit: string | null | undefined,
): string | null {
  if (qty === null || qty === undefined) return null;
  const normalizedUnit = unit?.trim() || "متر";
  return `${qty} ${normalizedUnit}`;
}

export default function PrintOrderPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params?.orderId ?? "";

  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/orders/${orderId}/production-items`, {
          method: "POST",
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.error || "FAILED_TO_LOAD_PRINT_ITEMS");
        }

        if (!cancelled) {
          setCards(Array.isArray(json?.items) ? json.items : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "INTERNAL_ERROR");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (orderId) {
      run();
    }

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const normalizedCards = useMemo(() => cards.map(normalizeCard), [cards]);
  const pages = useMemo(
    () => chunkArray(normalizedCards, 4),
    [normalizedCards],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 text-black">
        جاري تحميل بطاقات الطباعة...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-6 text-black">
        <div className="rounded-2xl border bg-white p-6 text-center shadow-sm">
          <div className="mb-2 text-lg font-bold">تعذر تحميل صفحة الطباعة</div>
          <div className="text-sm text-red-600">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 text-black">
      <style>{`
        @page {
          size: A4 portrait;
          margin: 10mm;
        }

        @media print {
          html, body {
            background: white !important;
          }

          .no-print {
            display: none !important;
          }

          .print-page {
            break-after: page;
            page-break-after: always;
          }

          .print-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
        <div className="text-right">
          <div className="text-lg font-bold">طباعة بطاقات الإنتاج</div>
          <div className="text-sm text-neutral-500">الطلب #{orderId}</div>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
        >
          طباعة
        </button>
      </div>

      <div className="mx-auto max-w-[210mm] p-4 print:p-0">
        {pages.length === 0 ? (
          <div className="rounded-2xl border bg-white p-8 text-center">
            لا توجد بطاقات للطباعة
          </div>
        ) : (
          pages.map((page, pageIndex) => (
            <div
              key={pageIndex}
              className="print-page mb-4 grid min-h-[277mm] grid-cols-2 gap-4 bg-white p-4 print:mb-0 print:min-h-0 print:gap-3 print:p-0"
            >
              {page.map((card) => (
                <div
                  key={card.productionItemId}
                  className="flex h-[132mm] flex-col overflow-hidden rounded-2xl border border-neutral-300 bg-white"
                >
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <div className="text-right">
                      <div className="text-sm text-neutral-500">رقم الطلب</div>
                      <div className="font-bold">
                        {card.orderNumber ||
                          card.sallaOrderId ||
                          card.orderId ||
                          "-"}
                      </div>
                    </div>

                    <div className="text-left">
                      <div className="text-sm text-neutral-500">رقم القطعة</div>
                      <div className="font-bold">#{card.quantityIndex}</div>
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
                      <div>
                        <div className="text-sm text-neutral-500">المنتج</div>
                        <div className="line-clamp-2 font-bold">
                          {card.itemName || "-"}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-neutral-500">المقاس</div>
                          <div className="font-medium">
                            {card.sizeLabel || "-"}
                          </div>
                        </div>

                        <div>
                          <div className="text-neutral-500">SKU</div>
                          <div className="font-medium">{card.sku || "-"}</div>
                        </div>
                      </div>

                      <div className="text-sm">
                        <div className="text-neutral-500">الخيارات</div>
                        <div className="line-clamp-2 rounded-lg border bg-neutral-50 px-3 py-2">
                          {card.optionsText || "-"}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-neutral-500">القماش</div>
                          <div className="font-medium">
                            {card.materialName || "-"}
                          </div>
                        </div>

                        <div>
                          <div className="text-neutral-500">الاستهلاك</div>
                          <div className="font-medium">
                            {formatMaterialUsage(
                              card.materialQtyPerPiece,
                              card.materialUnit,
                            ) || "-"}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-neutral-500">العميل</div>
                          <div className="font-medium">
                            {card.customerName || "-"}
                          </div>
                        </div>

                        <div>
                          <div className="text-neutral-500">المدينة</div>
                          <div className="font-medium">
                            {card.customerCity || "-"}
                          </div>
                        </div>
                      </div>

                      <div className="text-sm">
                        <div className="text-neutral-500">ملاحظات العميل</div>
                        <div className="line-clamp-3 min-h-[48px] rounded-lg border bg-neutral-50 px-3 py-2">
                          {card.customerNotes || "-"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t px-4 py-3">
                    <div className="flex items-end justify-between gap-4">
                      <div className="text-right">
                        <div className="text-sm text-neutral-500">QR</div>
                        <div className="break-all font-mono text-xs">
                          {card.qrCode}
                        </div>
                      </div>

                      <div className="flex h-[88px] w-[88px] items-center justify-center rounded-xl border bg-white p-2">
                        <img
                          alt={card.qrCode}
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                            card.qrCode,
                          )}`}
                          className="h-full w-full"
                        />
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
