// FILE: src/app/(production)/production/profile/privacy/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  EyeOff,
  Loader2,
  LockKeyhole,
  Save,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

type PrivacyApiResponse = {
  ok?: boolean;
  error?: string;
  privacy?: {
    accountName: string;
    maskedEmail: string | null;
    maskedPhone: string | null;
    accountStatus: string;
    role: string | null;
    lastProfileUpdate: string | null;
    sessionUserId: string;
    sessionEmailVerifiedAt: string | null;
    memberSince: string | null;
    securityNotes: string[];
  };
};

function mapRole(value: string | null | undefined) {
  if (!value) return "-";
  if (value === "owner") return "مالك";
  if (value === "admin") return "إداري";
  if (value === "worker") return "عامل";
  return value;
}

function mapError(error: string) {
  switch (error) {
    case "FULL_NAME_REQUIRED":
      return "الاسم مطلوب";
    case "PASSWORD_REQUIRED":
      return "كلمة المرور وتأكيدها مطلوبان";
    case "PASSWORD_TOO_SHORT":
      return "كلمة المرور يجب أن تكون 6 أحرف على الأقل";
    case "PASSWORDS_DO_NOT_MATCH":
      return "كلمتا المرور غير متطابقتين";
    case "UNAUTHORIZED":
      return "يجب تسجيل الدخول أولًا";
    default:
      return error || "حدث خطأ غير متوقع";
  }
}

