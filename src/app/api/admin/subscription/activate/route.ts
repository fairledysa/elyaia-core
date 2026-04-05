// FILE: src/app/api/admin/subscription/activate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.is_super_admin) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    const formData = await req.formData();
    const tenantId = String(formData.get("tenant_id") || "").trim();

    if (!tenantId) {
      return NextResponse.redirect(
        new URL("/admin/dashboard?error=missing_tenant_id", req.url),
      );
    }

    const admin = createSupabaseAdminClient();

    const { data: installation, error: installationError } = await admin
      .from("salla_installations")
      .select("id, merchant_id")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (installationError) throw installationError;

    const { error: subError } = await admin
      .from("app_subscriptions")
      .upsert(
        {
          tenant_id: tenantId,
          installation_id: installation?.id ?? null,
          merchant_id: installation?.merchant_id ?? null,
          status: "active",
          plan_name: "manual",
          last_event: "admin.subscription.activate",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" },
      );

    if (subError) throw subError;

    return NextResponse.redirect(
      new URL("/admin/dashboard?success=subscription_activated", req.url),
    );
  } catch (error) {
    console.error("[admin/subscription/activate] error", error);
    return NextResponse.redirect(
      new URL("/admin/dashboard?error=subscription_activate_failed", req.url),
    );
  }
}