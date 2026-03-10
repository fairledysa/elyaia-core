// FILE: src/app/(production)/production/layout.tsx

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProductionShell } from "@/components/production/production-shell";

export default async function ProductionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/production-login");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership?.tenant_id) {
    redirect("/production-login");
  }

  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("id, active, stage_id")
    .eq("tenant_id", membership.tenant_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (employeeError || !employee || !employee.active) {
    redirect("/production-login");
  }

  return <ProductionShell>{children}</ProductionShell>;
}
