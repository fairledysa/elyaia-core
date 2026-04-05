// FILE: src/app/admin/dashboard/page.tsx

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function statusLabel(status: string) {
  switch (status) {
    case "active":
      return "مفعّل";
    case "trialing":
      return "تجريبي";
    case "expired":
      return "منتهي";
    case "canceled":
      return "ملغي";
    case "uninstalled":
      return "محذوف";
    default:
      return "غير مفعّل";
  }
}

function statusClass(status: string) {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-700 border-green-200";
    case "trialing":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "expired":
      return "bg-red-100 text-red-700 border-red-200";
    case "canceled":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "uninstalled":
      return "bg-zinc-200 text-zinc-700 border-zinc-300";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_super_admin) {
    redirect("/");
  }

  const admin = createSupabaseAdminClient();

  const { data: tenants, error } = await admin
    .from("tenants")
    .select(`
      id,
      name,
      created_at,
      salla_installations (
        id,
        merchant_id,
        store_name,
        owner_email,
        status
      ),
      app_subscriptions (
        status,
        plan_name,
        updated_at,
        expires_at,
        trial_ends_at,
        last_event
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main dir="rtl" className="p-6">
        <h1 className="mb-4 text-2xl font-bold">لوحة تحكم الإدارة</h1>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          فشل تحميل المتاجر: {error.message}
        </div>
      </main>
    );
  }

  const rows =
    tenants?.map((tenant: any) => {
      const installation = tenant.salla_installations?.[0] ?? null;
      const subscription = tenant.app_subscriptions?.[0] ?? null;
      const status = subscription?.status || "inactive";

      return {
        id: tenant.id,
        name: installation?.store_name || tenant.name || "بدون اسم",
        ownerEmail: installation?.owner_email || "-",
        merchantId: installation?.merchant_id || "-",
        installStatus: installation?.status || "-",
        status,
        statusLabel: statusLabel(status),
        planName: subscription?.plan_name || "-",
        updatedAt: subscription?.updated_at || tenant.created_at,
        lastEvent: subscription?.last_event || "-",
      };
    }) ?? [];

  const total = rows.length;
  const activeCount = rows.filter((x) => x.status === "active").length;
  const trialingCount = rows.filter((x) => x.status === "trialing").length;
  const expiredCount = rows.filter((x) => x.status === "expired").length;
  const inactiveCount = rows.filter((x) =>
    ["inactive", "canceled", "uninstalled"].includes(x.status),
  ).length;

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">
              لوحة تحكم الإدارة
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              متابعة جميع المتاجر والاشتراكات من مكان واحد
            </p>
          </div>

          <form action="/admin/login" method="get">
            <button className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">
              تبديل الحساب
            </button>
          </form>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">إجمالي المتاجر</div>
            <div className="mt-2 text-3xl font-black">{total}</div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">المفعّلة</div>
            <div className="mt-2 text-3xl font-black text-green-600">
              {activeCount}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">التجريبية</div>
            <div className="mt-2 text-3xl font-black text-blue-600">
              {trialingCount}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">المنتهية / الموقوفة</div>
            <div className="mt-2 text-3xl font-black text-red-600">
              {expiredCount + inactiveCount}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="font-bold text-slate-900">قائمة المتاجر</h2>
          </div>

          {rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              لا توجد متاجر حتى الآن
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-bold">المتجر</th>
                    <th className="px-4 py-3 font-bold">البريد</th>
                    <th className="px-4 py-3 font-bold">Merchant ID</th>
                    <th className="px-4 py-3 font-bold">حالة الاشتراك</th>
                    <th className="px-4 py-3 font-bold">الخطة</th>
                    <th className="px-4 py-3 font-bold">آخر حدث</th>
                    <th className="px-4 py-3 font-bold">آخر تحديث</th>
                    <th className="px-4 py-3 font-bold">التحكم</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-4 py-4 font-semibold text-slate-900">
                        {row.name}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {row.ownerEmail}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {row.merchantId}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusClass(row.status)}`}
                        >
                          {row.statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {row.planName}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {row.lastEvent}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {row.updatedAt
                          ? new Date(row.updatedAt).toLocaleString("ar-SA")
                          : "-"}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <form
                            action="/api/admin/subscription/activate"
                            method="post"
                          >
                            <input
                              type="hidden"
                              name="tenant_id"
                              value={row.id}
                            />
                            <button className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white">
                              تفعيل
                            </button>
                          </form>

                          <form
                            action="/api/admin/subscription/disable"
                            method="post"
                          >
                            <input
                              type="hidden"
                              name="tenant_id"
                              value={row.id}
                            />
                            <button className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white">
                              إيقاف
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}