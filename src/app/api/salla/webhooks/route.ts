// src/app/api/salla/webhooks/route.ts

import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/app/lib/supabase-admin";

type SallaWebhookBody = {
  event: string;
  merchant?: number;
  data?: any;
};

function getHeader(req: NextRequest, name: string) {
  return req.headers.get(name) || req.headers.get(name.toLowerCase()) || "";
}

export async function POST(req: NextRequest) {
  try {
    // =========================================
    // 1️⃣ تحقق من webhook secret
    // =========================================
    const sentAuth = getHeader(req, "authorization");
    const expected = process.env.SALLA_WEBHOOK_SECRET || "";

    if (!expected || sentAuth !== expected) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized webhook" },
        { status: 401 },
      );
    }

    const body = (await req.json()) as SallaWebhookBody;

    // =========================================
    // 2️⃣ app.store.authorize
    // =========================================
    if (body.event === "app.store.authorize") {
      const merchantId = String(body.merchant);
      const accessToken = body.data?.access_token;
      const refreshToken = body.data?.refresh_token;
      const expires = body.data?.expires;

      if (!merchantId || !accessToken) {
        return NextResponse.json(
          { ok: false, error: "Missing merchant/token" },
          { status: 400 },
        );
      }

      // 🔍 هل المتجر موجود مسبقًا؟
      const { data: existingInstallation } = await supabaseAdmin
        .from("salla_installations")
        .select("id, tenant_id")
        .eq("merchant_id", merchantId)
        .maybeSingle();

      let installationId: string;
      let tenantId: string;

      if (existingInstallation) {
        // ✅ المتجر موجود → نستخدمه
        installationId = existingInstallation.id;
        tenantId = existingInstallation.tenant_id;
      } else {
        // 🆕 متجر جديد → أنشئ tenant
        const { data: newTenant, error: tenantError } = await supabaseAdmin
          .from("tenants")
          .insert({ name: `Store ${merchantId}` })
          .select()
          .single();

        if (tenantError || !newTenant) {
          throw tenantError;
        }

        tenantId = newTenant.id;

        // أنشئ installation
        const { data: newInstallation, error: installError } =
          await supabaseAdmin
            .from("salla_installations")
            .insert({
              tenant_id: tenantId,
              merchant_id: merchantId,
              status: "active",
            })
            .select()
            .single();

        if (installError || !newInstallation) {
          throw installError;
        }

        installationId = newInstallation.id;
      }

      // 🔐 خزّن أو حدّث التوكن
      const { error: tokenError } = await supabaseAdmin
        .from("salla_tokens")
        .upsert({
          installation_id: installationId,
          access_token: accessToken,
          refresh_token: refreshToken,
          access_expires_at: expires
            ? new Date(expires * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        });

      if (tokenError) throw tokenError;

      return NextResponse.json({ ok: true });
    }

    // =========================================
    // 3️⃣ app.uninstalled
    // =========================================
    if (body.event === "app.uninstalled") {
      const merchantId = String(body.merchant);

      await supabaseAdmin
        .from("salla_installations")
        .update({ status: "revoked" })
        .eq("merchant_id", merchantId);

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("WEBHOOK ERROR:", error);
    return NextResponse.json(
      { ok: false, error: error?.message },
      { status: 500 },
    );
  }
}
