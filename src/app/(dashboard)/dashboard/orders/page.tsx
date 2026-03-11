// FILE: src/app/(dashboard)/dashboard/orders/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Package2,
  RefreshCw,
  ShoppingCart,
  SlidersHorizontal,
} from "lucide-react";

import { requireUser } from "@/lib/auth/requireUser";
import { requireTenant } from "@/lib/tenant/requireTenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sallaFetch } from "@/lib/salla/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import SyncOrdersButton from "@/components/orders/sync-orders-button";

type SP = Record<string, string | string[] | undefined>;

function spFirst(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function fmtMoney(amount: number | null, currency: string | null) {
  if (amount == null) return "—";
  const c = currency || "";
  return `${Number(amount).toLocaleString("ar-SA")} ${c}`.trim();
}

function fmtDt(v: string | null) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("ar-SA");
  } catch {
    return v;
  }
}

type SallaOrderStatus = {
  id: number;
  name: string;
  slug: string;
  sort?: number | null;
};

type SallaListStatusesResponse = {
  data?: SallaOrderStatus[];
};

function pillClass(active: boolean) {
  return [
    "group inline-flex h-12 items-center gap-3 rounded-2xl border px-4 text-sm font-medium whitespace-nowrap transition-all",
    "hover:border-foreground/15 hover:bg-muted/60",
    active
      ? "border-black bg-black text-white shadow-sm"
      : "border-border/70 bg-white text-foreground",
  ].join(" ");
}

function pillCountClass(active: boolean) {
  return [
    "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold",
    active ? "bg-white/15 text-white" : "bg-muted text-foreground",
  ].join(" ");
}

