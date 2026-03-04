// src/app/api/salla/webhooks/route.ts
import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/app/lib/supabase-admin";
type SallaWebhookBody = {
  event: string;
  merchant?: number;
  created_at?: string;
  data?: any;
};

function getHeader(req: NextRequest, name: string) {
  return req.headers.get(name) || req.headers.get(name.toLowerCase()) || "";
}

export async function POST(req: NextRequest) {
  try {
    // 1️⃣ تحقق من سر webhook
    const sentAuth = getHeader(req, "authorization");
    const expected = process.env.SALLA_WEBHOOK_SECRET || "";

    if (!expected || sentAuth !== expected) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized webhook" },
        { status: 401 },
      );
    }

    const body = (await req.json()) as SallaWebhookBody;

    // ===============================
    // 🔥 EVENT: app.store.authorize
    // ===============================
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

      // 1️⃣ أنشئ tenant جديد
      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .insert({ name: `Store ${merchantId}` })
        .select()
        .single();

      // 2️⃣ أنشئ installation
      const { data: installation } = await supabaseAdmin
        .from("salla_installations")
        .insert({
          tenant_id: tenant.id,
          merchant_id: merchantId,
          status: "active",
        })
        .select()
        .single();

      // 3️⃣ خزّن التوكن
      await supabaseAdmin.from("salla_tokens").upsert({
        installation_id: installation.id,
        access_token: accessToken,
        refresh_token: refreshToken,
        access_expires_at: expires
          ? new Date(expires * 1000).toISOString()
          : null,
      });

      return NextResponse.json({ ok: true });
    }

    // ===============================
    // 🔥 EVENT: app.uninstalled
    // ===============================
    if (body.event === "app.uninstalled") {
      const merchantId = String(body.merchant);

      const { data: installation } = await supabaseAdmin
        .from("salla_installations")
        .select("id")
        .eq("merchant_id", merchantId)
        .single();

      if (installation) {
        await supabaseAdmin
          .from("salla_installations")
          .update({ status: "revoked" })
          .eq("id", installation.id);
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
}
