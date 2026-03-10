// FILE: src/app/production-login/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn, Smartphone } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function ProductionLoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [employee, setEmployee] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const identifier = employee.trim();
    const pass = password.trim();

    if (!identifier || !pass) {
      setError("أدخل رقم الموظف أو الجوال أو الإيميل وكلمة المرور");
      return;
    }

    try {
      setLoading(true);

      await supabase.auth.signOut();

      const lookupRes = await fetch("/api/production/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });

      const lookupJson = await lookupRes.json();

      if (!lookupRes.ok) {
        throw new Error(lookupJson?.error || "LOGIN_LOOKUP_FAILED");
      }

      const email = String(lookupJson?.email || "").trim();

      if (!email) {
        throw new Error("EMPLOYEE_EMAIL_NOT_FOUND");
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });

      if (signInError) {
        throw new Error("بيانات الدخول غير صحيحة");
      }

      router.replace("/production");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),_transparent_35%),linear-gradient(180deg,#0b1020_0%,#12182d_45%,#0b1020_100%)]"
    >
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4">
        <div className="w-full space-y-6">
          <div className="text-center text-white">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white/10 backdrop-blur">
              <Smartphone className="h-8 w-8" />
            </div>

            <h1 className="text-2xl font-black">Elyaia Production</h1>
            <p className="mt-1 text-sm text-white/60">تسجيل دخول العامل</p>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#0f172a]/80 p-6 shadow-2xl backdrop-blur">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-white/70">
                  رقم الموظف أو الجوال أو الإيميل
                </label>

                <input
                  value={employee}
                  onChange={(e) => setEmployee(e.target.value)}
                  className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none focus:border-indigo-400"
                  placeholder="055xxxxxxx أو employee@email.com"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/70">
                  كلمة المرور
                </label>

                <div className="relative">
                  <input
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none focus:border-indigo-400"
                    placeholder="••••••••"
                    dir="ltr"
                  />

                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="absolute left-3 top-3 text-white/60"
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#1d4ed8,#7c3aed)] text-sm font-bold text-white shadow-lg disabled:opacity-60"
              >
                <LogIn size={18} />
                {loading ? "جاري الدخول..." : "دخول"}
              </button>
            </form>

            <div className="mt-5 text-center text-xs text-white/40">
              نظام إدارة الإنتاج
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
