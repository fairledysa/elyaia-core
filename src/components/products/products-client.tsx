// FILE: src/components/products/products-client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Settings2, Plus, Trash2 } from "lucide-react";

type SallaProductRow = {
  salla_product_id: string;
  name: string | null;
  sku: string | null;
  price: number | null;
  currency: string | null;
  status: string | null;
  image_url: string | null;
  updated_at: string | null;
};

type StageRow = {
  id: string;
  name: string;
  sort_order: number;
  require_previous_complete: boolean;
  inventory_deduct_enabled: boolean;
  archived: boolean;
};

type ProductStageRow = {
  id: string;
  stage_id: string;
  enabled: boolean;
  payout_amount: number | null;
  sort_order: number;
  stages?: { name: string } | null;
};

type MaterialRow = {
  id: string;
  name: string;
  on_hand: number;
  reorder_level: number;
  allow_negative: boolean;
};

type ProductMaterialRow = {
  id: string;
  material_id: string;
  qty_per_piece: number;
  materials?: { name: string } | null;
};

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const txt = await res.text();
  if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
  return JSON.parse(txt) as T;
}

export default function ProductsClient() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<SallaProductRow[]>([]);
  const [q, setQ] = useState("");

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<SallaProductRow | null>(null);

  const [stages, setStages] = useState<StageRow[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);

  const [psLoading, setPsLoading] = useState(false);
  const [pmLoading, setPmLoading] = useState(false);
  const [productStages, setProductStages] = useState<ProductStageRow[]>([]);
  const [productMaterials, setProductMaterials] = useState<
    ProductMaterialRow[]
  >([]);

  // create form
  const [addStageId, setAddStageId] = useState("");
  const [addStagePayout, setAddStagePayout] = useState<string>("");
  const [addMaterialId, setAddMaterialId] = useState("");
  const [addMaterialQty, setAddMaterialQty] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const p = await j<{ ok: boolean; items: SallaProductRow[] }>(
          "/api/products",
        );
        setProducts(p.items || []);

        // stages list (موجود عندك APIs للمراحل)
        const s = await j<{ ok: boolean; items: StageRow[] }>("/api/stages");
        setStages(
          (s.items || [])
            .filter((x) => !x.archived)
            .sort((a, b) => a.sort_order - b.sort_order),
        );

        const m = await j<{ ok: boolean; items: MaterialRow[] }>(
          "/api/materials",
        );
        setMaterials(m.items || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return products;
    return products.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(needle) ||
        (p.sku || "").toLowerCase().includes(needle),
    );
  }, [products, q]);

  async function openSettings(p: SallaProductRow) {
    setActive(p);
    setOpen(true);

    // reset form
    setAddStageId("");
    setAddStagePayout("");
    setAddMaterialId("");
    setAddMaterialQty("");

    // load settings
    setPsLoading(true);
    setPmLoading(true);
    try {
      const ps = await j<{ ok: boolean; items: ProductStageRow[] }>(
        `/api/products/${encodeURIComponent(p.salla_product_id)}/stages`,
      );
      setProductStages(
        (ps.items || []).sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
        ),
      );

      const pm = await j<{ ok: boolean; items: ProductMaterialRow[] }>(
        `/api/products/${encodeURIComponent(p.salla_product_id)}/materials`,
      );
      setProductMaterials(pm.items || []);
    } finally {
      setPsLoading(false);
      setPmLoading(false);
    }
  }

  async function addStage() {
    if (!active || !addStageId) return;
    setPsLoading(true);
    try {
      await j(
        `/api/products/${encodeURIComponent(active.salla_product_id)}/stages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stage_id: addStageId,
            payout_amount:
              addStagePayout === "" ? null : Number(addStagePayout),
            enabled: true,
            sort_order: productStages.length
              ? Math.max(...productStages.map((x) => x.sort_order || 0)) + 1
              : 0,
          }),
        },
      );
      const ps = await j<{ ok: boolean; items: ProductStageRow[] }>(
        `/api/products/${encodeURIComponent(active.salla_product_id)}/stages`,
      );
      setProductStages(
        (ps.items || []).sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
        ),
      );
      setAddStageId("");
      setAddStagePayout("");
    } finally {
      setPsLoading(false);
    }
  }

  async function patchStage(id: string, patch: Partial<ProductStageRow>) {
    if (!active) return;
    setPsLoading(true);
    try {
      await j(
        `/api/products/${encodeURIComponent(active.salla_product_id)}/stages`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...patch }),
        },
      );
      const ps = await j<{ ok: boolean; items: ProductStageRow[] }>(
        `/api/products/${encodeURIComponent(active.salla_product_id)}/stages`,
      );
      setProductStages(
        (ps.items || []).sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
        ),
      );
    } finally {
      setPsLoading(false);
    }
  }

  async function deleteStage(id: string) {
    if (!active) return;
    setPsLoading(true);
    try {
      await j(
        `/api/products/${encodeURIComponent(active.salla_product_id)}/stages`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        },
      );
      const ps = await j<{ ok: boolean; items: ProductStageRow[] }>(
        `/api/products/${encodeURIComponent(active.salla_product_id)}/stages`,
      );
      setProductStages(
        (ps.items || []).sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
        ),
      );
    } finally {
      setPsLoading(false);
    }
  }

  async function addMaterial() {
    if (!active || !addMaterialId) return;
    setPmLoading(true);
    try {
      await j(
        `/api/products/${encodeURIComponent(active.salla_product_id)}/materials`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            material_id: addMaterialId,
            qty_per_piece: addMaterialQty === "" ? 0 : Number(addMaterialQty),
          }),
        },
      );
      const pm = await j<{ ok: boolean; items: ProductMaterialRow[] }>(
        `/api/products/${encodeURIComponent(active.salla_product_id)}/materials`,
      );
      setProductMaterials(pm.items || []);
      setAddMaterialId("");
      setAddMaterialQty("");
    } finally {
      setPmLoading(false);
    }
  }

  async function patchMaterial(id: string, qty_per_piece: number) {
    if (!active) return;
    setPmLoading(true);
    try {
      await j(
        `/api/products/${encodeURIComponent(active.salla_product_id)}/materials`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, qty_per_piece }),
        },
      );
      const pm = await j<{ ok: boolean; items: ProductMaterialRow[] }>(
        `/api/products/${encodeURIComponent(active.salla_product_id)}/materials`,
      );
      setProductMaterials(pm.items || []);
    } finally {
      setPmLoading(false);
    }
  }

  async function deleteMaterial(id: string) {
    if (!active) return;
    setPmLoading(true);
    try {
      await j(
        `/api/products/${encodeURIComponent(active.salla_product_id)}/materials`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        },
      );
      const pm = await j<{ ok: boolean; items: ProductMaterialRow[] }>(
        `/api/products/${encodeURIComponent(active.salla_product_id)}/materials`,
      );
      setProductMaterials(pm.items || []);
    } finally {
      setPmLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">المنتجات</h1>
          <p className="text-sm text-muted-foreground">
            منتجات سلة + إعدادات التشغيل (المراحل/المخزون)
          </p>
        </div>
        <div className="w-[260px]">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث بالاسم أو SKU"
          />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">قائمة المنتجات</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري التحميل...
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((p) => (
                <div
                  key={p.salla_product_id}
                  className="flex items-center gap-3 rounded-xl border p-3"
                >
                  <div className="h-12 w-12 overflow-hidden rounded-lg bg-muted">
                    {p.image_url ? (
                      <Image
                        src={p.image_url}
                        alt={p.name || ""}
                        width={48}
                        height={48}
                        className="h-12 w-12 object-cover"
                      />
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate font-medium">
                        {p.name || "—"}
                      </div>
                      {p.status ? (
                        <Badge variant="secondary">{p.status}</Badge>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      SKU: {p.sku || "—"} • ID: {p.salla_product_id}
                    </div>
                  </div>

                  <div className="text-sm font-medium">
                    {p.price != null ? p.price : "—"} {p.currency || ""}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => openSettings(p)}
                  >
                    <Settings2 className="h-4 w-4" />
                    إعدادات المنتج
                  </Button>
                </div>
              ))}

              {!filtered.length ? (
                <div className="text-sm text-muted-foreground">
                  لا يوجد منتجات.
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => setOpen(v)}>
        <DialogContent dir="rtl" className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>إعدادات المنتج</DialogTitle>
          </DialogHeader>

          {active ? (
            <div className="space-y-4">
              <div className="rounded-xl border p-3">
                <div className="font-medium">{active.name || "—"}</div>
                <div className="text-xs text-muted-foreground">
                  SKU: {active.sku || "—"} • {active.salla_product_id}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* مراحل المنتج */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">المراحل</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-7">
                        <select
                          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                          value={addStageId}
                          onChange={(e) => setAddStageId(e.target.value)}
                        >
                          <option value="">اختر مرحلة</option>
                          {stages.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <Input
                          value={addStagePayout}
                          onChange={(e) => setAddStagePayout(e.target.value)}
                          placeholder="السعر"
                          inputMode="decimal"
                        />
                      </div>
                      <div className="col-span-2">
                        <Button
                          type="button"
                          className="w-full gap-2"
                          onClick={addStage}
                          disabled={!addStageId || psLoading}
                        >
                          {psLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    {psLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        جاري التحميل...
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {productStages.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center gap-2 rounded-lg border p-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">
                                {r.stages?.name || r.stage_id}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ترتيب: {r.sort_order}
                              </div>
                            </div>

                            <Input
                              className="w-28"
                              inputMode="decimal"
                              value={
                                r.payout_amount == null
                                  ? ""
                                  : String(r.payout_amount)
                              }
                              onChange={(e) =>
                                patchStage(r.id, {
                                  payout_amount:
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value),
                                })
                              }
                              placeholder="السعر"
                            />

                            <div className="flex items-center gap-2">
                              <Switch
                                checked={!!r.enabled}
                                onCheckedChange={(v) =>
                                  patchStage(r.id, { enabled: v })
                                }
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => deleteStage(r.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}

                        {!productStages.length ? (
                          <div className="text-sm text-muted-foreground">
                            لا يوجد مراحل مربوطة.
                          </div>
                        ) : null}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* مواد المنتج */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      المخزون (المواد)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-7">
                        <select
                          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                          value={addMaterialId}
                          onChange={(e) => setAddMaterialId(e.target.value)}
                        >
                          <option value="">اختر مادة</option>
                          {materials.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <Input
                          value={addMaterialQty}
                          onChange={(e) => setAddMaterialQty(e.target.value)}
                          placeholder="كم/قطعة"
                          inputMode="decimal"
                        />
                      </div>
                      <div className="col-span-2">
                        <Button
                          type="button"
                          className="w-full gap-2"
                          onClick={addMaterial}
                          disabled={!addMaterialId || pmLoading}
                        >
                          {pmLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    {pmLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        جاري التحميل...
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {productMaterials.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center gap-2 rounded-lg border p-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">
                                {r.materials?.name || r.material_id}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                استهلاك لكل قطعة
                              </div>
                            </div>

                            <Input
                              className="w-28"
                              inputMode="decimal"
                              value={String(r.qty_per_piece ?? 0)}
                              onChange={(e) =>
                                patchMaterial(
                                  r.id,
                                  e.target.value === ""
                                    ? 0
                                    : Number(e.target.value),
                                )
                              }
                            />

                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => deleteMaterial(r.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}

                        {!productMaterials.length ? (
                          <div className="text-sm text-muted-foreground">
                            لا يوجد مواد مربوطة.
                          </div>
                        ) : null}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
