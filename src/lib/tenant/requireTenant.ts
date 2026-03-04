// FILE: src/lib/tenant/requireTenant.ts
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type RequireTenantResult = {
  tenantId: string;
  role: string;
};

export async function requireTenant(params: {
  userId: string;
  sb: any;
  cookieKey?: string;
}): Promise<RequireTenantResult> {
  const { userId, sb } = params;
  const cookieKey = params.cookieKey ?? "elyaia_tenant";

  const cookieStore = await cookies();
  const preferredTenantId = cookieStore.get(cookieKey)?.value || null;

  if (preferredTenantId) {
    const { data, error } = await sb
      .from("tenant_members")
      .select("tenant_id, role")
      .eq("user_id", userId)
      .eq("tenant_id", preferredTenantId)
      .maybeSingle();

    if (!error && data?.tenant_id) {
      return { tenantId: data.tenant_id, role: String(data.role) };
    }
  }

  const { data: membership, error } = await sb
    .from("tenant_members")
    .select("tenant_id, role, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (!membership?.tenant_id) {
    redirect("/login");
  }

  return {
    tenantId: membership.tenant_id,
    role: String(membership.role),
  };
}
