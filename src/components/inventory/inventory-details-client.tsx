// FILE: src/components/inventory/inventory-details-client.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type MaterialRow = {
  id: string;
  name: string;
  unit: string;
  on_hand: number;
  unit_cost: number;
  reorder_level: number;
  allow_negative: boolean;
};

type InventoryMoveApiRow = {
  id: string;
  material_id: string;
  material_name: string | null;
  material_unit: string | null;
  stage_event_id: string | null;
  quantity: number;
  move_type: string;
  direction: "in" | "out" | "neutral";
  unit_cost: number | null;
  total_cost: number | null;
  note: string | null;
  running_balance: number | null;
  created_at: string;
  created_by: { id: string; name: string } | null;
  user: { id: string; name: string } | null;
  meta: {
    source: string | null;
    created_from: string | null;
    reason: string | null;
    order_id: string | null;
    order_number: string | null;
    production_item_id: string | null;
    quantity_index: number | null;
    salla_item_id: string | null;
    sku: string | null;
    product_name: string | null;
    stage_id: string | null;
    stage_name: string | null;
    employee_id: string | null;
    employee_user_id: string | null;
    employee_name: string | null;
  };
};

type MoveTypeValue =
  | "purchase_in"
  | "manual_add"
  | "manual_remove"
  | "adjustment"
  | "return_in";

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const txt = await res.text();
  if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
  return JSON.parse(txt) as T;
}

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("ar-SA", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatQty(value: number | null | undefined) {
  return new Intl.NumberFormat("ar-SA", {
    maximumFractionDigits: 3,
  }).format(Number(value || 0));
}

function moveTypeLabel(moveType: string) {
  switch (moveType) {
    case "purchase_in":
      return "شراء";
    case "manual_add":
      return "إضافة يدوية";
    case "manual_remove":
      return "سحب يدوي";
    case "adjustment":
      return "تسوية";
    case "return_in":
      return "مرتجع";
    case "production_deduct":
      return "خصم إنتاج";
    default:
      return moveType;
  }
}

export default function InventoryDetailsClient({
  materialId,
}: {
  materialId: string;
}) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [item, setItem] = useState<MaterialRow | null>(null);
  const [moves, setMoves] = useState<InventoryMoveApiRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [moveOpen, setMoveOpen] = useState(false);
  const [moveType, setMoveType] = useState<MoveTypeValue>("purchase_in");
  const [moveQty, setMoveQty] = useState<string>("");
  const [moveUnitCost, setMoveUnitCost] = useState<string>("");
  const [moveNote, setMoveNote] = useState<string>("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const materialsRes = await j<{ ok: boolean; items: MaterialRow[] }>(
        "/api/materials",
      );
      const found = (materialsRes.items || []).find((x) => x.id === materialId);

      if (!found) {
        setError("المادة غير موجودة");
        setItem(null);
        setMoves([]);
        return;
      }

      setItem(found);

      const movesRes = await j<{ ok: boolean; items: InventoryMoveApiRow[] }>(
        `/api/inventory/moves?material_id=${encodeURIComponent(materialId)}&limit=100`,
      );
      setMoves(movesRes.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [materialId]);

  const stockValue = useMemo(() => {
    if (!item) return 0;
    return Number(item.on_hand || 0) * Number(item.unit_cost || 0);
  }, [item]);

  async function saveItem() {
    if (!item) return;

    setSaving(true);
    setError(null);
    try {
      await j(`/api/materials/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.name,
          unit: item.unit,
          unit_cost: item.unit_cost,
          reorder_level: item.reorder_level,
          allow_negative: item.allow_negative,
        }),
      });

      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل حفظ المادة");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem() {
    if (!item) return;

    const ok = window.confirm("تأكيد حذف المادة؟");
    if (!ok) return;

    setDeleting(true);
    setError(null);
    try {
      await j(`/api/materials/${encodeURIComponent(item.id)}`, {
        method: "DELETE",
      });
      router.push("/dashboard/inventory");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل حذف المادة");
    } finally {
      setDeleting(false);
    }
  }

  async function submitMove() {
    if (!item) return;

    const qtyRaw = Number(moveQty);
    if (!Number.isFinite(qtyRaw) || qtyRaw <= 0) return;

    let signedDelta = Math.abs(qtyRaw);
    if (moveType === "manual_remove") {
      signedDelta = -Math.abs(qtyRaw);
    }

    setSaving(true);
    setError(null);
    try {
      await j("/api/materials/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          material_id: item.id,
          delta: signedDelta,
          move_type: moveType,
          unit_cost: moveUnitCost === "" ? 0 : Number(moveUnitCost),
          note: moveNote.trim() || null,
        }),
      });

      setMoveOpen(false);
      setMoveQty("");
      setMoveUnitCost("");
      setMoveNote("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل تنفيذ الحركة");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        جاري التحميل...
      </div>
    );
  }

  if (!item) {
    return (
      <div className="space-y-4">
        <Button asChild variant="outline">
          <Link href="/dashboard/inventory" className="gap-2">
            <ArrowRight className="h-4 w-4" />
            الرجوع إلى المخزون
          </Link>
        </Button>

        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {error || "المادة غير موجودة"}
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLow = Number(item.on_hand || 0) <= Number(item.reorder_level || 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">تفاصيل المادة</h1>
          <p className="text-sm text-muted-foreground">
            تعديل المادة وعرض آخر حركاتها
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/inventory" className="gap-2">
              <ArrowRight className="h-4 w-4" />
              الرجوع إلى المخزون
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setMoveType("purchase_in");
              setMoveQty("");
              setMoveUnitCost(String(item.unit_cost ?? 0));
              setMoveNote("");
              setMoveOpen(true);
            }}
          >
            حركة مخزون
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">الرصيد الحالي</div>
            <div className="mt-1 text-2xl font-semibold">
              {formatQty(item.on_hand)} {item.unit}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">تكلفة الوحدة</div>
            <div className="mt-1 text-2xl font-semibold">
              {formatMoney(item.unit_cost)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">قيمة المخزون</div>
            <div className="mt-1 text-2xl font-semibold">
              {formatMoney(stockValue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">الحالة</div>
            <div
              className={`mt-1 inline-flex rounded-md px-3 py-1 text-sm ${
                isLow
                  ? "bg-red-50 text-red-700"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {isLow ? "منخفض" : "جيد"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">بيانات المادة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm">اسم المادة</div>
              <Input
                value={item.name}
                onChange={(e) =>
                  setItem((prev) =>
                    prev ? { ...prev, name: e.target.value } : prev,
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm">الوحدة</div>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={item.unit}
                onChange={(e) =>
                  setItem((prev) =>
                    prev ? { ...prev, unit: e.target.value } : prev,
                  )
                }
              >
                <option value="m">متر</option>
                <option value="pcs">قطعة</option>
                <option value="roll">لفة</option>
              </select>
            </div>

            <div className="space-y-2">
              <div className="text-sm">تكلفة الوحدة</div>
              <Input
                inputMode="decimal"
                value={String(item.unit_cost ?? 0)}
                onChange={(e) =>
                  setItem((prev) =>
                    prev
                      ? { ...prev, unit_cost: Number(e.target.value || 0) }
                      : prev,
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm">حد التنبيه</div>
              <Input
                inputMode="decimal"
                value={String(item.reorder_level ?? 0)}
                onChange={(e) =>
                  setItem((prev) =>
                    prev
                      ? { ...prev, reorder_level: Number(e.target.value || 0) }
                      : prev,
                  )
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <div className="text-sm font-medium">السماح بالمخزون السالب</div>
              <div className="text-xs text-muted-foreground">
                يسمح بالسحب حتى عند نفاد الرصيد
              </div>
            </div>
            <Switch
              checked={!!item.allow_negative}
              onCheckedChange={(v) =>
                setItem((prev) =>
                  prev ? { ...prev, allow_negative: v } : prev,
                )
              }
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={deleteItem}
              disabled={deleting || saving}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>

            <Button
              type="button"
              className="gap-2"
              onClick={saveItem}
              disabled={saving || deleting}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              حفظ
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">آخر الحركات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-xl border">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="p-3 text-center">الحركة</th>
                  <th className="p-3 text-center">الكمية</th>
                  <th className="p-3 text-center">المتبقي</th>
                  <th className="p-3 text-center">تكلفة</th>
                  <th className="p-3 text-right">المنفذ</th>
                  <th className="p-3 text-right">المرحلة</th>
                  <th className="p-3 text-right">SKU</th>
                  <th className="p-3 text-right">الطلب</th>
                  <th className="p-3 text-right">ملاحظة</th>
                  <th className="p-3 text-center">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {moves.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="p-3 text-center">
                      {moveTypeLabel(r.move_type)}
                    </td>
                    <td className="p-3 text-center">{formatQty(r.quantity)}</td>
                    <td className="p-3 text-center">
                      {r.running_balance == null
                        ? "—"
                        : formatQty(r.running_balance)}
                    </td>
                    <td className="p-3 text-center">
                      {r.unit_cost == null ? "—" : formatMoney(r.unit_cost)}
                    </td>
                    <td className="p-3">{r.created_by?.name || "—"}</td>
                    <td className="p-3">{r.meta.stage_name || "—"}</td>
                    <td className="p-3">{r.meta.sku || "—"}</td>
                    <td className="p-3">{r.meta.order_number || "—"}</td>
                    <td className="p-3">{r.note || "—"}</td>
                    <td className="p-3 text-center">
                      {new Date(r.created_at).toLocaleString("ar-SA")}
                    </td>
                  </tr>
                ))}

                {!moves.length ? (
                  <tr>
                    <td
                      className="p-6 text-center text-sm text-muted-foreground"
                      colSpan={10}
                    >
                      لا توجد حركات لهذه المادة.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>حركة مخزون</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-xl border p-3">
              <div className="font-medium">{item.name}</div>
              <div className="text-xs text-muted-foreground">
                الرصيد الحالي: {formatQty(item.on_hand)} {item.unit}
              </div>
            </div>

            <div className="grid gap-2">
              <div className="text-xs text-muted-foreground">نوع الحركة</div>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={moveType}
                onChange={(e) => setMoveType(e.target.value as MoveTypeValue)}
              >
                <option value="purchase_in">شراء</option>
                <option value="manual_add">إضافة يدوية</option>
                <option value="manual_remove">سحب يدوي</option>
                <option value="adjustment">تسوية</option>
                <option value="return_in">مرتجع</option>
              </select>
            </div>

            <div className="grid gap-2">
              <div className="text-xs text-muted-foreground">
                الكمية (رقم موجب)
              </div>
              <Input
                inputMode="decimal"
                value={moveQty}
                onChange={(e) => setMoveQty(e.target.value)}
                placeholder="مثال: 10"
              />
            </div>

            <div className="grid gap-2">
              <div className="text-xs text-muted-foreground">تكلفة الوحدة</div>
              <Input
                inputMode="decimal"
                value={moveUnitCost}
                onChange={(e) => setMoveUnitCost(e.target.value)}
                placeholder="مثال: 200"
              />
            </div>

            <div className="grid gap-2">
              <div className="text-xs text-muted-foreground">ملاحظة</div>
              <Input
                value={moveNote}
                onChange={(e) => setMoveNote(e.target.value)}
                placeholder="اختياري"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMoveOpen(false)}
              >
                إلغاء
              </Button>

              <Button
                type="button"
                className="gap-2"
                onClick={submitMove}
                disabled={saving || !moveQty.trim()}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                تنفيذ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
