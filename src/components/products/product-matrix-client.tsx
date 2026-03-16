// FILE: src/components/products/product-matrix-client.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Save,
  Upload,
  Download,
  RefreshCw,
} from "lucide-react";

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

type SyncProductsResponse = {
  ok: boolean;
  error?: string;
  trace?: string;
  tenantId?: string;
  installationId?: string;
  productsUpserted?: number;
  jobId?: string;
  total?: number;
  processed?: number;
};

type SyncJob = {
  id: string;
  tenant_id: string;
  installation_id: string;
  job_type: string;
  status: "running" | "success" | "failed" | "pending";
  total: number | null;
  processed: number | null;
  started_at: string | null;
  finished_at: string | null;
  last_error: string | null;
  trace: string | null;
};

type SyncStatusResponse = {
  ok: boolean;
  job: SyncJob | null;
  progress: number;
};

type ImportResponse = {
  ok: boolean;
  error?: string;
  message?: string;
  imported?: number;
  updated?: number;
  total?: number;
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

function statusLabel(job: SyncJob | null) {
  if (!job) return "لا توجد مزامنة حديثة";
  if (job.status === "running") return "جاري مزامنة جميع المنتجات مع سلة";
  if (job.status === "success") return "آخر مزامنة اكتملت بنجاح";
  if (job.status === "failed") return "آخر مزامنة فشلت";
  return "حالة غير معروفة";
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export default function ProductMatrixClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);

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

  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncJob, setSyncJob] = useState<SyncJob | null>(null);
  const [syncProgress, setSyncProgress] = useState(0);

  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importStage, setImportStage] = useState<
    "idle" | "uploading" | "processing" | "success" | "failed"
  >("idle");
  const [importProgress, setImportProgress] = useState(0);
  const [importLoadedBytes, setImportLoadedBytes] = useState(0);
  const [importTotalBytes, setImportTotalBytes] = useState(0);
  const [importFileName, setImportFileName] = useState<string | null>(null);

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

  async function loadSyncStatus() {
    try {
      const res = await j<SyncStatusResponse>("/api/salla/sync/products/status");
      setSyncJob(res.job || null);
      setSyncProgress(res.progress || 0);
      setSyncing(res.job?.status === "running");
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadAll();
    loadSyncStatus();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      loadSyncStatus();
    }, 1500);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (syncJob?.status === "success") {
      loadAll();
    }
  }, [syncJob?.status]);

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

  async function syncProducts() {
    try {
      setSyncing(true);
      setSyncMessage(null);
      setSyncError(null);

      const result = await j<SyncProductsResponse>("/api/salla/sync/products", {
        method: "POST",
      });

      await loadSyncStatus();

      setSyncMessage(
        result.jobId
          ? "بدأت مزامنة جميع المنتجات مع سلة"
          : `تم تحديث المنتجات بنجاح${typeof result.productsUpserted === "number" ? ` (${result.productsUpserted})` : ""}`,
      );
    } catch (e: any) {
      setSyncError(e?.message || "تعذر تحديث المنتجات من سلة");
      setSyncing(false);
    }
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

  function uploadImportWithProgress(file: File): Promise<ImportResponse> {
    return new Promise((resolve, reject) => {
      const fd = new FormData();
      fd.append("file", file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/products/matrix/import");

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;

        const loaded = event.loaded || 0;
        const total = event.total || 0;
        const progress = total > 0 ? Math.round((loaded / total) * 100) : 0;

        setImportStage("uploading");
        setImportLoadedBytes(loaded);
        setImportTotalBytes(total);
        setImportProgress(progress);
      };

      xhr.onload = () => {
        const text = xhr.responseText || "";
        let data: ImportResponse | null = null;

        try {
          data = JSON.parse(text);
        } catch {
          data = null;
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data || { ok: true });
          return;
        }

        reject(
          new Error(data?.error || text || "فشل رفع ملف الإكسل"),
        );
      };

      xhr.onerror = () => {
        reject(new Error("تعذر رفع الملف، تحقق من الاتصال ثم حاول مرة أخرى"));
      };

      xhr.send(fd);
    });
  }

  async function handleImport(file: File) {
    setUploading(true);
    setImportError(null);
    setImportMessage(null);
    setImportStage("uploading");
    setImportProgress(0);
    setImportLoadedBytes(0);
    setImportTotalBytes(file.size || 0);
    setImportFileName(file.name);

    try {
      const data = await uploadImportWithProgress(file);

      setImportStage("processing");
      setImportProgress(100);
      setImportLoadedBytes(file.size || 0);
      setImportTotalBytes(file.size || 0);

      await loadAll();

      setImportStage("success");
      setImportMessage(
        data?.total != null
          ? `تم رفع الملف وتحديث ${Number(data.total).toLocaleString("ar-SA")} منتج`
          : "تم رفع ملف الإكسل وتحديث البيانات",
      );
    } catch (err: any) {
      setImportStage("failed");
      setImportError(err?.message || "فشل رفع ملف الإكسل");
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
      <div className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="space-y-4">
          <div className="text-right">
            <h1 className="text-xl font-semibold">إعدادات المنتجات</h1>
            <p className="text-sm text-muted-foreground">
              تعديل جماعي سريع لإعدادات التشغيل لكل منتج.
            </p>

            <div className="mt-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              ✔️ علامة الصح تعني أن المنتج يمر على هذه المرحلة أثناء الإنتاج. 💰
              الرقم تحتها هو أجر أو تكلفة تنفيذ هذه المرحلة لكل قطعة.
            </div>
          </div>

          {syncMessage ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {syncMessage}
            </div>
          ) : null}

          {syncError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {syncError}
            </div>
          ) : null}

          {(uploading || importMessage || importError || importStage === "success") && (
            <div className="rounded-3xl border bg-muted/20 p-4">
              <div className="space-y-3 rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-right">
                    <div className="text-base font-bold">رفع ملف الإكسل</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {importFileName ? `الملف: ${importFileName}` : "اختر ملف الإكسل لبدء الرفع"}
                    </div>
                  </div>

                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                <div className="overflow-hidden rounded-full bg-muted h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-300 ${
                      importStage === "failed"
                        ? "bg-red-500"
                        : importStage === "success"
                          ? "bg-emerald-500"
                          : "bg-primary"
                    }`}
                    style={{ width: `${importProgress}%` }}
                  />
                </div>

                <div className="flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
                  <div>
                    الحالة:{" "}
                    <span className="font-bold text-foreground">
                      {importStage === "uploading" && "جاري رفع الملف..."}
                      {importStage === "processing" && "تم رفع الملف، جاري معالجة المنتجات..."}
                      {importStage === "success" && "اكتمل رفع الملف بنجاح"}
                      {importStage === "failed" && "فشل رفع الملف"}
                      {importStage === "idle" && "جاهز للرفع"}
                    </span>
                  </div>

                  <div>
                    التقدم:{" "}
                    <span className="font-bold text-foreground">
                      {importProgress}%
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
                  <div>
                    المرفوع الآن:{" "}
                    <span className="font-bold text-foreground">
                      {formatBytes(importLoadedBytes)}
                    </span>
                  </div>

                  <div>
                    حجم الملف:{" "}
                    <span className="font-bold text-foreground">
                      {formatBytes(importTotalBytes)}
                    </span>
                  </div>
                </div>

                {importMessage ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {importMessage}
                  </div>
                ) : null}

                {importError ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {importError}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <div className="rounded-3xl border bg-muted/20 p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex-1 text-right">
                  <div className="text-base font-bold">
                    مزامنة جميع المنتجات مع سلة
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    هذا الزر يجلب ويحدّث جميع منتجات المتجر من سلة
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={syncProducts}
                  disabled={syncing}
                  className="h-12 gap-2 rounded-2xl"
                >
                  {syncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  مزامنة جميع المنتجات
                </Button>
              </div>

              <div className="space-y-3 rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-right">
                    <div className="text-base font-bold">حالة المزامنة</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {statusLabel(syncJob)}
                    </div>
                  </div>

                  <RefreshCw className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className="overflow-hidden rounded-full bg-muted h-3">
                  <div
                    className="h-3 rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${syncProgress}%` }}
                  />
                </div>

                <div className="flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
                  <div>
                    التقدم:{" "}
                    <span className="font-bold text-foreground">
                      {syncProgress}%
                    </span>
                  </div>

                  <div>
                    تمت معالجة{" "}
                    <span className="font-bold text-foreground">
                      {Number(syncJob?.processed ?? 0).toLocaleString("ar-SA")}
                    </span>{" "}
                    من أصل{" "}
                    <span className="font-bold text-foreground">
                      {Number(syncJob?.total ?? 0).toLocaleString("ar-SA")}
                    </span>
                  </div>
                </div>

                {syncJob?.status === "failed" && syncJob?.last_error ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {syncJob.last_error}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="w-full xl:w-[260px]">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="بحث"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
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
        </div>
      </div>

      <div className="overflow-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="p-3 text-right">المنتج</th>
              <th className="p-3 text-center">القماش</th>
              <th className="p-3 text-center">كم/متر</th>

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