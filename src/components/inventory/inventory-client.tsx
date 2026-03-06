// FILE: src/components/inventory/inventory-client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Loader2, Plus, Save, Trash2 } from "lucide-react";

type MaterialRow = {
  id: string;
  name: string;
  unit: string;
  on_hand: number;
  unit_cost: number;
  reorder_level: number;
  allow_negative: boolean;
};

type MoveRow = {
  id: string;
  material_id: string;
  quantity: number;
  move_type: string;
  unit_cost: number;
  total_cost: number;
  note: string | null;
  created_at: string;
  materials?: { name: string; unit: string } | null;
};

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const txt = await res.text();
  if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
  return JSON.parse(txt) as T;
}

export default function InventoryClient() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MaterialRow[]>([]);
  const [moves, setMoves] = useState<MoveRow[]>([]);
  const [q, setQ] = useState("");

  const [savingId, setSavingId] = useState<string | null>(null);

  // create
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("m");
  const [newUnitCost, setNewUnitCost] = useState<string>("0");

  // move dialog
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveItem, setMoveItem] = useState<MaterialRow | null>(null);
  const [moveType, setMoveType] = useState<"purchase" | "consume" | "adjust">(
    "purchase",
  );
  const [moveQty, setMoveQty] = useState<string>("");
  const [moveUnitCost, setMoveUnitCost] = useState<string>("");
  const [moveNote, setMoveNote] = useState<string>("");

  async function load() {
    setLoading(true);
    try {
      const d = await j<{ ok: boolean; items: MaterialRow[] }>(
        "/api/materials",
      );
      setItems(d.items || []);

      const mv = await j<{ ok: boolean; items: MoveRow[] }>(
        "/api/inventory/moves?limit=50",
      );
      setMoves(mv.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((m) => (m.name || "").toLowerCase().includes(needle));
  }, [items, q]);

  async function createMaterial() {
    const name = newName.trim();
    if (!name) return;

    setSavingId("new");
    try {
      await j("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          unit: newUnit,
          unit_cost: newUnitCost === "" ? 0 : Number(newUnitCost),
        }),
      });
      setNewName("");
      setNewUnit("m");
      setNewUnitCost("0");
      await load();
    } finally {
      setSavingId(null);
    }
  }

  async function patch(id: string, patch: Partial<MaterialRow>) {
    setSavingId(id);
    try {
      await j(`/api/materials/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      await load();
    } finally {
      setSavingId(null);
    }
  }

  async function del(id: string) {
    setSavingId(id);
    try {
      await j(`/api/materials/${encodeURIComponent(id)}`, { method: "DELETE" });
      await load();
    } finally {
      setSavingId(null);
    }
  }

  function openMove(m: MaterialRow) {
    setMoveItem(m);
    setMoveOpen(true);
    setMoveType("purchase");
    setMoveQty("");
    setMoveUnitCost(String(m.unit_cost ?? 0));
    setMoveNote("");
  }

  async function submitMove() {
    if (!moveItem) return;

    const qtyRaw = Number(moveQty);
    if (!Number.isFinite(qtyRaw) || qtyRaw <= 0) return;

    const signedDelta =
      moveType === "consume" ? -Math.abs(qtyRaw) : Math.abs(qtyRaw);

    setSavingId(`move:${moveItem.id}`);
    try {
      await j("/api/materials/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          material_id: moveItem.id,
          delta: signedDelta,
          move_type: moveType,
          unit_cost: moveUnitCost === "" ? 0 : Number(moveUnitCost),
          note: moveNote.trim() || null,
        }),
      });

      setMoveOpen(false);
      setMoveItem(null);
      setMoveQty("");
      setMoveUnitCost("");
      setMoveNote("");
      await load();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">المخزون</h1>
          <p className="text-sm text-muted-foreground">
            مواد خام + تكلفة + حركات (Ledger)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-[260px]">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث بالمادة"
            />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">إضافة مادة</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-12 md:items-end">
          <div className="md:col-span-6">
            <div className="text-xs text-muted-foreground">الاسم</div>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="مثال: قماش نواعم"
            />
          </div>

          <div className="md:col-span-2">
            <div className="text-xs text-muted-foreground">الوحدة</div>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
            >
              <option value="m">متر</option>
              <option value="pcs">قطعة</option>
              <option value="roll">لفة</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <div className="text-xs text-muted-foreground">تكلفة الوحدة</div>
            <Input
              inputMode="decimal"
              value={newUnitCost}
              onChange={(e) => setNewUnitCost(e.target.value)}
              placeholder="مثال: 200"
            />
          </div>

          <div className="md:col-span-2">
            <Button
              type="button"
              className="w-full gap-2"
              onClick={createMaterial}
              disabled={!newName.trim() || savingId === "new"}
            >
              {savingId === "new" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              إضافة
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">المواد</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري التحميل...
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((m) => {
                const value = Number(m.on_hand ?? 0) * Number(m.unit_cost ?? 0);

                return (
                  <div
                    key={m.id}
                    className="grid items-center gap-2 rounded-xl border p-3 md:grid-cols-12"
                  >
                    <div className="md:col-span-4">
                      <div className="text-xs text-muted-foreground">الاسم</div>
                      <Input
                        value={m.name}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((x) =>
                              x.id === m.id
                                ? { ...x, name: e.target.value }
                                : x,
                            ),
                          )
                        }
                      />
                    </div>

                    <div className="md:col-span-1">
                      <div className="text-xs text-muted-foreground">
                        الوحدة
                      </div>
                      <select
                        className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                        value={m.unit || "m"}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((x) =>
                              x.id === m.id
                                ? { ...x, unit: e.target.value }
                                : x,
                            ),
                          )
                        }
                      >
                        <option value="m">متر</option>
                        <option value="pcs">قطعة</option>
                        <option value="roll">لفة</option>
                      </select>
                    </div>

                    <div className="md:col-span-1">
                      <div className="text-xs text-muted-foreground">
                        الرصيد
                      </div>
                      <Input value={String(m.on_hand ?? 0)} readOnly />
                    </div>

                    <div className="md:col-span-2">
                      <div className="text-xs text-muted-foreground">
                        تكلفة الوحدة
                      </div>
                      <Input
                        inputMode="decimal"
                        value={String(m.unit_cost ?? 0)}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((x) =>
                              x.id === m.id
                                ? {
                                    ...x,
                                    unit_cost: Number(e.target.value || 0),
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                    </div>

                    <div className="md:col-span-2">
                      <div className="text-xs text-muted-foreground">
                        قيمة المخزون
                      </div>
                      <Input value={String(value || 0)} readOnly />
                    </div>

                    <div className="md:col-span-1">
                      <div className="text-xs text-muted-foreground">
                        حد التنبيه
                      </div>
                      <Input
                        inputMode="decimal"
                        value={String(m.reorder_level ?? 0)}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((x) =>
                              x.id === m.id
                                ? {
                                    ...x,
                                    reorder_level: Number(e.target.value || 0),
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                    </div>

                    <div className="md:col-span-1">
                      <div className="text-xs text-muted-foreground">
                        السالب
                      </div>
                      <div className="flex h-10 items-center">
                        <Switch
                          checked={!!m.allow_negative}
                          onCheckedChange={(v) =>
                            setItems((prev) =>
                              prev.map((x) =>
                                x.id === m.id ? { ...x, allow_negative: v } : x,
                              ),
                            )
                          }
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 md:col-span-12 md:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => openMove(m)}
                        disabled={savingId === m.id}
                      >
                        حركة
                      </Button>

                      <Button
                        type="button"
                        className="gap-2"
                        onClick={() =>
                          patch(m.id, {
                            name: m.name,
                            unit: m.unit,
                            unit_cost: m.unit_cost,
                            reorder_level: m.reorder_level,
                            allow_negative: m.allow_negative,
                          })
                        }
                        disabled={savingId === m.id}
                      >
                        {savingId === m.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        حفظ
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => del(m.id)}
                        disabled={savingId === m.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {!filtered.length ? (
                <div className="text-sm text-muted-foreground">
                  لا يوجد مواد.
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">آخر حركات</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? null : (
            <div className="overflow-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="p-3 text-right">المادة</th>
                    <th className="p-3 text-center">النوع</th>
                    <th className="p-3 text-center">الكمية</th>
                    <th className="p-3 text-center">تكلفة</th>
                    <th className="p-3 text-center">القيمة</th>
                    <th className="p-3 text-right">ملاحظة</th>
                    <th className="p-3 text-center">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {moves.map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="p-3">
                        {r.materials?.name || r.material_id}
                      </td>
                      <td className="p-3 text-center">{r.move_type}</td>
                      <td className="p-3 text-center">{r.quantity}</td>
                      <td className="p-3 text-center">{r.unit_cost}</td>
                      <td className="p-3 text-center">{r.total_cost}</td>
                      <td className="p-3">{r.note || ""}</td>
                      <td className="p-3 text-center">
                        {new Date(r.created_at).toLocaleString("ar-SA")}
                      </td>
                    </tr>
                  ))}
                  {!moves.length ? (
                    <tr>
                      <td
                        className="p-6 text-center text-sm text-muted-foreground"
                        colSpan={7}
                      >
                        لا توجد حركات بعد.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>حركة مخزون</DialogTitle>
          </DialogHeader>

          {moveItem ? (
            <div className="space-y-3">
              <div className="rounded-xl border p-3">
                <div className="font-medium">{moveItem.name}</div>
                <div className="text-xs text-muted-foreground">
                  الرصيد الحالي: {moveItem.on_hand ?? 0} {moveItem.unit || ""}
                </div>
              </div>

              <div className="grid gap-2">
                <div className="text-xs text-muted-foreground">نوع الحركة</div>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={moveType}
                  onChange={(e) => setMoveType(e.target.value as any)}
                >
                  <option value="purchase">شراء/إضافة</option>
                  <option value="consume">استهلاك/سحب</option>
                  <option value="adjust">تسوية</option>
                </select>
              </div>

              <div className="grid gap-2">
                <div className="text-xs text-muted-foreground">
                  الكمية (رقم موجب)
                </div>
                <Input
                  inputMode="decimal"
                  placeholder="مثال: 10"
                  value={moveQty}
                  onChange={(e) => setMoveQty(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <div className="text-xs text-muted-foreground">
                  تكلفة الوحدة
                </div>
                <Input
                  inputMode="decimal"
                  placeholder="مثال: 200"
                  value={moveUnitCost}
                  onChange={(e) => setMoveUnitCost(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <div className="text-xs text-muted-foreground">ملاحظة</div>
                <Input
                  placeholder="اختياري"
                  value={moveNote}
                  onChange={(e) => setMoveNote(e.target.value)}
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
                  disabled={
                    !moveQty.trim() || savingId === `move:${moveItem.id}`
                  }
                >
                  {savingId === `move:${moveItem.id}` ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  تنفيذ
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
