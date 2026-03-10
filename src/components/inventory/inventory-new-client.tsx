// FILE: src/components/inventory/inventory-new-client.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const txt = await res.text();
  if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
  return JSON.parse(txt) as T;
}

export default function InventoryNewClient() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [unit, setUnit] = useState("m");
  const [unitCost, setUnitCost] = useState("0");
  const [reorderLevel, setReorderLevel] = useState("0");
  const [allowNegative, setAllowNegative] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const cleanName = name.trim();
    if (!cleanName) {
      setError("اسم المادة مطلوب");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await j("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanName,
          unit,
          unit_cost: Number(unitCost || 0),
        }),
      });

      // تحديث البيانات الإضافية بعد الإنشاء لأن POST الحالي لا يحفظها كلها
      const list = await j<{
        ok: boolean;
        items: Array<{
          id: string;
          name: string;
          unit: string;
          on_hand: number;
          unit_cost: number;
          reorder_level: number;
          allow_negative: boolean;
        }>;
      }>("/api/materials");

      const created = (list.items || []).find((x) => x.name === cleanName);

      if (created) {
        await j(`/api/materials/${encodeURIComponent(created.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reorder_level: Number(reorderLevel || 0),
            allow_negative: !!allowNegative,
            unit,
            unit_cost: Number(unitCost || 0),
          }),
        });
      }

      router.push("/dashboard/inventory");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل حفظ المادة");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">إضافة مادة جديدة</h1>
          <p className="text-sm text-muted-foreground">
            إنشاء مادة خام جديدة للمخزون
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href="/dashboard/inventory" className="gap-2">
            <ArrowRight className="h-4 w-4" />
            الرجوع إلى المخزون
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">بيانات المادة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm">اسم المادة</div>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: قماش نواعم أسود"
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm">الوحدة</div>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
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
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="مثال: 25"
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm">حد التنبيه</div>
              <Input
                inputMode="decimal"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
                placeholder="مثال: 10"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <div className="text-sm font-medium">السماح بالمخزون السالب</div>
              <div className="text-xs text-muted-foreground">
                فعّل هذا فقط إذا كنت تريد السماح بالسحب حتى عند نفاد الرصيد
              </div>
            </div>

            <Switch
              checked={allowNegative}
              onCheckedChange={setAllowNegative}
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              className="gap-2"
              onClick={submit}
              disabled={saving || !name.trim()}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              حفظ المادة
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
