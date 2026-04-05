// FILE: src/lib/billing/requireActiveSubscription.ts
import { redirect } from "next/navigation";

type RequireActiveSubscriptionParams = {
  sb: any;
  tenantId: string;
  redirectTo?: string;
};

export async function requireActiveSubscription(
  params: RequireActiveSubscriptionParams,
) {
  const { sb, tenantId } = params;
  const redirectTo = params.redirectTo ?? "/login";

  const { data, error } = await sb
    .from("app_subscriptions")
    .select("status")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const status = String(data?.status || "inactive");

  const allowedStatuses = ["active", "trialing"];

  if (!allowedStatuses.includes(status)) {
    redirect(redirectTo);
  }

  return {
    status,
  };
}