export default async function Page(props: { searchParams?: Promise<SP> }) {
  const searchParams = (await props.searchParams) || {};
  const selected = (spFirst(searchParams.status) || "all").toString();

  const { sb, user } = await requireUser();
  if (!user) return notFound();

  const { tenantId, role } = await requireTenant({ userId: user.id, sb });

  const inst = await sb
    .from("salla_installations")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (inst.error) throw inst.error;
  const installationId = inst.data?.id ?? null;

  if (!installationId) {
    return (
      <div dir="rtl" className="space-y-5 p-4 md:p-6">
        <div className="overflow-hidden rounded-[28px] border border-border/70 bg-white shadow-sm">
          <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
            <div className="space-y-2 text-right">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
                <ShoppingCart className="h-3.5 w-3.5" />
                إدارة ومزامنة الطلبات
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight">الطلبات</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  لا يوجد ربط سلة نشط لهذا المتجر.
                </p>
              </div>
            </div>

            <SyncOrdersButton disabled />
          </div>
        </div>

        <Card className="rounded-3xl border-border/70 shadow-sm">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            اربط متجرك أولاً ثم ارجع هنا.
          </CardContent>
        </Card>
      </div>
    );
  }

  const ordersRes = await sb
    .from("salla_orders")
    .select(
      "id,salla_order_id,order_number,status,currency,total_amount,customer_name,customer_phone,updated_at,created_at",
    )
    .eq("installation_id", installationId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (ordersRes.error) throw ordersRes.error;

  const orders = (ordersRes.data || []) as Array<{
    id: string;
    salla_order_id: string;
    order_number: string | null;
    status: string | null;
    currency: string | null;
    total_amount: number | null;
    customer_name: string | null;
    customer_phone: string | null;
    updated_at: string | null;
    created_at: string | null;
  }>;

  const admin = createSupabaseAdminClient();
  const tok = await admin
    .from("salla_tokens")
    .select("access_token")
    .eq("installation_id", installationId)
    .maybeSingle();
  if (tok.error) throw tok.error;

  const accessToken = tok.data?.access_token;
  if (!accessToken) throw new Error("Missing access_token");

  const statusesRes = await sallaFetch<SallaListStatusesResponse>(
    "/admin/v2/orders/statuses",
    accessToken,
  );

  const statuses = (Array.isArray(statusesRes?.data) ? statusesRes.data : [])
    .filter((s) => s?.slug && s?.name)
    .slice()
    .sort((a, b) => {
      const sa = a.sort ?? 9999;
      const sb2 = b.sort ?? 9999;
      if (sa !== sb2) return sa - sb2;
      return (a.id ?? 0) - (b.id ?? 0);
    });

  const statusNameBySlug = new Map<string, string>();
  for (const s of statuses) {
    statusNameBySlug.set(String(s.slug), String(s.name));
  }

  const counts = new Map<string, number>();
  for (const o of orders) {
    const k = (o.status || "").toString().trim();
    if (!k) continue;
    counts.set(k, (counts.get(k) || 0) + 1);
  }

  const filteredOrders =
    selected === "all"
      ? orders
      : orders.filter((o) => (o.status || "").toString() === selected);

  return (
    <div dir="rtl" className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="overflow-hidden rounded-[28px] border border-border/70 bg-white shadow-sm">
        <div className="flex flex-col gap-5 p-5 md:p-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-3 text-right">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
              <Package2 className="h-3.5 w-3.5" />
              أوامر المتجر والحالات من سلة
            </div>

            <div>
              <h1 className="text-2xl font-black tracking-tight md:text-3xl">
                الطلبات
              </h1>
              <p className="mt-1 text-sm text-muted-foreground md:text-base">
                الحالات من سلة مع تصفية مباشرة حسب الحالة ومزامنة سريعة للبيانات
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <SyncOrdersButton disabled={role !== "owner"} />
          </div>
        </div>
      </div>

      {/* Status filter pills */}
      <div className="overflow-hidden rounded-3xl border border-border/70 bg-white shadow-sm">
        <div className="border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-3 text-right">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted/60">
              <SlidersHorizontal className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-base font-bold md:text-lg">
                تصفية حسب الحالة
              </h2>
              <p className="text-xs text-muted-foreground md:text-sm">
                اختر حالة الطلب لعرض النتائج بسرعة
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 py-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Link
              href="/dashboard/orders?status=all"
              className={pillClass(selected === "all")}
            >
              <span>الكل</span>
              <span className={pillCountClass(selected === "all")}>
                {orders.length}
              </span>
            </Link>

            {statuses.map((st) => {
              const slug = String(st.slug);
              const active = selected === slug;

              return (
                <Link
                  key={String(st.id)}
                  href={`/dashboard/orders?status=${encodeURIComponent(slug)}`}
                  className={pillClass(active)}
                  title={st.name}
                >
                  <span>{st.name}</span>
                  <span className={pillCountClass(active)}>
                    {counts.get(slug) || 0}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Orders table */}
      <Card className="overflow-hidden rounded-3xl border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="text-right">
              <CardTitle className="text-lg font-bold">قائمة الطلبات</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                إجمالي النتائج: {filteredOrders.length}
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4" />
              آخر عرض حسب الفلتر الحالي
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredOrders.length === 0 ? (
            <div className="px-5 py-14 text-center text-sm text-muted-foreground">
              لا توجد طلبات لهذه الحالة.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="whitespace-nowrap text-right font-semibold">
                      رقم الطلب
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-right font-semibold">
                      الحالة
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-right font-semibold">
                      الإجمالي
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-right font-semibold">
                      العميل
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-right font-semibold">
                      الجوال
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-right font-semibold">
                      آخر تحديث
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredOrders.map((o) => {
                    const slug = (o.status || "").toString();
                    const label = statusNameBySlug.get(slug) || slug || "—";

                    return (
                      <TableRow key={o.id} className="hover:bg-muted/20">
                        <TableCell className="font-semibold">
                          {o.order_number || o.salla_order_id}
                        </TableCell>

                        <TableCell>
                          {slug ? (
                            <Badge
                              variant="secondary"
                              className="rounded-full px-3 py-1 text-xs font-medium"
                            >
                              {label}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>

                        <TableCell className="whitespace-nowrap">
                          {fmtMoney(o.total_amount, o.currency)}
                        </TableCell>

                        <TableCell>{o.customer_name || "—"}</TableCell>

                        <TableCell dir="ltr" className="text-left">
                          {o.customer_phone || "—"}
                        </TableCell>

                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {fmtDt(o.updated_at || o.created_at)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