export default function ProductionPrivacyPage() {
  const [data, setData] = useState<PrivacyApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function loadPrivacy() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/production/profile/privacy", {
        method: "GET",
        cache: "no-store",
      });

      const json = (await res
        .json()
        .catch(() => null)) as PrivacyApiResponse | null;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "FAILED_TO_LOAD_PRIVACY");
      }

      setData(json);
      setFullName(json.privacy?.accountName || "");
      setPhone(json.privacy?.maskedPhone || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "FAILED_TO_LOAD_PRIVACY");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPrivacy();
  }, []);

  const privacy = data?.privacy ?? null;
  const securityNotes = useMemo(
    () => privacy?.securityNotes ?? [],
    [privacy?.securityNotes],
  );

  async function handleSaveProfile() {
    try {
      setProfileSaving(true);
      setProfileError(null);
      setProfileMessage(null);

      const res = await fetch("/api/production/profile/update", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          phone,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        throw new Error(mapError(json?.error || "FAILED_TO_UPDATE_PROFILE"));
      }

      setProfileMessage("تم تحديث البيانات بنجاح");
      await loadPrivacy();
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : "تعذر تحديث البيانات",
      );
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleChangePassword() {
    try {
      setPasswordSaving(true);
      setPasswordError(null);
      setPasswordMessage(null);

      const res = await fetch("/api/production/profile/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password,
          confirmPassword,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        throw new Error(mapError(json?.error || "FAILED_TO_CHANGE_PASSWORD"));
      }

      setPassword("");
      setConfirmPassword("");
      setPasswordMessage("تم تغيير كلمة المرور بنجاح");
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : "تعذر تغيير كلمة المرور",
      );
    } finally {
      setPasswordSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="flex items-center gap-3 text-slate-700">
          <Loader2 className="h-5 w-5 animate-spin" />
          جاري تحميل الخصوصية والأمان...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="mb-2 text-base font-black text-slate-900">
          تعذر تحميل الخصوصية والأمان
        </div>
        <div className="text-sm text-red-600">{error}</div>
        <button
          type="button"
          onClick={loadPrivacy}
          className="mt-4 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[30px] bg-[linear-gradient(135deg,#0f172a,#1d4ed8,#0f766e)] p-5 text-white shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-white/70">الإعدادات</div>
            <div className="mt-2 text-2xl font-black">الخصوصية والأمان</div>
            <div className="mt-2 text-sm text-white/80">
              تعديل البيانات وتغيير كلمة المرور
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 p-3">
            <ShieldCheck className="h-6 w-6" />
          </div>
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-base font-black text-slate-900">الحماية</div>
          <Link
            href="/production/profile"
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700"
          >
            <ChevronRight className="h-4 w-4" />
            رجوع
          </Link>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-50 px-4 py-4">
            <div className="mb-3 flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-emerald-600" />
              <div className="font-bold text-slate-900">تعديل البيانات</div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white px-4 py-3">
                <div className="mb-2 text-xs text-slate-500">الاسم</div>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-900 outline-none focus:border-indigo-400"
                  placeholder="اكتب الاسم"
                />
              </div>

              <div className="rounded-2xl bg-white px-4 py-3">
                <div className="mb-2 text-xs text-slate-500">رقم الجوال</div>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  dir="ltr"
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-900 outline-none focus:border-indigo-400"
                  placeholder="05xxxxxxxx"
                />
              </div>

              <div className="rounded-2xl bg-white px-4 py-3">
                <div className="text-xs text-slate-500">البريد الإلكتروني</div>
                <div className="mt-2 font-bold text-slate-900" dir="ltr">
                  {privacy?.maskedEmail || "-"}
                </div>
              </div>

              <div className="rounded-2xl bg-white px-4 py-3">
                <div className="text-xs text-slate-500">الدور داخل النظام</div>
                <div className="mt-2 font-bold text-slate-900">
                  {mapRole(privacy?.role)}
                </div>
              </div>
            </div>

            {profileError ? (
              <div className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {profileError}
              </div>
            ) : null}

            {profileMessage ? (
              <div className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {profileMessage}
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={profileSaving}
              className="mt-4 flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-black text-white disabled:opacity-60"
            >
              {profileSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري الحفظ
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  حفظ البيانات
                </>
              )}
            </button>
          </div>

          <div className="rounded-2xl bg-slate-50 px-4 py-4">
            <div className="mb-3 flex items-center gap-3">
              <LockKeyhole className="h-5 w-5 text-indigo-600" />
              <div className="font-bold text-slate-900">تغيير كلمة المرور</div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white px-4 py-3">
                <div className="mb-2 text-xs text-slate-500">
                  كلمة المرور الجديدة
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-900 outline-none focus:border-indigo-400"
                  placeholder="********"
                />
              </div>

              <div className="rounded-2xl bg-white px-4 py-3">
                <div className="mb-2 text-xs text-slate-500">
                  تأكيد كلمة المرور
                </div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-900 outline-none focus:border-indigo-400"
                  placeholder="********"
                />
              </div>
            </div>

            {passwordError ? (
              <div className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {passwordError}
              </div>
            ) : null}

            {passwordMessage ? (
              <div className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {passwordMessage}
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleChangePassword}
              disabled={passwordSaving}
              className="mt-4 flex h-12 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 text-sm font-black text-white disabled:opacity-60"
            >
              {passwordSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري التحديث
                </>
              ) : (
                <>
                  <LockKeyhole className="h-4 w-4" />
                  تحديث كلمة المرور
                </>
              )}
            </button>
          </div>

          <div className="rounded-2xl bg-slate-50 px-4 py-4">
            <div className="mb-3 flex items-center gap-3">
              <EyeOff className="h-5 w-5 text-amber-600" />
              <div className="font-bold text-slate-900">خصوصية البيانات</div>
            </div>

            <div className="space-y-2">
              {securityNotes.length === 0 ? (
                <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">
                  لا توجد ملاحظات إضافية حالياً.
                </div>
              ) : (
                securityNotes.map((note, index) => (
                  <div
                    key={`${note}-${index}`}
                    className="rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-slate-700"
                  >
                    {note}
                  </div>
                ))
              )}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white px-4 py-3">
                <div className="text-xs text-slate-500">حالة الحساب</div>
                <div className="mt-1 font-bold text-slate-900">
                  {privacy?.accountStatus || "-"}
                </div>
              </div>

              <div className="rounded-2xl bg-white px-4 py-3">
                <div className="text-xs text-slate-500">آخر تحديث</div>
                <div className="mt-1 font-bold text-slate-900">
                  {privacy?.lastProfileUpdate || "-"}
                </div>
              </div>

              <div className="rounded-2xl bg-white px-4 py-3 sm:col-span-2">
                <div className="text-xs text-slate-500">بداية العضوية</div>
                <div className="mt-1 font-bold text-slate-900">
                  {privacy?.memberSince || "-"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
