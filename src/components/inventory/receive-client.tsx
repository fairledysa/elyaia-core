//src/components/inventory/receive-client.tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Fabric = {
  id: string;
  name: string;
  unit: string;
};

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const txt = await res.text();
  if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
  return JSON.parse(txt) as T;
}

export default function ReceiveFabricClient() {
  const [loading, setLoading] = useState(true);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [fabricId, setFabricId] = useState("");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await j<{ ok: boolean; items: Fabric[] }>("/api/materials");
      setFabrics(res.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit() {
    if (!fabricId) return;
    if (!qty) return;

    setSaving(true);

    try {
      await j("/api/materials/move", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          material_id: fabricId,
          delta: Number(qty),
          move_type: "purchase_in",
          unit_cost: Number(cost || 0),
          note: note || null,
        }),
      });

      setQty("");
      setCost("");
      setNote("");
      alert("تم إدخال القماش للمخزون");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-semibold">إدخال قماش</h1>
        <p className="text-sm text-muted-foreground">
          إضافة كمية جديدة للمخزون
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري التحميل...
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="text-sm">القماش</div>
                <select
                  className="h-10 w-full rounded-md border px-3"
                  value={fabricId}
                  onChange={(e) => setFabricId(e.target.value)}
                >
                  <option value="">اختر القماش</option>

                  {fabrics.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="text-sm">الكمية</div>
                <Input
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder="مثال: 100"
                  inputMode="decimal"
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm">تكلفة الوحدة</div>
                <Input
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="مثال: 20"
                  inputMode="decimal"
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm">ملاحظة</div>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="اختياري"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={submit} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  ) : null}
                  إدخال للمخزون
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
