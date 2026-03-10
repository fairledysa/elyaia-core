// FILE: src/app/api/employees/candidates/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant/requireTenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

type MemberRow = {
  user_id: string;
  role: string | null;
};

type EmployeeRow = {
  user_id: string;
};

export async function GET() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { tenantId } = await requireTenant({ userId: user.id, sb });
  const admin = createSupabaseAdminClient();

  const membersQ = await admin
    .from("tenant_members")
    .select("user_id, role")
    .eq("tenant_id", tenantId)
    .in("role", ["admin", "staff"]);

  if (membersQ.error) {
    return NextResponse.json(
      { ok: false, error: membersQ.error.message },
      { status: 500 },
    );
  }

  const members = (membersQ.data || []) as MemberRow[];
  const memberUserIds = [
    ...new Set(members.map((m) => m.user_id).filter(Boolean)),
  ];

  if (memberUserIds.length === 0) {
    return NextResponse.json({ ok: true, items: [] });
  }

  const employeesQ = await admin
    .from("employees")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .in("user_id", memberUserIds);

  if (employeesQ.error) {
    return NextResponse.json(
      { ok: false, error: employeesQ.error.message },
      { status: 500 },
    );
  }

  const employeeUserIds = new Set(
    ((employeesQ.data || []) as EmployeeRow[]).map((e) => e.user_id),
  );

  const availableUserIds = memberUserIds.filter(
    (id) => !employeeUserIds.has(id),
  );

  if (availableUserIds.length === 0) {
    return NextResponse.json({ ok: true, items: [] });
  }

  const profilesQ = await admin
    .from("profiles")
    .select("id, full_name, phone, email")
    .in("id", availableUserIds);

  if (profilesQ.error) {
    return NextResponse.json(
      { ok: false, error: profilesQ.error.message },
      { status: 500 },
    );
  }

  const profilesById = new Map(
    ((profilesQ.data || []) as ProfileRow[]).map((p) => [p.id, p]),
  );

  const membersById = new Map(members.map((m) => [m.user_id, m]));

  const items = availableUserIds.map((id) => {
    const profile = profilesById.get(id) || null;
    const member = membersById.get(id) || null;

    return {
      user_id: id,
      role: member?.role ?? null,
      full_name: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      email: profile?.email ?? null,
    };
  });

  return NextResponse.json({ ok: true, items });
}
