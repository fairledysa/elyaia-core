// FILE: src/app/api/production/profile/privacy/route.ts

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  updated_at: string | null;
};

type EmployeeRow = {
  id: string;
  active: boolean | null;
  user_id: string;
};

type TenantMemberRow = {
  tenant_id: string;
  role: string;
  created_at: string;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return null;

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");

  return `${y}-${m}-${day} ${h}:${min}`;
}

function maskEmail(email: string | null | undefined) {
  if (!email) return null;

  const [name, domain] = email.split("@");
  if (!name || !domain) return email;

  if (name.length <= 2) {
    return `${name[0] ?? "*"}***@${domain}`;
  }

  return `${name.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone: string | null | undefined) {
  if (!phone) return null;

  const digits = phone.replace(/\s+/g, "");
  if (digits.length < 4) return phone;

  return `${digits.slice(0, 3)}****${digits.slice(-3)}`;
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const admin = createSupabaseAdminClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { data: membership, error: membershipError } = await supabase
      .from("tenant_members")
      .select("tenant_id, role, created_at")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle<TenantMemberRow>();

    if (membershipError) {
      return NextResponse.json(
        { error: membershipError.message },
        { status: 500 },
      );
    }

    if (!membership?.tenant_id) {
      return NextResponse.json({ error: "TENANT_NOT_FOUND" }, { status: 403 });
    }

    const tenantId = membership.tenant_id;

    const { data: employee, error: employeeError } = await admin
      .from("employees")
      .select("id, active, user_id")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .maybeSingle<EmployeeRow>();

    if (employeeError) {
      return NextResponse.json(
        { error: employeeError.message },
        { status: 500 },
      );
    }

    if (!employee) {
      return NextResponse.json(
        { error: "EMPLOYEE_NOT_FOUND" },
        { status: 404 },
      );
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, full_name, phone, email, updated_at")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>();

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      privacy: {
        accountName: profile?.full_name ?? user.email ?? "—",
        maskedEmail: maskEmail(profile?.email ?? user.email ?? null),
        maskedPhone: maskPhone(profile?.phone ?? null),
        accountStatus: employee.active === true ? "نشط" : "غير نشط",
        role: membership.role ?? null,
        lastProfileUpdate: formatDateTime(profile?.updated_at ?? null),
        sessionUserId: user.id,
        sessionEmailVerifiedAt: formatDateTime(
          (user as { email_confirmed_at?: string | null }).email_confirmed_at ??
            null,
        ),
        memberSince: formatDateTime(membership.created_at),
        securityNotes: [
          "يتم الوصول فقط إلى البيانات المرتبطة بمرحلتي الحالية داخل النظام.",
          "الجلسة الحالية مربوطة بحسابك المسجل في النظام.",
          "تغيير كلمة المرور وإدارة الجلسات الإضافية سيضافان لاحقًا.",
        ],
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
