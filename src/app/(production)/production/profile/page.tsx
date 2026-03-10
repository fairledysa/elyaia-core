// FILE: src/app/(production)/production/profile/page.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  Loader2,
  LogOut,
  ShieldCheck,
  UserCircle2,
} from "lucide-react";

type ProfileApiResponse = {
  ok?: boolean;
  error?: string;
  profile?: {
    name: string | null;
    phone: string | null;
    stage: string | null;
    active: boolean | null;
    payType: string | null;
  };
};

function mapPayType(value: string | null | undefined) {
  if (!value) return "-";
  if (value === "piece" || value === "piece_rate" || value === "per_piece")
    return "بالقطعة";
  if (value === "salary") return "راتب شهري";
  return value;
}

function mapActive(value: boolean | null | undefined) {
  if (value === true) return "نشط";
  if (value === false) return "غير نشط";
  return "-";
}

export default function ProductionProfilePage() {
  const router = useRouter();

  const [data, setData] = useState<ProfileApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadProfile() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/production/profile", {
        method: "GET",
        cache: "no-store",
      });

      const json = (await res
        .json()
        .catch(() => null)) as ProfileApiResponse | null;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "FAILED_TO_LOAD_PROFILE");
      }

      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "FAILED_TO_LOAD_PROFILE");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      setLogoutLoading(true);
      setError(null);

      const res = await fetch("/api/auth/signout", {
        method: "POST",
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "FAILED_TO_SIGN_OUT");
      }

      router.replace("/production-login");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "FAILED_TO_SIGN_OUT");
      setLogoutLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  const profile = data?.profile ?? null;

  const profileRows = [
    { label: "الاسم", value: profile?.name || "-" },
    { label: "المرحلة", value: profile?.stage || "-" },
    { label: "رقم الجوال", value: profile?.phone || "-" },
    { label: "الحالة", value: mapActive(profile?.active) },
    { label: "نوع الدفع", value: mapPayType(profile?.payType) },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="flex items-center gap-3 text-slate-700">
          <Loader2 className="h-5 w-5 animate-spin" />
          جاري تحميل الحساب...
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="mb-2 text-base font-black text-slate-900">
          تعذر تحميل الحساب
        </div>
        <div className="text-sm text-red-600">{error}</div>
        <button
          type="button"
          onClick={loadProfile}
          className="mt-4 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[30px] bg-[linear-gradient(135deg,#111827,#1d4ed8,#7c3aed)] p-5 text-white shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-white/10 backdrop-blur">
            <UserCircle2 className="h-12 w-12" />
          </div>

          <div>
            <div className="text-xs text-white/70">حساب العامل</div>
            <div className="mt-1 text-2xl font-black">
              {profile?.name || "-"}
            </div>
            <div className="mt-2 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs">
              {(profile?.stage || "-") + " · " + mapActive(profile?.active)}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="mb-4 text-base font-black text-slate-900">بياناتي</div>

        <div className="space-y-3">
          {profileRows.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-4"
            >
              <div className="text-sm text-slate-500">{item.label}</div>
              <div className="font-bold text-slate-900">{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="mb-4 text-base font-black text-slate-900">
          الإعدادات
        </div>

        <div className="space-y-3">
          <Link
            href="/production/profile/privacy"
            className="flex w-full items-center justify-between rounded-2xl bg-slate-50 px-4 py-4 text-right"
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              <span className="font-medium text-slate-900">
                الخصوصية والأمان
              </span>
            </div>
            <ChevronLeft className="h-4 w-4 text-slate-400" />
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            disabled={logoutLoading}
            className="flex w-full items-center justify-between rounded-2xl bg-rose-50 px-4 py-4 text-right text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="flex items-center gap-3">
              {logoutLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <LogOut className="h-5 w-5" />
              )}
              <span className="font-bold">
                {logoutLoading ? "جاري تسجيل الخروج..." : "تسجيل الخروج"}
              </span>
            </div>
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {error ? (
          <div className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
      </section>
    </div>
  );
}
