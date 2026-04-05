// FILE: src/app/admin/login/page.tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminLoginPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.is_super_admin) {
      redirect("/admin/dashboard");
    }
  }

  return (
    <main
      dir="rtl"
      className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6"
    >
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-2xl font-bold">دخول الإدارة</h1>
        <p className="mb-6 text-sm text-slate-500">
          سجّل الدخول بحساب الأدمن العام الخاص بالمنصة.
        </p>

        <form action="/login" method="get">
          <button
            type="submit"
            className="w-full rounded-lg bg-black px-4 py-3 text-white"
          >
            تسجيل الدخول
          </button>
        </form>
      </div>
    </main>
  );
}