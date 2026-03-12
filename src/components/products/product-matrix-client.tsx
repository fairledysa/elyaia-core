// FILE: src/components/products/product-matrix-client.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Upload, Download } from "lucide-react";

type Product = {
  salla_product_id: string;
  name: string | null;
  sku: string | null;
  image_url: string | null;
};

type Stage = {
  id: string;
  name: string;
  sort_order: number;
};

type Material = {
  id: string;
  name: string;
};

type Setting = {
  id: string;
  salla_product_id: string;
  stage_id: string;
  enabled: boolean;
  payout_amount: number | null;
};

type ProductMaterialApiRow = {
  id: string;
  salla_product_id: string;
  material_id: string;
  qty_per_piece: number;
};

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const txt = await res.text();
  if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
  return JSON.parse(txt) as T;
}

function keyPS(productId: string, stageId: string) {
  return `${productId}__${stageId}`;
}

export default function ProductMatrixClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [stageSettings, setStageSettings] = useState<Setting[]>([]);
  const [productMaterialsRows, setProductMaterialsRows] = useState<
    ProductMaterialApiRow[]
  >([]);

  const [q, setQ] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [enabledEdits, setEnabledEdits] = useState<Record<string, boolean>>({});
  const [payoutEdits, setPayoutEdits] = useState<Record<string, string>>({});
  const [materialEdits, setMaterialEdits] = useState<
    Record<string, { material_id: string; qty: string }>
  >({});

  const dirtyCount = useMemo(() => {
    return (
      Object.keys(enabledEdits).length +
      Object.keys(payoutEdits).length +
      Object.keys(materialEdits).length
    );
  }, [enabledEdits, payoutEdits, materialEdits]);

  const settingsIndex = useMemo(() => {
    const m = new Map<string, Setting>();
    stageSettings.forEach((s) =>
      m.set(keyPS(s.salla_product_id, s.stage_id), s),
    );
    return m;
  }, [stageSettings]);

  const productMaterialIndex = useMemo(() => {
    const m = new Map<string, ProductMaterialApiRow>();
    for (const row of productMaterialsRows) {
      if (!m.has(row.salla_product_id)) {
        m.set(row.salla_product_id, row);
      }
    }
    return m;
  }, [productMaterialsRows]);

  async function loadAll() {
    setLoading(true);
    try {
      const d = await j<{
        ok: boolean;
        products: Product[];
        stages: Stage[];
        settings: Setting[];
        materials: Material[];
        productMaterials: ProductMaterialApiRow[];
      }>("/api/products/matrix");

      setProducts(d.products || []);
      setStages(d.stages || []);
      setStageSettings(d.settings || []);
      setMaterials(d.materials || []);
      setProductMaterialsRows(d.productMaterials || []);

      const seed: Record<string, { material_id: string; qty: string }> = {};
      for (const row of d.productMaterials || []) {
        if (!seed[row.salla_product_id]) {
          seed[row.salla_product_id] = {
            material_id: row.material_id || "",
            qty: String(row.qty_per_piece ?? 0),
          };
        }
      }
      setMaterialEdits(seed);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.toLowerCase().trim();
    if (!needle) return products;
    return products.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(needle) ||
        (p.sku || "").toLowerCase().includes(needle),
    );
  }, [products, q]);

  function getEnabledValue(productId: string, stageId: string) {
    const k = keyPS(productId, stageId);
    if (k in enabledEdits) return enabledEdits[k];
    const s = settingsIndex.get(k);
    return !!s?.enabled;
  }

  function getPayoutValue(productId: string, stageId: string) {
    const k = keyPS(productId, stageId);
    if (k in payoutEdits) return payoutEdits[k];
    const s = settingsIndex.get(k);
    return s?.payout_amount == null ? "" : String(s.payout_amount);
  }

  function getMaterialValue(productId: string) {
    if (productId in materialEdits) return materialEdits[productId];
    const row = productMaterialIndex.get(productId);
    return {
      material_id: row?.material_id || "",
      qty: row?.qty_per_piece == null ? "" : String(row.qty_per_piece),
    };
  }

  function setEnabled(productId: string, stageId: string, value: boolean) {
    const k = keyPS(productId, stageId);
    setEnabledEdits((prev) => ({ ...prev, [k]: value }));
  }

  function setPayout(productId: string, stageId: string, value: string) {
    const k = keyPS(productId, stageId);
    setPayoutEdits((prev) => ({ ...prev, [k]: value }));
  }

  function setProductMaterial(
    productId: string,
    material_id: string,
    qty: string,
  ) {
    setMaterialEdits((prev) => ({
      ...prev,
      [productId]: { material_id, qty },
    }));
  }

  async function saveAll() {
    if (saving) return;
    setSaving(true);

    try {
      for (const product of filtered) {
        const productId = product.salla_product_id;

        for (const st of stages) {
          const k = keyPS(productId, st.id);
          const touchedEnabled = k in enabledEdits;
          const touchedPayout = k in payoutEdits;

          if (!touchedEnabled && !touchedPayout) continue;

          const enabled = getEnabledValue(productId, st.id);
          const payoutRaw = getPayoutValue(productId, st.id);

          await j(`/api/products/${encodeURIComponent(productId)}/stages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              stage_id: st.id,
              enabled,
              payout_amount: payoutRaw === "" ? null : Number(payoutRaw),
              sort_order: st.sort_order ?? 0,
            }),
          });
        }

        if (productId in materialEdits) {
          const existing = productMaterialIndex.get(productId);
          const edit = materialEdits[productId];
          const nextMaterialId = edit.material_id || "";
          const nextQty = edit.qty === "" ? 0 : Number(edit.qty);

          if (!nextMaterialId) {
            if (existing) {
              await j(
                `/api/products/${encodeURIComponent(productId)}/materials`,
                {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: existing.id }),
                },
              );
            }
          } else if (!existing) {
            await j(
              `/api/products/${encodeURIComponent(productId)}/materials`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  material_id: nextMaterialId,
                  qty_per_piece: nextQty,
                }),
              },
            );
          } else if (existing.material_id === nextMaterialId) {
            await j(
              `/api/products/${encodeURIComponent(productId)}/materials`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  id: existing.id,
                  qty_per_piece: nextQty,
                }),
              },
            );
          } else {
            await j(
              `/api/products/${encodeURIComponent(productId)}/materials`,
              {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: existing.id }),
              },
            );

            await j(
              `/api/products/${encodeURIComponent(productId)}/materials`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  material_id: nextMaterialId,
                  qty_per_piece: nextQty,
                }),
              },
            );
          }
        }
      }

      setEnabledEdits({});
      setPayoutEdits({});
      setMaterialEdits({});

      await loadAll();
      alert("تم الحفظ");
    } catch (err: any) {
      alert(err?.message || "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  }

  async function handleImport(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/products/matrix/import", {
        method: "POST",
        body: fd,
      });

      const txt = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(txt);
      } catch {
        data = null;
      }

      if (!res.ok) {
        throw new Error(data?.error || txt || "فشل رفع الملف");
      }

      await loadAll();
      alert("تم رفع ملف الإكسل وتحديث البيانات");
    } catch (err: any) {
      alert(err?.message || "فشل رفع ملف الإكسل");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold"> اعدادات المنتجات</h1>
          <p className="text-sm text-muted-foreground">
            تعديل جماعي سريع لإعدادات التشغيل لكل منتج.
          </p>

          <div className="mt-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
            ✔️ علامة الصح تعني أن المنتج يمر على هذه المرحلة أثناء الإنتاج. 💰
            الرقم تحتها هو أجر أو تكلفة تنفيذ هذه المرحلة لكل قطعة.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-[260px]">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => {
              window.open("/api/products/matrix/export", "_blank");
            }}
          >
            <Download className="h-4 w-4" />
            تصدير Excel
          </Button>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              await handleImport(file);
            }}
          />

          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            رفع Excel
          </Button>

          <Button
            type="button"
            className="gap-2"
            onClick={saveAll}
            disabled={saving || dirtyCount === 0}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            حفظ
          </Button>
        </div>
      </div>

      <div className="overflow-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="p-3 text-right">المنتج</th>
              <th className="p-3 text-center">القماش</th>
              <th className="p-3 text-center">كم/قطعة</th>

              {stages.map((s) => (
                <th key={s.id} className="p-3 text-center">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filtered.map((p) => {
              const mat = getMaterialValue(p.salla_product_id);

              return (
                <tr key={p.salla_product_id} className="border-b">
                  <td className="p-3">
                    <div className="font-medium">{p.name || "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.sku || ""}
                    </div>
                  </td>

                  <td className="p-3">
                    <select
                      className="h-9 w-48 rounded-md border bg-background px-2 text-sm"
                      value={mat.material_id}
                      onChange={(e) =>
                        setProductMaterial(
                          p.salla_product_id,
                          e.target.value,
                          mat.qty,
                        )
                      }
                    >
                      <option value="">—</option>
                      {materials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="p-3">
                    <Input
                      className="w-24 text-center"
                      inputMode="decimal"
                      value={mat.qty}
                      onChange={(e) =>
                        setProductMaterial(
                          p.salla_product_id,
                          mat.material_id,
                          e.target.value,
                        )
                      }
                    />
                  </td>

                  {stages.map((s) => {
                    const enabled = getEnabledValue(p.salla_product_id, s.id);
                    const payout = getPayoutValue(p.salla_product_id, s.id);

                    return (
                      <td key={s.id} className="p-3 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Checkbox
                            checked={enabled}
                            onCheckedChange={(v) =>
                              setEnabled(p.salla_product_id, s.id, !!v)
                            }
                          />

                          <Input
                            className="w-20 text-center"
                            inputMode="decimal"
                            value={payout}
                            onChange={(e) =>
                              setPayout(
                                p.salla_product_id,
                                s.id,
                                e.target.value,
                              )
                            }
                            placeholder="سعر"
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {!filtered.length ? (
              <tr>
                <td
                  colSpan={3 + stages.length}
                  className="p-6 text-center text-sm text-muted-foreground"
                >
                  لا يوجد منتجات
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
