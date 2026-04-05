// FILE: src/app/admin/dashboard/page.tsx

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  // 🔥 جلب جميع المتاجر + الاشتراك
  const { data: tenants } = await supabase
    .from("tenants")
    .select(`
      id,
      name,
      app_subscriptions (
        status,
        plan_name,
        updated_at
      )
    `)
    .order("created_at", { ascending: false });

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-6">لوحة تحكم الإدارة</h1>

      <div className="space-y-4">
        {tenants?.map((t: any) => {
          const sub = t.app_subscriptions?.[0];

          return (
            <div
              key={t.id}
              className="border rounded-lg p-4 flex items-center justify-between"
            >
              <div>
                <div className="font-semibold">{t.name}</div>
                <div className="text-sm text-gray-500">
                  الحالة: {sub?.status || "inactive"}
                </div>
              </div>

              <div className="flex gap-2">
                <form action={`/api/admin/subscription/activate`} method="post">
                  <input type="hidden" name="tenant_id" value={t.id} />
                  <button className="px-3 py-1 bg-green-500 text-white rounded">
                    تفعيل
                  </button>
                </form>

                <form action={`/api/admin/subscription/disable`} method="post">
                  <input type="hidden" name="tenant_id" value={t.id} />
                  <button className="px-3 py-1 bg-red-500 text-white rounded">
                    إيقاف
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}