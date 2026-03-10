// FILE: src/lib/auth/requireDashboardAccess.ts
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/requireUser";

type DashboardAccessResult = {
  userId: string;
  tenantId: string;
  role: string;
};

export async function requireDashboardAccess(): Promise<DashboardAccessResult> {
  const { user } = await requireUser();
  const admin = createSupabaseAdminClient();

  const { data: membership, error } = await admin
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error || !membership?.tenant_id) {
    redirect("/login");
  }

  const role = String(membership.role || "");

  const allowedRoles = ["owner", "admin", "manager"];

  if (!allowedRoles.includes(role)) {
    redirect("/production");
  }

  return {
    userId: user.id,
    tenantId: membership.tenant_id,
    role,
  };
}
