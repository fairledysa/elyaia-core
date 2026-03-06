// FILE: src/components/products/product-settings-dialog.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

type Stage = {
  id: string;
  name: string;
  sort_order: number;
  require_previous_complete: boolean;
  inventory_deduct_enabled: boolean;
  archived: boolean;
};

type Material = {
  id: string;
  name: string;
  on_hand: number;
  reorder_level: number | null;
  allow_negative: boolean;
};

type StageSetting = {
  stage_id: string;
  enabled: boolean;
  payout_amount: number | null;
};
type ProductMaterial = { material_id: string; qty_per_piece: number };

export function ProductSettingsDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: {
    salla_product_id: string;
    name?: string | null;
    sku?: string | null;
  };
}) {
  const { open, onOpenChange, product } = props;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [stages, setStages] = useState<Stage[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [stageSettings, setStageSettings] = useState<
    Record<string, StageSetting>
  >({});
  const [productMaterials, setProductMaterials] = useState<
    Record<string, ProductMaterial>
  >({});

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/products/${encodeURIComponent(product.salla_product_id)}/settings`,
        {
          cache: "no-store",
        },
      );
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "load_failed");

      setStages(j.stages || []);
      setMaterials(j.materials || []);

      const ss: Record<string, StageSetting> = {};
      for (const x of j.stageSettings || []) ss[String(x.stage_id)] = x;
      setStageSettings(ss);

      const pm: Record<string, ProductMaterial> = {};
      for (const x of j.productMaterials || []) pm[String(x.material_id)] = x;
      setProductMaterials(pm);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product.salla_product_id]);

  const stagesWithDefaults = useMemo(() => {
    return stages.map((s) => {
      const current = stageSettings[s.id];
      return {
        stage: s,
        enabled: current ? current.enabled !== false : true,
        payout_amount: current?.payout_amount ?? null,
      };
    });
  }, [stages, stageSettings]);

  const materialsWithDefaults = useMemo(() => {
    return materials.map((m) => {
      const current = productMaterials[m.id];
      return {
        material: m,
        qty_per_piece: current?.qty_per_piece ?? 0,
        enabled: !!current,
      };
    });
  }, [materials, productMaterials]);

  function setStageEnabled(stageId: string, enabled: boolean) {
    setStageSettings((prev) => ({
      ...prev,
      [stageId]: {
        stage_id: stageId,
        enabled,
        payout_amount: prev[stageId]?.payout_amount ?? null,
      },
    }));
  }

  function setStagePayout(stageId: string, v: string) {
    const num = v === "" ? null : Number(v);
    setStageSettings((prev) => ({
      ...prev,
      [stageId]: {
        stage_id: stageId,
        enabled: prev[stageId]?.enabled !== false,
        payout_amount: Number.isFinite(num as any) ? (num as any) : null,
      },
    }));
  }

  function toggleMaterial(materialId: string, enabled: boolean) {
    setProductMaterials((prev) => {
      const next = { ...prev };
      if (!enabled) {
        delete next[materialId];
        return next;
      }
      next[materialId] = {
        material_id: materialId,
        qty_per_piece: next[materialId]?.qty_per_piece ?? 0,
      };
      return next;
    });
  }

  function setMaterialQty(materialId: string, v: string) {
    const num = v === "" ? 0 : Number(v);
    setProductMaterials((prev) => ({
      ...prev,
      [materialId]: {
        material_id: materialId,
        qty_per_piece: Number.isFinite(num) ? num : 0,
      },
    }));
  }

  async function save() {
    setSaving(true);
    try {
      const stageRows = stages.map((s) => {
        const current = stageSettings[s.id];
        return {
          stage_id: s.id,
          enabled: current ? current.enabled !== false : true,
          payout_amount: current?.payout_amount ?? null,
        };
      });

      const materialRows = Object.values(productMaterials);

      const r = await fetch(
        `/api/products/${encodeURIComponent(product.salla_product_id)}/settings`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stageSettings: stageRows,
            productMaterials: materialRows,
          }),
        },
      );

      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "save_failed");

      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <div className="border-b px-6 py-4">
          <div className="text-lg font-semibold">إعدادات المنتج</div>
          <div className="text-sm text-muted-foreground">
            {product.name || "—"} {product.sku ? `• ${product.sku}` : ""}
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري التحميل...
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">المراحل</div>
                  <Badge variant="secondary" className="cursor-default">
                    {stagesWithDefaults.length}
                  </Badge>
                </div>

                <div className="space-y-2">
                  {stagesWithDefaults.map((x) => (
                    <div key={x.stage.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium">{x.stage.name}</div>
                          <div className="text-xs text-muted-foreground">
                            ترتيب: {x.stage.sort_order}
                            {x.stage.inventory_deduct_enabled
                              ? " • خصم مخزون"
                              : ""}
                            {x.stage.require_previous_complete
                              ? " • منع القفز"
                              : ""}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-40">
                            <Input
                              inputMode="decimal"
                              placeholder="سعر المرحلة"
                              value={x.payout_amount ?? ""}
                              onChange={(e) =>
                                setStagePayout(x.stage.id, e.target.value)
                              }
                              className="text-right"
                            />
                          </div>

                          <Switch
                            dir="ltr"
                            checked={x.enabled}
                            onCheckedChange={(v) =>
                              setStageEnabled(x.stage.id, !!v)
                            }
                            className="cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">الخامات (القماش)</div>
                  <Badge variant="secondary" className="cursor-default">
                    {materialsWithDefaults.length}
                  </Badge>
                </div>

                <div className="space-y-2">
                  {materialsWithDefaults.map((x) => {
                    const low =
                      x.material.reorder_level != null &&
                      Number(x.material.on_hand) <=
                        Number(x.material.reorder_level);
                    const enabled = !!productMaterials[x.material.id];

                    return (
                      <div
                        key={x.material.id}
                        className="rounded-lg border p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="font-medium">
                                {x.material.name}
                              </div>
                              {low ? (
                                <Badge variant="destructive">منخفض</Badge>
                              ) : null}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              المتوفر: {x.material.on_hand} • الحد:{" "}
                              {x.material.reorder_level ?? 0}
                              {x.material.allow_negative
                                ? " • يسمح بالسالب"
                                : ""}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="w-44">
                              <Input
                                inputMode="decimal"
                                placeholder="كمية لكل قطعة (متر)"
                                value={
                                  enabled
                                    ? (productMaterials[x.material.id]
                                        ?.qty_per_piece ?? "")
                                    : ""
                                }
                                onChange={(e) =>
                                  setMaterialQty(x.material.id, e.target.value)
                                }
                                disabled={!enabled}
                                className="text-right"
                              />
                            </div>

                            <Switch
                              dir="ltr"
                              checked={enabled}
                              onCheckedChange={(v) =>
                                toggleMaterial(x.material.id, !!v)
                              }
                              className="cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="border-t px-6 py-4 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="cursor-pointer"
          >
            إلغاء
          </Button>
          <Button
            onClick={save}
            disabled={saving || loading}
            className="cursor-pointer"
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري الحفظ...
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Save className="h-4 w-4" />
                حفظ
              </span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
