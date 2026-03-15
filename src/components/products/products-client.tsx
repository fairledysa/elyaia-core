// FILE: src/components/products/products-client.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Loader2,
  Settings2,
  Plus,
  Trash2,
  Package,
  Search,
  Workflow,
  Boxes,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

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

type SallaProductRow = {
  id?: string;
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

type ProductStageRelation =
  | {
      name?: string | null;
      require_previous_complete?: boolean;
      inventory_deduct_enabled?: boolean;
      archived?: boolean;
    }
  | Array<{
      name?: string | null;
      require_previous_complete?: boolean;
      inventory_deduct_enabled?: boolean;
      archived?: boolean;
    }>
  | null;

type ProductStageRow = {
  id: string;
  stage_id: string;
  enabled: boolean;
  payout_amount: number | null;
  sort_order: number;
  stages?: ProductStageRelation;
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

type ProductsApiResponse = {
  ok: boolean;
  items: SallaProductRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const txt = await res.text();
  if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
  return JSON.parse(txt) as T;
}

function fmtMoney(price: number | null, currency: string | null) {
  if (price == null) return "—";
  return `${price} ${currency || ""}`.trim();
}

function SectionShell({
  icon: Icon,
  title,
  subtitle,
  action,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden rounded-3xl border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 text-right">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted/50 text-foreground">
              <Icon className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <CardTitle className="text-base font-bold md:text-lg">
                {title}
              </CardTitle>
              {subtitle ? (
                <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
          </div>

          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </CardHeader>

      <CardContent className="p-4">{children}</CardContent>
    </Card>
  );
}

function statusLabel(job: SyncJob | null) {
  if (!job) return "لا توجد مزامنة حديثة";
  if (job.status === "running") return "جاري مزامنة جميع المنتجات مع سلة";
  if (job.status === "success") return "آخر مزامنة اكتملت بنجاح";
  if (job.status === "failed") return "آخر مزامنة فشلت";
  return "حالة غير معروفة";
}

export default function ProductsClient() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<SallaProductRow[]>([]);
  const [q, setQ] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

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

  const [addStageId, setAddStageId] = useState("");
  const [addStagePayout, setAddStagePayout] = useState<string>("");
  const [addMaterialId, setAddMaterialId] = useState("");
  const [addMaterialQty, setAddMaterialQty] = useState<string>("");

  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncJob, setSyncJob] = useState<SyncJob | null>(null);
  const [syncProgress, setSyncProgress] = useState(0);

  async function loadBaseData(nextPage = page, nextPageSize = pageSize) {
    setLoading(true);
    try {
      const p = await j<ProductsApiResponse>(
        `/api/products?page=${nextPage}&limit=${nextPageSize}`,
      );
      setProducts(p.items || []);
      setPage(p.page || nextPage);
      setPageSize(p.limit || nextPageSize);
      setTotal(p.total || 0);
      setTotalPages(Math.max(1, p.totalPages || 1));

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
  }

  async function reloadProductsOnly(
    nextActiveId?: string | null,
    nextPage = page,
    nextPageSize = pageSize,
  ) {
    const p = await j<ProductsApiResponse>(
      `/api/products?page=${nextPage}&limit=${nextPageSize}`,
    );
    const nextProducts = p.items || [];

    setProducts(nextProducts);
    setPage(p.page || nextPage);
    setPageSize(p.limit || nextPageSize);
    setTotal(p.total || 0);
    setTotalPages(Math.max(1, p.totalPages || 1));

    if (nextActiveId) {
      const found = nextProducts.find(
        (item) => item.salla_product_id === nextActiveId,
      );
      if (found) setActive(found);
    }
  }

  async function loadSyncStatus() {
    try {
      const res = await j<SyncStatusResponse>("/api/salla/sync/products/status");
      setSyncJob(res.job || null);
      setSyncProgress(res.progress || 0);
      setSyncing(res.job?.status === "running");
    } catch {}
  }

  async function reloadProductStages(productId: string) {
    const ps = await j<{ ok: boolean; items: ProductStageRow[] }>(
      `/api/products/${encodeURIComponent(productId)}/stages`,
    );
    setProductStages(
      (ps.items || []).sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      ),
    );
  }

  async function reloadProductMaterials(productId: string) {
    const pm = await j<{ ok: boolean; items: ProductMaterialRow[] }>(
      `/api/products/${encodeURIComponent(productId)}/materials`,
    );
    setProductMaterials(pm.items || []);
  }

  useEffect(() => {
    loadBaseData(1, pageSize);
    loadSyncStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadBaseData(page, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadSyncStatus();
    }, 1500);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (syncJob?.status === "success") {
      reloadProductsOnly(active?.salla_product_id || null, page, pageSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncJob?.status]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return products;

    return products.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(needle) ||
        (p.sku || "").toLowerCase().includes(needle),
    );
  }, [products, q]);

  const stageNameMap = useMemo(() => {
    return new Map(stages.map((stage) => [stage.id, stage.name]));
  }, [stages]);

  function getStageName(row: ProductStageRow) {
    return stageNameMap.get(row.stage_id) || row.stage_id;
  }

  const availableStages = useMemo(() => {
    const used = new Set(productStages.map((x) => x.stage_id));
    return stages.filter((stage) => !used.has(stage.id));
  }, [stages, productStages]);

  const hasMaterialLinked = productMaterials.length > 0;

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

  async function openSettings(p: SallaProductRow) {
    setActive(p);
    setOpen(true);

    setAddStageId("");
    setAddStagePayout("");
    setAddMaterialId("");
    setAddMaterialQty("");

    setPsLoading(true);
    setPmLoading(true);

    try {
      await Promise.all([
        reloadProductStages(p.salla_product_id),
        reloadProductMaterials(p.salla_product_id),
      ]);
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

      await reloadProductStages(active.salla_product_id);
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

      await reloadProductStages(active.salla_product_id);
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

      await reloadProductStages(active.salla_product_id);
    } finally {
      setPsLoading(false);
    }
  }

  async function addMaterial() {
    if (!active || !addMaterialId || hasMaterialLinked) return;

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

      await reloadProductMaterials(active.salla_product_id);
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

      await reloadProductMaterials(active.salla_product_id);
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

      await reloadProductMaterials(active.salla_product_id);
      setAddMaterialId("");
      setAddMaterialQty("");
    } finally {
      setPmLoading(false);
    }
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(page * pageSize, total);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div dir="rtl" className="space-y-6">
      <Card className="overflow-hidden rounded-[28px] border-border/70 shadow-sm">
        <CardContent className="p-5 md:p-6">
          <div className="space-y-4">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
              <Package className="h-3.5 w-3.5" />
              إدارة المنتجات وربط التشغيل
            </div>

            <div className="text-right">
              <h1 className="text-2xl font-black tracking-tight md:text-3xl">
                المنتجات
              </h1>
              <p className="mt-1 text-sm text-muted-foreground md:text-base">
                منتجات سلة مع إعدادات التشغيل وربط المراحل والمواد لكل منتج
              </p>
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

            <div className="rounded-3xl border border-border/70 bg-muted/20 p-4">
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

                <div className="space-y-3 rounded-2xl border border-border/70 bg-white p-4">
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

            <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
              <div className="rounded-3xl border border-border/70 bg-white p-4">
                <label className="mb-3 block text-right text-sm font-bold">
                  عدد المنتجات في الصفحة
                </label>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPage(1);
                    setPageSize(Number(e.target.value));
                  }}
                  className="h-12 w-full rounded-2xl border border-border/70 bg-background px-3 text-sm outline-none"
                >
                  <option value={20}>عرض 20 منتج في الصفحة</option>
                  <option value={50}>عرض 50 منتج في الصفحة</option>
                  <option value={100}>عرض 100 منتج في الصفحة</option>
                </select>
              </div>

              <div className="rounded-3xl border border-border/70 bg-white p-4">
                <label className="mb-3 block text-right text-sm font-bold">
                  البحث في المنتجات
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="بحث بالاسم أو SKU"
                    className="h-12 rounded-2xl border-border/70 pr-10"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <SectionShell
        icon={Package}
        title="قائمة المنتجات"
        subtitle={`عرض ${rangeStart}–${rangeEnd} من أصل ${total}`}
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            جاري التحميل...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            لا يوجد منتجات.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => (
              <div
                key={p.salla_product_id}
                className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-white p-4 transition hover:bg-muted/20 md:flex-row md:items-center"
              >
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 overflow-hidden rounded-2xl border border-border/70 bg-muted">
                    {p.image_url ? (
                      <Image
                        src={p.image_url}
                        alt={p.name || ""}
                        width={56}
                        height={56}
                        className="h-14 w-14 object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Package className="h-5 w-5" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 text-right">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-sm font-bold md:text-base">
                        {p.name || "—"}
                      </div>
                      {p.status ? (
                        <Badge
                          variant="secondary"
                          className="rounded-full px-3 py-1 text-xs"
                        >
                          {p.status}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="mt-1 text-xs text-muted-foreground">
                      SKU: {p.sku || "—"} • ID: {p.salla_product_id}
                    </div>
                  </div>
                </div>

                <div className="mr-auto text-right md:text-left">
                  <div className="text-sm text-muted-foreground">السعر</div>
                  <div className="text-sm font-bold md:text-base">
                    {fmtMoney(p.price, p.currency)}
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="h-11 gap-2 rounded-2xl border-border/70"
                  onClick={() => openSettings(p)}
                >
                  <Settings2 className="h-4 w-4" />
                  إعدادات المنتج
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 border-t border-border/60 pt-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              الصفحة {page} من {totalPages} — عدد المنتجات في الصفحة: {pageSize}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!hasPrev || loading}
                className="rounded-xl"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronRight className="h-4 w-4" />
                السابق
              </Button>

              <div className="inline-flex min-w-24 items-center justify-center rounded-xl border border-border/70 px-3 py-2 text-sm font-medium">
                {page} / {totalPages}
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={!hasNext || loading}
                className="rounded-xl"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                التالي
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </SectionShell>

      <Dialog open={open} onOpenChange={(v) => setOpen(v)}>
        <DialogContent
          dir="rtl"
          className="
            w-[98vw] max-w-[1400px]
            h-[90vh] max-h-[90vh]
            overflow-hidden p-0
          "
        >
          {active ? (
            <div className="flex h-full flex-col">
              <DialogHeader className="shrink-0 border-b px-6 py-5">
                <DialogTitle className="text-right text-xl font-bold">
                  إعدادات المنتج
                </DialogTitle>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="space-y-5">
                  <div className="rounded-3xl border border-border/70 bg-muted/20 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-16 w-16 overflow-hidden rounded-2xl border border-border/70 bg-muted">
                          {active.image_url ? (
                            <Image
                              src={active.image_url}
                              alt={active.name || ""}
                              width={64}
                              height={64}
                              className="h-16 w-16 object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 text-right">
                          <div className="truncate text-base font-bold md:text-lg">
                            {active.name || "—"}
                          </div>
                          <div className="mt-1 break-all text-xs text-muted-foreground">
                            SKU: {active.sku || "—"} • {active.salla_product_id}
                          </div>
                        </div>
                      </div>

                      <div className="text-right lg:text-left">
                        <div className="text-sm text-muted-foreground">
                          السعر الحالي
                        </div>
                        <div className="text-base font-bold">
                          {fmtMoney(active.price, active.currency)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-5 2xl:grid-cols-[1.15fr_0.85fr]">
                    <SectionShell
                      icon={Workflow}
                      title="المراحل"
                      subtitle="ربط المنتج بمراحل الإنتاج وتحديد سعر المرحلة"
                      action={
                        <Link
                          href="/dashboard/settings/stages"
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          ضبط المراحل
                        </Link>
                      }
                    >
                      <div className="space-y-4">
                        <div className="grid gap-2 lg:grid-cols-12">
                          <div className="lg:col-span-5">
                            <select
                              className="h-11 w-full rounded-2xl border border-border/70 bg-background px-3 text-sm outline-none"
                              value={addStageId}
                              onChange={(e) => setAddStageId(e.target.value)}
                            >
                              <option value="">اختر مرحلة</option>
                              {availableStages.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="lg:col-span-4">
                            <Input
                              value={addStagePayout}
                              onChange={(e) =>
                                setAddStagePayout(e.target.value)
                              }
                              placeholder="السعر"
                              inputMode="decimal"
                              className="h-11 rounded-2xl border-border/70"
                            />
                          </div>

                          <div className="lg:col-span-3">
                            <Button
                              type="button"
                              className="h-11 w-full gap-2 rounded-2xl"
                              onClick={addStage}
                              disabled={!addStageId || psLoading}
                            >
                              {psLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Plus className="h-4 w-4" />
                              )}
                              إضافة
                            </Button>
                          </div>
                        </div>

                        <Separator />

                        {psLoading ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            جاري التحميل...
                          </div>
                        ) : productStages.length === 0 ? (
                          <div className="text-sm text-muted-foreground">
                            لا يوجد مراحل مربوطة.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {productStages.map((r) => (
                              <div
                                key={r.id}
                                className="rounded-2xl border border-border/70 p-3"
                              >
                                <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                                  <div className="min-w-0 flex-1 text-right">
                                    <div className="truncate text-sm font-bold">
                                      {getStageName(r)}
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                      ترتيب: {r.sort_order}
                                    </div>
                                  </div>

                                  <Input
                                    className="h-10 w-full rounded-xl border-border/70 xl:w-36"
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

                                  <div className="flex flex-wrap items-center justify-end gap-2">
                                    <div className="flex items-center gap-2 rounded-xl border border-border/70 px-3 py-2">
                                      <span className="text-xs text-muted-foreground">
                                        تفعيل
                                      </span>
                                      <Switch
                                        checked={!!r.enabled}
                                        onCheckedChange={(v) =>
                                          patchStage(r.id, { enabled: v })
                                        }
                                      />
                                    </div>

                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="rounded-xl border-border/70"
                                      onClick={() => deleteStage(r.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </SectionShell>

                    <SectionShell
                      icon={Boxes}
                      title="المخزون (قماش)"
                      subtitle="ربط المنتج بالقماش الخام وتحديد الاستهلاك لكل قطعة"
                      action={
                        <Link
                          href="/dashboard/inventory"
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          ضبط المخزون
                        </Link>
                      }
                    >
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <div className="grid gap-2 lg:grid-cols-12">
                            <div className="lg:col-span-5">
                              <select
                                className="h-11 w-full rounded-2xl border border-border/70 bg-background px-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
                                value={addMaterialId}
                                onChange={(e) =>
                                  setAddMaterialId(e.target.value)
                                }
                                disabled={hasMaterialLinked}
                              >
                                <option value="">اختر مادة</option>
                                {materials.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="lg:col-span-4">
                              <Input
                                value={addMaterialQty}
                                onChange={(e) =>
                                  setAddMaterialQty(e.target.value)
                                }
                                placeholder="كم/متر"
                                inputMode="decimal"
                                className="h-11 rounded-2xl border-border/70"
                                disabled={hasMaterialLinked}
                              />
                            </div>

                            <div className="lg:col-span-3">
                              <Button
                                type="button"
                                className="h-11 w-full gap-2 rounded-2xl"
                                onClick={addMaterial}
                                disabled={
                                  !addMaterialId ||
                                  pmLoading ||
                                  hasMaterialLinked
                                }
                              >
                                {pmLoading ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Plus className="h-4 w-4" />
                                )}
                                إضافة
                              </Button>
                            </div>
                          </div>

                          {hasMaterialLinked ? (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                              هذا المنتج مرتبط بمادة واحدة فقط. لحفظ مادة جديدة
                              احذف المادة الحالية أولًا.
                            </div>
                          ) : null}
                        </div>

                        <Separator />

                        {pmLoading ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            جاري التحميل...
                          </div>
                        ) : productMaterials.length === 0 ? (
                          <div className="text-sm text-muted-foreground">
                            لا يوجد مواد مربوطة.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {productMaterials.map((r) => (
                              <div
                                key={r.id}
                                className="rounded-2xl border border-border/70 p-3"
                              >
                                <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                                  <div className="min-w-0 flex-1 text-right">
                                    <div className="truncate text-sm font-bold">
                                      {r.materials?.name || r.material_id}
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                      استهلاك لكل قطعة
                                    </div>
                                  </div>

                                  <Input
                                    className="h-10 w-full rounded-xl border-border/70 xl:w-36"
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

                                  <div className="flex justify-end">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="rounded-xl border-border/70"
                                      onClick={() => deleteMaterial(r.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </SectionShell>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}