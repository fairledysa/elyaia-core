// FILE: src/app/(dashboard)/dashboard/orders/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";

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
    "inline-flex h-11 items-center gap-3 rounded-xl border px-4 text-sm font-medium",
    "transition-colors select-none cursor-pointer",
    "hover:bg-accent hover:text-accent-foreground",
    active
      ? "bg-primary text-primary-foreground border-primary hover:bg-primary"
      : "bg-background text-foreground",
  ].join(" ");
}

function pillCountClass(active: boolean) {
  return [
    "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs",
    active ? "bg-primary-foreground/20" : "bg-muted",
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
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">الطلبات</h1>
            <p className="text-sm text-muted-foreground">
              لا يوجد ربط سلة نشط لهذا المتجر.
            </p>
          </div>
          <SyncOrdersButton disabled />
        </div>

        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            اربط متجرك أولاً ثم ارجع هنا.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Orders (DB)
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

  // Statuses (Salla) — المصدر الحقيقي
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
  for (const s of statuses)
    statusNameBySlug.set(String(s.slug), String(s.name));

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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">الطلبات</h1>
          <p className="text-sm text-muted-foreground">
            الحالات من سلة + تصفية مباشرة حسب الحالة
          </p>
        </div>

        <SyncOrdersButton disabled={role !== "owner"} />
      </div>

      {/* شريط الحالات (من سلة) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
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
              <span className="whitespace-nowrap">{st.name}</span>
              <span className={pillCountClass(active)}>
                {counts.get(slug) || 0}
              </span>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">قائمة الطلبات</CardTitle>
        </CardHeader>

        <CardContent>
          {filteredOrders.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              لا توجد طلبات لهذه الحالة.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">
                      رقم الطلب
                    </TableHead>
                    <TableHead className="whitespace-nowrap">الحالة</TableHead>
                    <TableHead className="whitespace-nowrap">
                      الإجمالي
                    </TableHead>
                    <TableHead className="whitespace-nowrap">العميل</TableHead>
                    <TableHead className="whitespace-nowrap">الجوال</TableHead>
                    <TableHead className="whitespace-nowrap">
                      آخر تحديث
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredOrders.map((o) => {
                    const slug = (o.status || "").toString();
                    const label = statusNameBySlug.get(slug) || slug || "—";

                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">
                          {o.order_number || o.salla_order_id}
                        </TableCell>

                        <TableCell>
                          {slug ? (
                            <Badge variant="secondary">{label}</Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>

                        <TableCell>
                          {fmtMoney(o.total_amount, o.currency)}
                        </TableCell>

                        <TableCell>{o.customer_name || "—"}</TableCell>
                        <TableCell dir="ltr">
                          {o.customer_phone || "—"}
                        </TableCell>

                        <TableCell className="text-muted-foreground">
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
